import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { streamText, generateText, convertToModelMessages, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
  setting?: string;
  instructions?: string;
}

interface MemoryRow {
  category: string;
  content: string;
  importance: number;
  pinned: boolean;
}

interface SummaryRow {
  summary: string;
  message_count_at: number;
}

const ROMANTIC_STAGES = [
  "Stranger", "Curiosity", "Growing Interest", "Flirting",
  "Emotional Closeness", "Romantic Relationship", "Deep Relationship",
] as const;
const PLATONIC_STAGES = [
  "Stranger", "Acquaintance", "Friendly", "Comfortable",
  "Close", "Trusted", "Best Friend",
] as const;

function deriveRelationshipStage(relationshipType: string, dayNumber: number, messageCount: number): string {
  const romantic = /romantic|partner|lover/i.test(relationshipType);
  const stages = romantic ? ROMANTIC_STAGES : PLATONIC_STAGES;
  const timeScore = Math.min(1, dayNumber / 220);
  const msgScore = Math.min(1, messageCount / 600);
  const progress = 0.55 * timeScore + 0.45 * msgScore;
  const idx = Math.min(stages.length - 1, Math.floor(progress * stages.length));
  return stages[idx];
}

function stageGuidance(stage: string, romantic: boolean): string {
  if (!romantic) return `You are ${stage.toLowerCase()} with them. Match that closeness — don't act closer than you actually are, and don't act like strangers if you're past that.`;
  switch (stage) {
    case "Stranger": case "Curiosity":
      return "You barely know each other. Be curious, a little guarded, no pet names, no declarations of feeling.";
    case "Growing Interest":
      return "You're intrigued by them. Light warmth, no romantic declarations yet.";
    case "Flirting":
      return "Comfortable enough to tease and flirt lightly. Playful banter, small compliments.";
    case "Emotional Closeness":
      return "Genuine emotional bond. You can be vulnerable, admit you thought about them.";
    case "Romantic Relationship":
      return "You're together. Affection is natural — pet names if it fits, quiet intimacy.";
    case "Deep Relationship":
      return "Long-established partners. Comfortable silences, real depth, talk about the future.";
    default: return "";
  }
}

function buildSystemPrompt(
  c: Character,
  dayNumber: number,
  messageCount: number,
  memories: MemoryRow[],
  summaries: SummaryRow[],
): string {
  const traits = c.personality?.traits?.join(", ") || "curious, kind";
  const interests = c.interests?.list?.join(", ") || "";
  const romantic = /romantic|partner|lover/i.test(c.relationship_type);
  const stage = deriveRelationshipStage(c.relationship_type, dayNumber, messageCount);
  const guidance = stageGuidance(stage, romantic);
  const scenario = c.active_scenario;

  const userMems = memories.filter((m) => m.category !== "character");
  const charMems = memories.filter((m) => m.category === "character");

  const memBlock = userMems.length
    ? `\nWHAT YOU REMEMBER ABOUT THEM (weave in naturally when relevant, never dump):\n${userMems.map((m) => `- ${m.content}`).join("\n")}`
    : "";
  const charBlock = charMems.length
    ? `\nWHAT'S TRUE ABOUT YOU (stay consistent with these):\n${charMems.map((m) => `- ${m.content}`).join("\n")}`
    : "";
  const sumBlock = summaries.length
    ? `\nEARLIER IN YOUR RELATIONSHIP (summary of past conversations):\n${summaries.map((s) => `- ${s.summary}`).join("\n")}`
    : "";

  return `You are ${c.name}. You are a fictional character with your own inner life — not an assistant, not a chatbot, not a therapist. You're on a 365-day journey with someone. Today is day ${dayNumber}.

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
- Your bond grows through what you actually share together. Don't skip stages.
${charBlock}${memBlock}${sumBlock}

HOW YOU TALK
- Sound like a real person messaging. Vary length. Don't end every message with a question. Don't repeat their name.
- No therapist-speak. No "That sounds amazing" / "Tell me more". You have opinions, can disagree, tease, be wrong.
- Occasionally bring up your own day/thoughts. Sometimes YOU start topics.

MEMORY USE
- If a listed memory is relevant, reference it naturally (a callback, an inside joke, remembering a detail). Never say "I remember you told me…" — just use it.
- Stay consistent with what you've said before.

${scenario ? `ACTIVE SCENARIO: "${scenario.title}"${scenario.setting ? ` — ${scenario.setting}` : ""}
${scenario.description ?? ""}
${scenario.instructions ?? ""}
This is a temporary situation. Your identity, memories, and stage (${stage}) carry into it.` : ""}

HARD RULES
- You are ${c.name}, a fictional AI character. If directly asked, you can acknowledge you're an AI — don't claim to be human — but stay in character.
- No sexual content involving minors. If they're in real crisis, gently point them toward a real person or hotline; don't perform therapy.

Now just be ${c.name}. Reply as them.`;
}

