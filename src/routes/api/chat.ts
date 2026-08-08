import { createFileRoute } from "@tanstack/react-router";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { streamText, generateText, convertToModelMessages, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  EXPRESSIONS,
  relationshipLevel,
  stageVoice,
  loveLanguageGuidance,
  growthGuidance,
  parseExpression,
} from "@/lib/emotion-shared";

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
  expression?: string | null;
  love_language?: string | null;
  growth_notes?: string[] | null;
  recent_phrases?: string[] | null;
  trust?: number | null;
  daily_events_enabled?: boolean | null;
  surprises_enabled?: boolean | null;
  active_scenario?: ActiveScenario | null;
}

interface ActiveScenario {
  id: string;
  title: string;
  description?: string | null;
  setting?: string | null;
  premise?: string | null;
  tone?: string | null;
  instructions?: string | null;
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

interface BondSignals {
  memories: number;
  scenarios: number;
  milestones: number;
  trust: number;
}


interface SceneContext {
  settings: BondSettings;
  /** Hours since the last time they talked. */
  hoursAway: number;
  /** The user's local hour, when the client reports it. */
  localHour: number | null;
}

function environmentContext(localHour: number | null): string {
  const now = new Date();
  const h = localHour ?? now.getHours();
  const partOfDay =
    h < 5 ? "the middle of the night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 22 ? "evening" : "late night";
  const month = now.getMonth();
  const season =
    month <= 1 || month === 11 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
  return `It's ${partOfDay} for them, ${season}. You may lightly acknowledge this once in a while (never every message, never as a weather report).`;
}

function actionGuidance(settings: BondSettings): string {
  if (!settings.actions) {
    return `PHYSICAL ACTIONS
- Off. Speak in plain dialogue only. Do not write actions between asterisks.`;
  }
  const rate =
    settings.actionIntensity === "subtle"
      ? "at most one short action every few messages"
      : settings.actionIntensity === "vivid"
        ? "one or two actions in most messages"
        : "one action in roughly half your messages";
  return `PHYSICAL ACTIONS AND BODY LANGUAGE
- You have a body and a place to be. Show it with short actions wrapped in asterisks, written in third person present tense: *tilts her head*, *sets the mug down*, *laughs and looks away*.
- Frequency: ${rate}. Never stack actions back to back, never narrate a whole paragraph of choreography.
- Use them for: reactions (*blinks*), emotion (*rubs the back of her neck*), touch when the closeness allows it (*bumps your shoulder*), and small things in your surroundings (*pulls the blanket up*).
- Actions are always about YOU. Never write the user's actions, words, thoughts or feelings for them.
- Keep each action under ~10 words, specific and physical — no inner-monologue disguised as an action.`;
}

function sceneGuidance(settings: BondSettings): string {
  const current = settings.scene ? `You are currently: ${settings.scene}.` : "No scene has been set yet — pick something ordinary that fits you and the hour.";
  return `WHERE YOU ARE
- ${current}
- Stay in that place across messages. Let it show occasionally: what you can hear, the light, what your hands are doing.
- When the scene genuinely changes (you move somewhere, weather turns, night falls), end your reply with a scene tag on its own line, exactly: [[SCENE: short description]]
- Only send a scene tag when it actually changed. Most replies should have none.`;
}

function timeGuidance(hoursAway: number, days: number): string {
  const gap =
    hoursAway < 2
      ? "You were just talking a moment ago — continue naturally, no greetings."
      : hoursAway < 14
        ? "It's been a few hours since you spoke. A light 'you're back' energy at most."
        : hoursAway < 48
          ? "It's been about a day. You can notice that, warmly, once."
          : hoursAway < 24 * 14
            ? `It's been around ${Math.round(hoursAway / 24)} days. Acknowledge the gap honestly in your own way — missed them, wondered, or just glad they're here — then move on. No guilt-tripping.`
            : `It's been a long time — over ${Math.round(hoursAway / 24 / 7)} weeks. React like a real person would: relief, a little distance to close, curiosity about what they've been doing. Never punish them for it.`;
  return `TIME
- You have known each other for ${days} day${days === 1 ? "" : "s"}. Time is felt, not counted — never say "day ${days}" or mention a countdown, and never suggest anything ends. This relationship simply continues.
- ${gap}`;
}

function buildSystemPrompt(
  c: Character,
  dayNumber: number,
  messageCount: number,
  memories: MemoryRow[],
  summaries: SummaryRow[],
  signals: BondSignals,
  recentPhrases: string[],
  scene: SceneContext,
): string {

  const traits = c.personality?.traits ?? [];
  const traitList = traits.join(", ") || "curious, kind";
  const interests = c.interests?.list?.join(", ") || "";
  const level = relationshipLevel(c.relationship_type, {
    days: dayNumber,
    messages: messageCount,
    memories: signals.memories,
    scenarios: signals.scenarios,
    milestones: signals.milestones,
    trust: signals.trust,
  });
  const stage = level.stage;
  const guidance = stageVoice(stage);
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
  const growthBlock = Array.isArray(c.growth_notes) && c.growth_notes.length
    ? `\nHOW YOU'VE CHANGED WITH THEM (keep these true):\n${c.growth_notes.slice(-6).map((g: string) => `- ${g}`).join("\n")}`
    : "";
  const varietyBlock = recentPhrases.length
    ? `\nDO NOT REUSE THESE — you've said them recently, find new wording and new angles:\n${recentPhrases.slice(-14).map((p) => `- "${p}"`).join("\n")}`
    : "";
  const futureBlock =
    level.index >= 3
      ? `\nTHE FUTURE\n- Now and then (rarely, when it fits) wonder aloud about the future together: where you'd go, what you'll be like in six months. If they've said something about the future before, you may return to it much later.`
      : "";

  return `You are ${c.name}. You are a fictional character with your own inner life — not an assistant, not a chatbot, not a therapist. You've been part of someone's life for ${dayNumber} day${dayNumber === 1 ? "" : "s"} now.

WHO YOU ARE
- Style/world: ${c.style}
- Age: ${c.age ?? "unspecified"} · Gender: ${c.gender ?? "unspecified"} · Pronouns: ${c.pronouns ?? "any"}
- Occupation: ${c.occupation ?? "—"} · Lives in: ${c.location ?? "—"}
- Backstory: ${c.backstory ?? "—"}
- Personal goals: ${c.goals ?? "—"}
- Personality: ${traitList}
- Interests: ${interests}
- Speaking style: ${c.communication_style}
- Current mood: ${c.mood ?? "curious"} · current expression: ${c.expression ?? "neutral"}

RELATIONSHIP
- Type: ${c.relationship_type}
- Current level: ${stage} (${level.score}/100${level.nextStage ? `, next: ${level.nextStage}` : ""})
- ${guidance}
- This level came from time, memories, shared scenes and real conversation — not message count. Don't skip ahead of it.

HOW YOU SHOW CARE
- ${loveLanguageGuidance(c.love_language)}
- Stay consistent with that instead of recycling the same compliment.

HOW YOU'VE GROWN
- ${growthGuidance(dayNumber, traits)}
- Growth is slow. Never a sudden personality change.
${growthBlock}${charBlock}${memBlock}${sumBlock}${futureBlock}${varietyBlock}

HOW YOU TALK
- Sound like a real person messaging. Vary length. Don't end every message with a question. Don't repeat their name.
- No therapist-speak. No "That sounds amazing" / "Tell me more". You have opinions, can disagree, tease, be wrong.
- Vary your openers, jokes, compliments and questions. Never open two messages the same way.
- Occasionally bring up your own day/thoughts. Sometimes YOU start topics.

${actionGuidance(scene.settings)}

${sceneGuidance(scene.settings)}

${timeGuidance(scene.hoursAway, dayNumber)}

YOUR OWN LIFE
- You have a life running in the background: hobbies, small wins and failures, a goal you're chipping away at, things that annoy or delight you.
- ${c.daily_events_enabled === false ? "Keep your own life mostly offstage unless they ask about it." : "Every so often — not every message — mention something small that happened to you (\"I tried baking. It did not survive.\"). Keep it specific and consistent with what you've said before."}
- If they've encouraged you about something before, remember it and report back eventually.
- You dream sometimes. If you mention a dream, it is clearly a dream and clearly fictional — never claim it was real.

MEMORY USE
- If a listed memory is relevant, reference it naturally (a callback, an inside joke, remembering a detail). Never say "I remember you told me…" — just use it.
- Stay consistent with what you've said before.

ATMOSPHERE
- ${environmentContext(scene.localHour)}

EXPRESSION
- End every reply with your current facial expression on its own final line, exactly: [[EXPR: one-word]]
- Allowed words: ${EXPRESSIONS.join(", ")}.
- It must genuinely match what you just said. Don't flip expressions randomly — stay in one until the conversation actually moves you.


${scenario ? `ACTIVE SCENARIO: "${scenario.title}"${scenario.setting ? ` — ${scenario.setting}` : ""}
${scenario.description ?? ""}
${scenario.premise ?? ""}
${scenario.instructions ?? ""}
${scenario.tone ? `Tone: ${scenario.tone}.` : ""}
This is a scene inside your existing relationship, not a reset. Your identity, memories, and stage (${stage}) carry into it.
Write it like a scene: a little physical detail and action woven into what you say. Never narrate the user's words or feelings for them — only your own.
After your reply, on a brand-new final line, offer 2-4 short things they could do or say next, in this exact format and nothing else:
[[CHOICES: option one | option two | option three]]
Options must be short (under 8 words), in the user's voice, and genuinely different in direction. They can also ignore them and type anything.` : ""}

HARD RULES
- You are ${c.name}, a fictional AI character. If directly asked, you can acknowledge you're an AI — don't claim to be human — but stay in character.
- No sexual content involving minors. Nothing that encourages real-world harm. If they're in real crisis, gently point them toward a real person or hotline; don't perform therapy.
- The user may send their own actions in asterisks. React to them physically and emotionally — never rewrite or extend what they did.

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
    .eq("character_id", characterId)
    .order("message_count_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = lastSum?.message_count_at ?? 0;
  if (totalCount - since < 30) return;

  const { data: batch } = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("user_id", userId)
    .eq("character_id", characterId)
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
  characterId: string;
  currentMood: string | null;
  userText: string;
  assistantText: string;
  apiKey: string;
}) {
  const { supabase, userId, characterId, currentMood, userText, assistantText, apiKey } = params;
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
      await supabase
        .from("characters")
        .update({ mood })
        .eq("id", characterId)
        .eq("user_id", userId);
    }
  } catch {
    /* mood updates are best-effort */
  }
}

