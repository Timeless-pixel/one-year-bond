import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [catalog, sessions] = await Promise.all([
      context.supabase.from("scenarios").select("*").order("sort_order", { ascending: true }),
      context.supabase
        .from("scenario_sessions")
        .select("id, scenario_id, status, recap, day_started, last_active_at, completed_at")
        .eq("user_id", context.userId)
        .order("last_active_at", { ascending: false }),
    ]);
    if (catalog.error) throw new Error(catalog.error.message);
    return { scenarios: catalog.data ?? [], sessions: sessions.data ?? [] };
  });

export const startScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ scenarioId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: character } = await context.supabase
      .from("characters")
      .select("id, journey_start_date")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!character) throw new Error("No character yet.");

    // Resume instead of duplicating an in-progress session.
    const { data: existing } = await context.supabase
      .from("scenario_sessions")
      .select("id")
      .eq("user_id", context.userId)
      .eq("scenario_id", data.scenarioId)
      .eq("status", "active")
      .maybeSingle();
    if (existing) return { sessionId: existing.id, resumed: true };

    const day = Math.max(
      1,
      Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1,
    );

    const { data: session, error } = await context.supabase
      .from("scenario_sessions")
      .insert({
        user_id: context.userId,
        character_id: character.id,
        scenario_id: data.scenarioId,
        status: "active",
        day_started: day,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { sessionId: session.id, resumed: false };
  });

export const getScenarioSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: session, error } = await context.supabase
      .from("scenario_sessions")
      .select("*, scenarios(*)")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session) throw new Error("Scenario not found.");

    const { data: messages } = await context.supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .eq("scenario_session_id", data.sessionId)
      .order("created_at", { ascending: true })
      .limit(120);

    return { session, messages: messages ?? [] };
  });

export const completeScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        saveMoment: z.boolean().default(false),
        caption: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: session } = await context.supabase
      .from("scenario_sessions")
      .select("*, scenarios(title, premise)")
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!session) throw new Error("Scenario not found.");

    const { data: msgs } = await context.supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", context.userId)
      .eq("scenario_session_id", data.sessionId)
      .order("created_at", { ascending: true })
      .limit(60);

    const transcript = (msgs ?? [])
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n")
      .slice(0, 5000);

    const scenario = (session as unknown as { scenarios: { title: string; premise: string | null } })
      .scenarios;

    let recap = `You and your companion shared "${scenario.title}".`;
    if (transcript.length > 80) {
      try {
        const key = process.env["LOVABLE_API_KEY"];
        if (key) {
          const [{ createLovableAiGatewayProvider }, { generateText }] = await Promise.all([
            import("@/lib/ai-gateway.server"),
            import("ai"),
          ]);
          const gateway = createLovableAiGatewayProvider(key);
          const { text } = await generateText({
            model: gateway("google/gemini-3-flash-preview"),
            temperature: 0.4,
            prompt: `Write a 1-2 sentence keepsake recap of this shared scene, in warm second person ("You two...").
Focus on what actually happened and any emotional turn. No preamble.

SCENE: ${scenario.title}
TRANSCRIPT:
${transcript}

RECAP:`,
          });
          if (text.trim()) recap = text.trim().slice(0, 400);
        }
      } catch {
        /* recap is best-effort */
      }
    }

    await context.supabase
      .from("scenario_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString(), recap })
      .eq("id", data.sessionId)
      .eq("user_id", context.userId);

    if (data.saveMoment) {
      await context.supabase.from("story_events").insert({
        user_id: context.userId,
        character_id: session.character_id,
        scenario_session_id: session.id,
        kind: "scenario",
        title: scenario.title,
        description: recap,
        caption: data.caption || null,
        day: session.day_started,
      });
      await context.supabase.from("memories").insert({
        user_id: context.userId,
        character_id: session.character_id,
        category: "moment",
        content: `Shared scenario "${scenario.title}": ${recap}`.slice(0, 300),
        importance: 5,
        source: "scenario",
        pinned: true,
      });
    }

    return { recap };
  });

export const listStoryEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("story_events")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteStoryEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("story_events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCompanionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        daily_events_enabled: z.boolean().optional(),
        surprises_enabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("characters")
      .update(data)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
