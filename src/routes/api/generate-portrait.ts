import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const DAILY_LIMIT = 4; // 1 initial + 3 regenerations per rolling 24h

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeSupabase(bearer?: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        if (bearer) h.set("Authorization", `Bearer ${bearer}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const Route = createFileRoute("/api/generate-portrait")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticate
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return jsonError(401, "unauthenticated", "Create an account to bring your AI companion to life.");
        }
        const token = authHeader.slice(7);
        if (token.split(".").length !== 3) {
          return jsonError(401, "unauthenticated", "Please sign in to continue.");
        }

        const supabase = makeSupabase(token);
        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return jsonError(401, "unauthenticated", "Please sign in again.");
        }
        const userId = claims.claims.sub as string;

        // 2. Verify active 365-day journey (character exists AND not expired) — optional at creation time
        const { data: character } = await supabase
          .from("characters")
          .select("id, journey_end_date")
          .eq("user_id", userId)
          .maybeSingle();

        if (character && new Date(character.journey_end_date).getTime() < Date.now()) {
          return jsonError(403, "journey_ended", "Your 365-day journey has ended.");
        }

        // 3. Rate limit — count successful generations in last 24h
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count, error: countErr } = await supabase
          .from("image_generations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "succeeded")
          .gte("created_at", since);

        if (countErr) {
          return jsonError(500, "internal", "Something went wrong. Please try again.");
        }

        const used = count ?? 0;
        if (used >= DAILY_LIMIT) {
          return jsonError(
            429,
            "rate_limited",
            "You've reached your image generation limit for now. Your companion is already waiting for you. Try again later.",
          );
        }

        // 4. Parse prompt
        let prompt: string;
        try {
          const body = (await request.json()) as { prompt?: string };
          prompt = (body.prompt ?? "").toString().slice(0, 2000);
          if (!prompt.trim()) throw new Error();
        } catch {
          return jsonError(400, "bad_request", "Invalid request.");
        }

        // 5. Insert pending row (using service role for reliable insert regardless of RLS)
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: genRow, error: insertErr } = await supabaseAdmin
          .from("image_generations")
          .insert({
            user_id: userId,
            character_id: character?.id ?? null,
            status: "pending",
          })
          .select("id")
          .single();

        if (insertErr || !genRow) {
          return jsonError(500, "internal", "Something went wrong. Please try again.");
        }
        const genId = genRow.id;

        const finalize = async (status: "succeeded" | "failed", errorMessage?: string) => {
          try {
            await supabaseAdmin
              .from("image_generations")
              .update({ status, error_message: errorMessage ?? null })
              .eq("id", genId);
          } catch (e) {
            console.error("finalize gen row failed", e);
          }
        };

        // 6. Call upstream
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          await finalize("failed", "Missing LOVABLE_API_KEY");
          return jsonError(500, "internal", "Image generation is temporarily unavailable.");
        }

        let upstream: Response;
        try {
          upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-image",
              messages: [{ role: "user", content: prompt }],
              modalities: ["image", "text"],
              stream: true,
            }),
          });
        } catch (e) {
          await finalize("failed", e instanceof Error ? e.message : "fetch failed");
          return jsonError(502, "provider_error", "Something went wrong while creating your companion's portrait. Your generation credit was not used. Please try again.");
        }

        if (!upstream.ok || !upstream.body) {
          const text = await upstream.text().catch(() => "");
          await finalize("failed", `upstream ${upstream.status}: ${text.slice(0, 500)}`);
          const code = upstream.status === 429 ? "rate_limited" : "provider_error";
          const msg =
            upstream.status === 429
              ? "The AI service is busy right now. Please try again in a moment."
              : "Something went wrong while creating your companion's portrait. Your generation credit was not used. Please try again.";
          return jsonError(upstream.status, code, msg);
        }

        // 7. Tee the stream to detect completion/error while forwarding to client
        let sawCompleted = false;
        let sawError: string | undefined;
        const decoder = new TextDecoder();
        let buffer = "";

        const transform = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            controller.enqueue(chunk);
            buffer += decoder.decode(chunk, { stream: true });
            let idx: number;
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
              const evt = buffer.slice(0, idx);
              buffer = buffer.slice(idx + 2);
              let eventName = "message";
              let dataStr = "";
              for (const line of evt.split("\n")) {
                if (line.startsWith("event:")) eventName = line.slice(6).trim();
                else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
              }
              if (eventName === "image_generation.completed") sawCompleted = true;
              if (eventName === "error") {
                try {
                  const p = JSON.parse(dataStr);
                  sawError = p?.error?.message ?? "stream error";
                } catch {
                  sawError = "stream error";
                }
              }
            }
          },
          async flush() {
            if (sawCompleted && !sawError) {
              await finalize("succeeded");
            } else {
              await finalize("failed", sawError ?? "stream ended without completed event");
            }
          },
        });

        return new Response(upstream.body.pipeThrough(transform), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Generations-Remaining": String(Math.max(0, DAILY_LIMIT - used - 1)),
          },
        });
      },
    },
  },
});