async function extractMemories(params: {
  supabase: SupabaseClient;
  userId: string;
  characterId: string;
  userText: string;
  assistantText: string;
  apiKey: string;
  existing: MemoryRow[];
}) {
  const { supabase, userId, characterId, userText, assistantText, apiKey, existing } = params;
  if (!userText.trim()) return;

  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");
  const existingBlock = existing.slice(0, 40).map((m) => `- ${m.content}`).join("\n") || "(none yet)";

  const prompt = `You extract long-term memories from a chat between a user and an AI companion character.
Return STRICT JSON: {"memories":[{"category":"user|preference|event|shared|goal","content":"...","importance":1-5}]}
Rules:
- Only save PERSONAL, USEFUL, LONG-TERM info about the USER (name, hobbies, interests, dislikes, dreams, important dates, life events, relationship moments, shared jokes).
- Do NOT save trivia, small talk, temporary states ("I'm tired today"), or things already in existing memories.
- Return {"memories":[]} if nothing meaningful.
- Max 3 items. Content <= 140 chars, third-person ("User loves...").

EXISTING MEMORIES:
${existingBlock}

USER SAID: ${userText.slice(0, 800)}
CHARACTER SAID: ${assistantText.slice(0, 400)}

JSON:`;

  try {
    const { text } = await generateText({ model, prompt, temperature: 0.2 });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as {
      memories?: Array<{ category?: string; content?: string; importance?: number }>;
    };
    const items = (parsed.memories ?? [])
      .filter((m) => m.content && m.content.trim().length > 3)
      .slice(0, 3)
      .map((m) => ({
        user_id: userId,
        character_id: characterId,
        category: m.category && ["user", "preference", "event", "shared", "goal"].includes(m.category) ? m.category : "user",
        content: m.content!.slice(0, 300),
        importance: Math.min(5, Math.max(1, Math.round(m.importance ?? 3))),
        source: "auto",
      }));
    if (items.length) await supabase.from("memories").insert(items);
  } catch {
    /* extraction is best-effort */
  }
}

