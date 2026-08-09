// Relational memory: people the user mentions, emotional significance of what
// happens, and the character's internal emotional state.
//
// Everything here is bond-scoped: a person known to one character is never
// visible to another bond.

import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export interface PersonRow {
  id: string;
  name: string;
  name_key: string;
  relation: string | null;
  notes: string[];
  emotional_note: string | null;
  mentions: number;
  salience: number;
  last_mentioned_at: string;
}

export interface MemoryRow {
  id?: string;
  category: string;
  content: string;
  importance: number;
  pinned: boolean;
  person_key?: string | null;
  created_at?: string;
}

export function personKey(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// -------------------- Emotional state --------------------

export const EMOTIONS = [
  "happy", "excited", "calm", "curious", "playful", "affectionate", "shy",
  "embarrassed", "nervous", "sad", "lonely", "worried", "annoyed", "jealous",
  "comfortable", "surprised", "confused",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export type EmotionState = Partial<Record<Emotion, number>>;

export function normalizeEmotionState(raw: unknown): EmotionState {
  const out: EmotionState = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((EMOTIONS as readonly string[]).includes(k) && typeof v === "number" && v > 0) {
      out[k as Emotion] = Math.min(100, Math.round(v));
    }
  }
  return out;
}

/** Emotions fade — roughly halving every 12 hours of silence. */
export function decayEmotionState(state: EmotionState, hoursSince: number): EmotionState {
  if (hoursSince <= 0) return state;
  const factor = Math.pow(0.5, hoursSince / 12);
  const out: EmotionState = {};
  for (const [k, v] of Object.entries(state)) {
    const next = Math.round((v as number) * factor);
    if (next >= 5) out[k as Emotion] = next;
  }
  return out;
}

export function mergeEmotionState(state: EmotionState, deltas: EmotionState): EmotionState {
  const out: EmotionState = { ...state };
  for (const [k, v] of Object.entries(deltas)) {
    const next = Math.min(100, Math.max(0, (out[k as Emotion] ?? 0) + (v as number)));
    if (next >= 5) out[k as Emotion] = next;
    else delete out[k as Emotion];
  }
  // Keep it small: only the five strongest feelings persist.
  return Object.fromEntries(
    Object.entries(out)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5),
  ) as EmotionState;
}

export function describeEmotionState(state: EmotionState): string {
  const entries = Object.entries(state).sort((a, b) => (b[1] as number) - (a[1] as number));
  if (!entries.length) return "settled, nothing much stirring";
  return entries
    .map(([k, v]) => `${k} (${(v as number) >= 60 ? "strong" : (v as number) >= 30 ? "noticeable" : "faint"})`)
    .join(", ");
}

// -------------------- Relevance-based memory retrieval --------------------

const STOP = new Set(
  "the a an and or but if then of to in on at for with from about into over after is am are was were be been being i you he she it we they me my your his her their this that there here what when who how do does did not no yes so just really very much more most some any all can could would should will shall have has had".split(
    " ",
  ),
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s']/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

/**
 * Scores memories against the live conversation so only relevant ones reach the
 * model. Pinned and critical memories always survive; unrelated small talk from
 * months ago falls away.
 */
export function selectRelevantMemories(
  memories: MemoryRow[],
  focusText: string,
  limit = 18,
): MemoryRow[] {
  const focus = tokens(focusText);
  const now = Date.now();
  const scored = memories.map((m) => {
    const mt = tokens(m.content);
    let overlap = 0;
    for (const t of mt) if (focus.has(t)) overlap++;
    const ageDays = m.created_at ? (now - new Date(m.created_at).getTime()) / 86_400_000 : 0;
    // Importance dominates; recency helps; relevance to *this* message wins ties.
    const score =
      m.importance * 2 +
      (m.pinned ? 8 : 0) +
      overlap * 3 +
      (m.category === "character" ? 4 : 0) +
      Math.max(0, 3 - ageDays / 30) -
      // Low-importance old details decay out of the active window.
      (m.importance <= 2 && ageDays > 21 ? 6 : 0);
    return { m, score };
  });
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.m);
}