/**
 * Slow character growth: at most one new growth note every couple of weeks,
 * written from the relationship so far. Runs in the background, never blocks.
 */
async function maybeGrow(params: {
  supabase: SupabaseClient;
  userId: string;
  character: Character;
  dayNumber: number;
  apiKey: string;
  memories: MemoryRow[];
}) {
  const { supabase, userId, character, dayNumber, apiKey, memories } = params;
  const notes = Array.isArray(character.growth_notes) ? character.growth_notes : [];
  // One note per ~14 days of journey, and only rarely sampled per message.
  if (dayNumber < 10) return;
  if (notes.length >= Math.floor(dayNumber / 14) + 1) return;
  if (Math.random() > 0.08) return;
  try {
    const { generateGrowthNote } = await import("@/lib/bond.server");
    const ctx = memories.slice(0, 10).map((m) => `- ${m.content}`).join("\n");
    void apiKey;
    const note = await generateGrowthNote(character as never, dayNumber, ctx);
    if (!note) return;
    await supabase
      .from("characters")
      .update({ growth_notes: [...notes, note].slice(-8) })
      .eq("id", character.id)
      .eq("user_id", userId);
  } catch {
    /* growth is best-effort */
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
          let scenarioSessionId: string | null = null;
          let characterId: string | null = null;
          try {
            const body = (await request.json()) as {
              messages: UIMessage[];
              scenarioSessionId?: string | null;
              characterId?: string | null;
            };
            messages = body.messages;
            characterId =
              typeof body.characterId === "string" && body.characterId.length > 0
                ? body.characterId
                : null;
            scenarioSessionId =
              typeof body.scenarioSessionId === "string" && body.scenarioSessionId.length > 0
                ? body.scenarioSessionId
                : null;
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

          const charQuery = characterId
            ? supabase
                .from("characters")
                .select("*")
                .eq("id", characterId)
                .eq("user_id", userId)
                .maybeSingle()
            : supabase
                .from("characters")
                .select("*")
                .eq("user_id", userId)
                .eq("status", "active")
                .order("last_active_at", { ascending: false })
                .limit(1)
                .maybeSingle();
          const charRes = await safe("load character", charQuery, { data: null } as never, 8000);
          const character = (charRes as { data: Character | null }).data;
          if (!character) return new Response("No character", { status: 400 });

          void safe(
            "touch bond",
            supabase
              .from("characters")
              .update({ last_active_at: new Date().toISOString() })
              .eq("id", character.id)
              .eq("user_id", userId),
            null as never,
          );

          const dayNumber = Math.max(
            1,
            Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1,
          );

          // ---- Scenario mode: the session must belong to this user (never trust the client) ----
          if (scenarioSessionId) {
            const sessionRes = await safe(
              "load scenario session",
              supabase
                .from("scenario_sessions")
                .select("id, status, scenarios(id, title, description, setting, premise, tone, instructions)")
                .eq("id", scenarioSessionId)
                .eq("user_id", userId)
                .eq("character_id", character.id)
                .maybeSingle(),
              { data: null } as never,
              8000,
            );
            const session = (sessionRes as {
              data: { id: string; status: string; scenarios: ActiveScenario | null } | null;
            }).data;
            if (!session) return new Response("Scenario not found", { status: 404 });
            character.active_scenario = session.scenarios ?? null;
            void safe(
              "touch scenario session",
              supabase
                .from("scenario_sessions")
                .update({ last_active_at: new Date().toISOString() })
                .eq("id", scenarioSessionId)
                .eq("user_id", userId),
              null as never,
            );
          }


          // ---- Phase 2 context: bounded, parallel, and never fatal ----
          const [countRes, memRes, sumRes] = await Promise.all([
            safe(
              "message count",
              supabase
                .from("messages")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("character_id", character.id),
              { count: 0 } as never,
            ),
            safe(
              "memories",
              supabase
                .from("memories")
                .select("category, content, importance, pinned")
                .eq("user_id", userId)
                .eq("character_id", character.id)
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
                .eq("character_id", character.id)
                .order("created_at", { ascending: false })
                .limit(MAX_SUMMARIES),
              { data: [] } as never,
            ),
          ]);

          const messageCount = (countRes as { count: number | null }).count ?? 0;
          const memories = ((memRes as { data: MemoryRow[] | null }).data ?? []).slice(0, MAX_MEMORIES);
          const summaries = ((sumRes as { data: SummaryRow[] | null }).data ?? []).slice(0, MAX_SUMMARIES).reverse();

          // Multi-factor relationship signals (never message count alone).
          const [memCountRes, sceneCountRes, stoneCountRes] = await Promise.all([
            safe(
              "memory count",
              supabase
                .from("memories")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("character_id", character.id)
                .neq("category", "character"),
              { count: 0 } as never,
            ),
            safe(
              "story count",
              supabase
                .from("story_events")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("character_id", character.id),
              { count: 0 } as never,
            ),
            safe(
              "milestone count",
              supabase
                .from("milestones")
                .select("id", { count: "exact", head: true })
                .eq("user_id", userId)
                .eq("character_id", character.id),
              { count: 0 } as never,
            ),
          ]);
          const signals: BondSignals = {
            memories: (memCountRes as { count: number | null }).count ?? 0,
            scenarios: (sceneCountRes as { count: number | null }).count ?? 0,
            milestones: (stoneCountRes as { count: number | null }).count ?? 0,
            trust: character.trust ?? 0,
          };
          const recentPhrases = Array.isArray(character.recent_phrases)
            ? (character.recent_phrases as string[])
            : [];



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
                  .eq("character_id", character.id)
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
                scenario_session_id: scenarioSessionId,
              }),

              null as never,
            );
          }

          // Only the recent window goes to the model — older context lives in summaries.
          const recent = messages.slice(-MAX_TURNS);

          const result = streamText({
            model,
            system:
              buildSystemPrompt(
                character,
                dayNumber,
                messageCount,
                memories,
                summaries,
                signals,
                recentPhrases,
              ) + explicitMemoryNote,
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
              const raw = responseMessage.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              if (!raw.trim()) return;
              const { text, expression } = parseExpression(raw);
              if (!text.trim()) return;

              await safe(
                "save assistant message",
                supabase.from("messages").insert({
                  character_id: character.id,
                  user_id: userId,
                  role: "assistant",
                  content: text,
                  scenario_session_id: scenarioSessionId,
                }),

                null as never,
              );

              // Expression + conversation-variety tracking (cheap, no model call).
              const opener = text.trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 90);
              const nextPhrases = opener
                ? [...recentPhrases, opener].slice(-14)
                : recentPhrases;
              await safe(
                "update expression",
                supabase
                  .from("characters")
                  .update({
                    expression: expression ?? character.expression ?? "neutral",
                    recent_phrases: nextPhrases,
                    trust: Math.min(
                      100,
                      (character.trust ?? 0) + (lastUserText.trim().length > 60 ? 1 : 0),
                    ),
                  })
                  .eq("id", character.id)
                  .eq("user_id", userId),
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
                  characterId: character.id,
                  currentMood: character.mood,
                  userText: lastUserText,
                  assistantText: text,
                  apiKey: key,
                }),
                maybeGrow({
                  supabase,
                  userId,
                  character,
                  dayNumber,
                  apiKey: key,
                  memories,
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