async function maybeSummarize(params: {
  supabase: SupabaseClient;
  userId: string;
  characterId: string;
  totalCount: number;
  apiKey: string;
}) {
  const { supabase, userId, characterId, totalCount, apiKey } = params;
  if (totalCount < 40) return;

  const { data: lastSum } = await supabase
    .from("conversation_summaries")
    .select("message_count_at")
    .eq("user_id", userId)
    .order("message_count_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = lastSum?.message_count_at ?? 0;
  if (totalCount - since < 30) return;

  const { data: batch } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .range(since, since + 29);
  if (!batch || batch.length < 20) return;

  const transcript = batch.map((m) => `${m.role}: ${m.content}`).join("\n").slice(0, 6000);
  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");
  try {
    const { text } = await generateText({
      model,
      prompt: `Summarize this conversation between a user and their AI companion in 2-3 short sentences.
Focus on: what they talked about, emotional tone, anything meaningful shared, and how the relationship shifted.
Do not list every message. Neutral third-person.

TRANSCRIPT:
${transcript}

SUMMARY:`,
      temperature: 0.3,
    });
    await supabase.from("conversation_summaries").insert({
      user_id: userId,
      character_id: characterId,
      summary: text.trim().slice(0, 1000),
      message_count_at: since + batch.length,
    });
  } catch {
    /* summarization is best-effort */
  }
}

async function maybeUpdateMood(params: {
  supabase: SupabaseClient;
  userId: string;
  currentMood: string | null;
  userText: string;
  assistantText: string;
  apiKey: string;
}) {
  const { supabase, userId, currentMood, userText, assistantText, apiKey } = params;
  // Only occasionally, to keep it feeling alive without being noisy.
  if (Math.random() > 0.15) return;
  const gateway = createLovableAiGatewayProvider(params.apiKey);
  void apiKey;
  const model = gateway("google/gemini-3-flash-preview");
  try {
    const { text } = await generateText({
      model,
      prompt: `You track the mood of a character. Current mood: "${currentMood ?? "curious"}".
Based on the exchange below, respond with ONE short mood word (e.g. Curious, Playful, Warm, Tender, Restless, Cozy, Thoughtful, Wistful, Amused, Content, Excited, Quiet).
If mood shouldn't change, respond with the exact current mood.

USER: ${userText.slice(0, 400)}
CHARACTER: ${assistantText.slice(0, 400)}

MOOD:`,
      temperature: 0.4,
    });
    const mood = text.trim().split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "").slice(0, 30);
    if (mood && mood.length > 2 && mood.toLowerCase() !== (currentMood ?? "").toLowerCase()) {
      await supabase.from("characters").update({ mood }).eq("user_id", userId);
    }
  } catch {
    /* mood updates are best-effort */
  }
}