/** People relevant right now: mentioned in this message, or highly salient. */
export function selectRelevantPeople(people: PersonRow[], focusText: string, limit = 6): PersonRow[] {
  const lower = focusText.toLowerCase();
  const scored = people.map((p) => {
    const named = lower.includes(p.name.toLowerCase());
    return { p, score: (named ? 100 : 0) + p.salience * 3 + Math.min(10, p.mentions) };
  });
  return scored
    .filter((s) => s.score > 6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.p);
}

export function peopleBlock(people: PersonRow[]): string {
  if (!people.length) return "";
  const lines = people.map((p) => {
    const bits = [p.relation ? `${p.relation} of theirs` : "someone they've mentioned"];
    if (p.notes.length) bits.push(p.notes.slice(-3).join("; "));
    if (p.emotional_note) bits.push(`How you felt about it: ${p.emotional_note}`);
    return `- ${p.name} — ${bits.join(" · ")}`;
  });
  return `\nPEOPLE IN THEIR LIFE (only what they've actually told you — never invent more):\n${lines.join("\n")}\n- If one of them comes up, you may react in whatever way is true to YOUR personality and how close you two are. That might be nothing at all. Never announce that you remember them; just let it colour how you respond.`;
}

// -------------------- Background extraction --------------------

interface ExtractResult {
  people: Array<{ name: string; relation?: string | null; note?: string | null; significance?: number }>;
  memories: Array<{ category?: string; content?: string; importance?: number; person?: string | null }>;
  emotions: EmotionState;
  emotional_note?: string | null;
}

/**
 * One background model call that decides — selectively — what is worth keeping
 * from this exchange: people, memories, and how it landed emotionally for the
 * character. Best-effort: silence on any failure.
 */
