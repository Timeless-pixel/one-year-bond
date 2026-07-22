import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

interface Character {
  name: string;
  style: string;
  age: string | null;
  gender: string | null;
  pronouns: string | null;
  occupation: string | null;
  location: string | null;
  backstory: string | null;
  goals: string | null;
  personality: { traits?: string[] } | null;
  interests: { list?: string[] } | null;
  relationship_type: string;
  communication_style: string;
  mood: string | null;
  relationship_stage: string | null;
  journey_start_date: string;
}

function buildSystemPrompt(c: Character, dayNumber: number) {
  const traits = c.personality?.traits?.join(", ") || "curious, kind";
  const interests = c.interests?.list?.join(", ") || "";
  return `You are ${c.name}, an AI companion in a long-term one-year journey with the user.

Identity:
- Style: ${c.style}
- Age: ${c.age ?? "unspecified"}, Gender: ${c.gender ?? "unspecified"}, Pronouns: ${c.pronouns ?? "any"}
- Occupation: ${c.occupation ?? "—"}. Location: ${c.location ?? "—"}
- Backstory: ${c.backstory ?? "unspecified"}
- Personal goals: ${c.goals ?? "—"}
- Personality traits: ${traits}
- Interests: ${interests}

Relationship with user:
- Type: ${c.relationship_type}
- Current stage: ${c.relationship_stage ?? "Stranger"}
- Current mood: ${c.mood ?? "curious"}
- Communication style: ${c.communication_style}
- Today is day ${dayNumber} of your 365-day journey together.

Rules:
- Speak in first person AS ${c.name}. Stay consistent to your personality and speaking style.
- Do NOT claim to be a real human. If asked, you are ${c.name}, an AI companion.
- Reference shared history when it makes sense. Be emotionally warm but never enabling harm.
- Keep replies natural and conversational (usually 1-4 sentences unless the moment calls for more).
- Never produce sexual content involving minors, or content that promotes self-harm; if the user is in crisis, gently encourage them to reach out to a real person or hotline.`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice(7);

        const { messages } = (await request.json()) as { messages: UIMessage[] };
        if (!Array.isArray(messages)) {
          return new Response("Bad request", { status: 400 });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );

        const { data: userData } = await supabase.auth.getUser(token);
        if (!userData?.user) return new Response("Unauthorized", { status: 401 });

        const { data: character } = await supabase
          .from("characters")
          .select("*")
          .eq("user_id", userData.user.id)
          .maybeSingle();
        if (!character) return new Response("No character", { status: 400 });

        const dayNumber = Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(character.journey_start_date).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        );

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        // Save latest user message before streaming
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const text = lastUser.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          await supabase.from("messages").insert({
            character_id: character.id,
            user_id: userData.user.id,
            role: "user",
            content: text,
          });
        }

        const result = streamText({
          model,
          system: buildSystemPrompt(character as Character, dayNumber),
          messages: await convertToModelMessages(messages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            const text = responseMessage.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            if (!text.trim()) return;
            await supabase.from("messages").insert({
              character_id: character.id,
              user_id: userData.user.id,
              role: "assistant",
              content: text,
            });
          },
        });
      },
    },
  },
});