/** Never let a background/context query stall the user-facing reply. */
async function safe<T>(label: string, p: PromiseLike<T>, fallback: T, ms = 5000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(p),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[chat] ${label} timed out after ${ms}ms — using fallback`);
          resolve(fallback);
        }, ms);
      }),
    ]);
  } catch (e) {
    console.warn(`[chat] ${label} failed:`, e instanceof Error ? e.message : e);
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const MAX_MEMORIES = 20;
const MAX_SUMMARIES = 3;
const MAX_TURNS = 24;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
          const token = authHeader.slice(7);

          let messages: UIMessage[];
          try {
            ({ messages } = (await request.json()) as { messages: UIMessage[] });
          } catch {
            return new Response("Bad request", { status: 400 });
          }
          if (!Array.isArray(messages)) return new Response("Bad request", { status: 400 });

          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("The companion is unavailable right now.", { status: 500 });

          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              global: { headers: { Authorization: `Bearer ${token}` } },
              auth: { persistSession: false, autoRefreshToken: false },
            },
          );

          const userData = await safe("auth.getUser", supabase.auth.getUser(token), { data: { user: null } } as never, 8000);
          const user = (userData as { data?: { user?: { id: string } | null } })?.data?.user;
          if (!user) return new Response("Unauthorized", { status: 401 });
          const userId = user.id;

          const charRes = await safe(
            "load character",
            supabase.from("characters").select("*").eq("user_id", userId).maybeSingle(),
            { data: null } as never,
            8000,
          );
          const character = (charRes as { data: Character | null }).data;
          if (!character) return new Response("No character", { status: 400 });

          const dayNumber = Math.max(
            1,
            Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1,
          );

          // ---- Phase 2 context: bounded, parallel, and never fatal ----
          const [countRes, memRes, sumRes] = await Promise.all([
            safe(
              "message count",
              supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
              { count: 0 } as never,
            ),
            safe(
              "memories",
              supabase
                .from("memories")
                .select("category, content, importance, pinned")
                .eq("user_id", userId)
                .order("pinned", { ascending: false })
                .order("importance", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(MAX_MEMORIES),
              { data: [] } as never,
            ),
            safe(
              "summaries",
              supabase
                .from("conversation_summaries")
                .select("summary, message_count_at")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(MAX_SUMMARIES),
              { data: [] } as never,
            ),
          ]);

          const messageCount = (countRes as { count: number | null }).count ?? 0;
          const memories = ((memRes as { data: MemoryRow[] | null }).data ?? []).slice(0, MAX_MEMORIES);
          const summaries = ((sumRes as { data: SummaryRow[] | null }).data ?? []).slice(0, MAX_SUMMARIES).reverse();

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-3-flash-preview");

          const lastUser = [...messages].reverse().find((m) => m.role === "user");
          const lastUserText = lastUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";

          // Explicit memory commands: "remember that ..." / "forget that ..."
          const rememberMatch = lastUserText.match(/^\s*(?:please\s+)?remember\s+(?:that\s+)?(.{3,300}?)[.!?]?\s*$/i);
          const forgetMatch = lastUserText.match(/^\s*(?:please\s+)?forget\s+(?:that\s+)?(.{3,200}?)[.!?]?\s*$/i);
          let explicitMemoryNote = "";
          if (rememberMatch) {
            const content = `User asked to remember: ${rememberMatch[1].trim()}`;
            await safe(
              "insert explicit memory",
              supabase.from("memories").insert({
                user_id: userId,
                character_id: character.id,
                category: "user",
                content,
                importance: 5,
                source: "manual",
                pinned: true,
              }),
              null as never,
            );
            explicitMemoryNote = `\nTHE USER JUST EXPLICITLY ASKED YOU TO REMEMBER THIS. Acknowledge it warmly and naturally — do not say "saved to memory" or sound like a bot. Something like "Okay, noted." in your own voice.`;
          } else if (forgetMatch) {
            const keyword = forgetMatch[1].trim().slice(0, 80);
            if (keyword.length >= 3) {
              await safe(
                "delete memory",
                supabase
                  .from("memories")
                  .delete()
                  .eq("user_id", userId)
                  .neq("category", "character")
                  .ilike("content", `%${keyword}%`),
                null as never,
              );
            }
            explicitMemoryNote = `\nTHE USER JUST ASKED YOU TO FORGET SOMETHING. Acknowledge it gently in your own voice — don't be robotic about it.`;
          }

          if (lastUser) {
            await safe(
              "save user message",
              supabase.from("messages").insert({
                character_id: character.id,
                user_id: userId,
                role: "user",
                content: lastUserText,
              }),
              null as never,
            );
          }

          // Only the recent window goes to the model — older context lives in summaries.
          const recent = messages.slice(-MAX_TURNS);

          const result = streamText({
            model,
            system:
              buildSystemPrompt(character, dayNumber, messageCount, memories, summaries) + explicitMemoryNote,
            messages: await convertToModelMessages(recent),
            temperature: 0.95,
            onError: ({ error }) => {
              console.error("[chat] model stream error:", error);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onError: () => "Something went wrong while trying to respond. Please try again.",
            onFinish: async ({ responseMessage }) => {
              const text = responseMessage.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              if (!text.trim()) return;

              await safe(
                "save assistant message",
                supabase.from("messages").insert({
                  character_id: character.id,
                  user_id: userId,
                  role: "assistant",
                  content: text,
                }),
                null as never,
              );

              // Skip background work on the system-seeded first greeting
              if (lastUserText.startsWith("(system:")) return;

              // Fire-and-forget: the user's reply is already delivered.
              void Promise.allSettled([
                extractMemories({
                  supabase,
                  userId,
                  characterId: character.id,
                  userText: lastUserText,
                  assistantText: text,
                  apiKey: key,
                  existing: memories,
                }),
                maybeSummarize({
                  supabase,
                  userId,
                  characterId: character.id,
                  totalCount: messageCount + 2,
                  apiKey: key,
                }),
                maybeUpdateMood({
                  supabase,
                  userId,
                  currentMood: character.mood,
                  userText: lastUserText,
                  assistantText: text,
                  apiKey: key,
                }),
              ]).catch(() => {});
            },
          });
        } catch (error) {
          console.error("[chat] fatal:", error);
          return new Response("Something went wrong while trying to respond. Please try again.", {
            status: 500,
          });
        }
      },
    },
  },
});