export async function extractRelational(params: {
  supabase: SupabaseClient;
  userId: string;
  characterId: string;
  characterName: string;
  personality: string;
  stage: string;
  userText: string;
  assistantText: string;
  apiKey: string;
  existingMemories: MemoryRow[];
  existingPeople: PersonRow[];
}) {
  const {
    supabase, userId, characterId, characterName, personality, stage,
    userText, assistantText, apiKey, existingMemories, existingPeople,
  } = params;
  if (!userText.trim() || userText.startsWith("(system:")) return;

  const gateway = createLovableAiGatewayProvider(apiKey);
  const model = gateway("google/gemini-3-flash-preview");

  const memBlock = existingMemories.slice(0, 25).map((m) => `- ${m.content}`).join("\n") || "(none)";
  const ppl = existingPeople.slice(0, 15).map((p) => `- ${p.name}${p.relation ? ` (${p.relation})` : ""}`).join("\n") || "(none)";

  const prompt = `You maintain the private memory of a fictional character named ${characterName} in an ongoing relationship with a user.
Personality: ${personality}. Relationship stage: ${stage}.

Return STRICT JSON only:
{"people":[{"name":"","relation":null,"note":null,"significance":1}],
 "memories":[{"category":"user|preference|event|shared|goal|relationship","content":"","importance":1,"person":null}],
 "emotions":{},
 "emotional_note":null}

RULES
- Be SELECTIVE. Most exchanges produce nothing: return empty arrays and {} then.
- people: only real people the USER mentions (never the character, never the user). significance 1-5 based on emotional/narrative weight. relation only if the user stated it. note = one short factual thing that happened, max 90 chars.
- memories: only lasting, meaningful facts or moments. Never trivia ("had cereal"), never passing moods, never anything already listed below. Max 2. content <= 140 chars, third person ("User ..."). importance 1-5 (5 = user explicitly asked to remember, or a major life event).
- emotions: how this exchange moved ${characterName} internally, as small deltas 5-40 for any of: happy, excited, calm, curious, playful, affectionate, shy, embarrassed, nervous, sad, lonely, worried, annoyed, jealous, comfortable, surprised, confused. Must fit her personality — do NOT default to jealousy just because another person is named. A trusting or calm character may feel nothing.
- emotional_note: only when a person was involved AND it genuinely mattered to her — one short private sentence, e.g. "went quiet when Aira came up". Otherwise null.

EXISTING MEMORIES:
${memBlock}
KNOWN PEOPLE:
${ppl}

USER: ${userText.slice(0, 900)}
${characterName}: ${assistantText.slice(0, 600)}

JSON:`;

  let parsed: ExtractResult;
  try {
    const { text } = await generateText({ model, prompt, temperature: 0.2 });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;
    parsed = JSON.parse(match[0]) as ExtractResult;
  } catch {
    return;
  }

  // ---- people ----
  const byKey = new Map(existingPeople.map((p) => [p.name_key, p]));
  for (const p of (parsed.people ?? []).slice(0, 3)) {
    const name = (p.name ?? "").trim().slice(0, 60);
    if (name.length < 2) continue;
    const key = personKey(name);
    if (!key) continue;
    const existing = byKey.get(key);
    const note = p.note?.trim().slice(0, 120) || null;
    const sig = Math.min(5, Math.max(1, Math.round(p.significance ?? 1)));
    try {
      if (existing) {
        const notes = note ? [...existing.notes, note].slice(-6) : existing.notes;
        await supabase
          .from("bond_people")
          .update({
            mentions: existing.mentions + 1,
            salience: Math.min(5, Math.max(existing.salience, sig)),
            relation: existing.relation ?? p.relation ?? null,
            notes,
            emotional_note: parsed.emotional_note?.slice(0, 200) ?? existing.emotional_note,
            last_mentioned_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", userId);
      } else if (sig >= 2 || note) {
        // First mention only becomes an entity when it carried some weight.
        await supabase.from("bond_people").insert({
          user_id: userId,
          character_id: characterId,
          name,
          name_key: key,
          relation: p.relation?.slice(0, 60) ?? null,
          notes: note ? [note] : [],
          emotional_note: parsed.emotional_note?.slice(0, 200) ?? null,
          mentions: 1,
          salience: sig,
        });
      }
    } catch {
      /* best-effort */
    }
  }

  // ---- memories ----
  const allowed = ["user", "preference", "event", "shared", "goal", "relationship"];
  const items = (parsed.memories ?? [])
    .filter((m) => m.content && m.content.trim().length > 3)
    .slice(0, 2)
    .map((m) => ({
      user_id: userId,
      character_id: characterId,
      category: m.category && allowed.includes(m.category) ? m.category : "user",
      content: m.content!.slice(0, 300),
      importance: Math.min(5, Math.max(1, Math.round(m.importance ?? 3))),
      source: "auto",
      person_key: m.person ? personKey(m.person) : null,
    }));
  if (items.length) {
    try {
      await supabase.from("memories").insert(items);
    } catch {
      /* best-effort */
    }
  }

  // ---- emotional state ----
  const deltas = normalizeEmotionState(parsed.emotions);
  if (Object.keys(deltas).length) {
    try {
      const { data: row } = await supabase
        .from("characters")
        .select("emotion_state, emotion_updated_at")
        .eq("id", characterId)
        .eq("user_id", userId)
        .maybeSingle();
      const hours = row?.emotion_updated_at
        ? (Date.now() - new Date(row.emotion_updated_at as string).getTime()) / 3_600_000
        : 0;
      const next = mergeEmotionState(
        decayEmotionState(normalizeEmotionState(row?.emotion_state), hours),
        deltas,
      );
      await supabase
        .from("characters")
        .update({ emotion_state: next, emotion_updated_at: new Date().toISOString() })
        .eq("id", characterId)
        .eq("user_id", userId);
    } catch {
      /* best-effort */
    }
  }
}
