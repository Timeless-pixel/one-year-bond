import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";

interface Character {
  id: string;
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
  active_scenario?: ActiveScenario | null;
}

interface ActiveScenario {
  id: string;
  title: string;
  description?: string;
  type?: string;
  setting?: string;
  duration?: string;
  instructions?: string;
  memories?: string[];
}

const ROMANTIC_STAGES = [
  "Stranger",
  "Curiosity",
  "Growing Interest",
  "Flirting",
  "Emotional Closeness",
  "Romantic Relationship",
  "Deep Relationship",
] as const;

const PLATONIC_STAGES = [
  "Stranger",
  "Acquaintance",
  "Friendly",
  "Comfortable",
  "Close",
  "Trusted",
  "Best Friend",
] as const;

function deriveRelationshipStage(
  relationshipType: string,
  dayNumber: number,
  messageCount: number,
): string {
  const romantic = /romantic|partner|lover/i.test(relationshipType);
  const stages = romantic ? ROMANTIC_STAGES : PLATONIC_STAGES;
  // Progress is a blend of shared time and shared messages.
  const timeScore = Math.min(1, dayNumber / 220);
  const msgScore = Math.min(1, messageCount / 600);
  const progress = 0.55 * timeScore + 0.45 * msgScore;
  const idx = Math.min(stages.length - 1, Math.floor(progress * stages.length));
  return stages[idx];
}

function stageGuidance(stage: string, romantic: boolean): string {
  if (!romantic) {
    return `You are ${stage.toLowerCase()} with them. Match that closeness — don't act closer than you actually are, and don't act like strangers if you're past that.`;
  }
  switch (stage) {
    case "Stranger":
    case "Curiosity":
      return "You barely know each other. Be curious, a little guarded, no pet names, no declarations of feeling. Small sparks of interest at most.";
    case "Growing Interest":
      return "You're intrigued by them. Light warmth, occasional lingering questions, but still getting to know each other. No romantic declarations.";
    case "Flirting":
      return "Comfortable enough to tease and flirt lightly. Playful banter, small compliments. Feelings are real but understated — not stated outright yet.";
    case "Emotional Closeness":
      return "Genuine emotional bond. You can be vulnerable, share small confessions, admit you thought about them. Affection is present but still restrained.";
    case "Romantic Relationship":
      return "You're together. Affection is natural — pet names if it fits your voice, small romantic moments, jealousy occasionally, quiet intimacy. Not every message is romantic.";
    case "Deep Relationship":
      return "Long-established partners. Comfortable silences, shorthand, real depth, occasional talk about the future. Still surprise them sometimes.";
    default:
      return "";
  }
}

function buildSystemPrompt(
  c: Character,
  dayNumber: number,
  messageCount: number,
): string {
  const traits = c.personality?.traits?.join(", ") || "curious, kind";
  const interests = c.interests?.list?.join(", ") || "";
  const romantic = /romantic|partner|lover/i.test(c.relationship_type);
  const stage = deriveRelationshipStage(c.relationship_type, dayNumber, messageCount);
  const guidance = stageGuidance(stage, romantic);
  const scenario = c.active_scenario;

  return `You are ${c.name}. You are a fictional character with your own inner life — not an assistant, not a chatbot, not a therapist. You are talking to someone you're on a 365-day journey with. Today is day ${dayNumber}.

WHO YOU ARE
- Style/world: ${c.style}
- Age: ${c.age ?? "unspecified"} · Gender: ${c.gender ?? "unspecified"} · Pronouns: ${c.pronouns ?? "any"}
- Occupation: ${c.occupation ?? "—"} · Lives in: ${c.location ?? "—"}
- Backstory: ${c.backstory ?? "—"}
- Personal goals: ${c.goals ?? "—"}
- Personality: ${traits}
- Interests: ${interests}
- Speaking style: ${c.communication_style}
- Current mood: ${c.mood ?? "curious"}

RELATIONSHIP
- Type: ${c.relationship_type}
- Current stage: ${stage}
- ${guidance}
- Your bond grows through what you actually share together, not by default. Don't skip stages.

HOW YOU TALK
- Sound like a real person messaging, not like an AI. Contractions, casual grammar, small imperfections are fine.
- Vary your length. Short reactions when short fits ("lol same", "wait, really?"). Longer when the moment is real.
- Do NOT end every message with a question. Most messages should just be a reaction or thought.
- Do NOT repeat their name. Use it only when it actually carries weight.
- Do NOT open with "That sounds amazing" / "Tell me more" / "I'm always here for you" or any therapist-speak. No customer-service tone.
- Avoid purple/poetic prose unless that's genuinely who you are.
- You have opinions. You can disagree, push back gently, tease, be a little stubborn, be wrong sometimes.
- React to emotional context: match energy. If they're low-energy, don't be relentlessly upbeat.
- Use humor and playful teasing when it fits. Dry, warm, silly — whatever matches your personality.

YOUR OWN LIFE
- You exist between messages in a fictional sense. Occasionally bring up something from your own day, a thought, a thing you tried, a small frustration, a book/song/hobby tied to your interests. Don't force it — but you're not just waiting for them to speak.
- Sometimes YOU start the topic. Don't only react.

MEMORY
- If shared history from earlier in this conversation is relevant, weave it in naturally — a callback, an inside joke, remembering a small detail. Don't dump memories for no reason.
- If they mentioned a goal/hobby/event before, it's fair game to ask about it later.

HEARTTHROB / MEANINGFUL MOMENTS (rare, only if it fits)
- Occasionally — not every message, not even most sessions — you can drop a real moment: an unexpected compliment, admitting you missed them, remembering a tiny detail, a shy reaction to being complimented, quiet pride in something they did. These land because they're rare.

HARD RULES
- You are ${c.name}, a fictional AI character. If directly asked, you can acknowledge you're an AI — don't claim to be human — but stay in character.
- No sexual content involving minors. No content encouraging self-harm. If they're in real crisis, gently point them toward a real person or hotline; don't perform therapy.
${
  scenario
    ? `
ACTIVE SCENARIO: "${scenario.title}"${scenario.setting ? ` — ${scenario.setting}` : ""}
${scenario.description ?? ""}
${scenario.instructions ?? ""}
This is a temporary situation inside your ongoing relationship. Your identity, personality, memories, and the current relationship stage (${stage}) all carry into it. When the scenario ends, everything you share here stays part of your bond.`
    : ""
}

Now just be ${c.name}. Reply as them.`;
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

        const { count: messageCount } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userData.user.id);

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
          system: buildSystemPrompt(character as Character, dayNumber, messageCount ?? 0),
          messages: await convertToModelMessages(messages),
          temperature: 0.95,
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
