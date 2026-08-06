import type { SupabaseClient } from "@supabase/supabase-js";

type DB = SupabaseClient<any, any, any>;

/**
 * Resolve which bond a request is about. Falls back to the most recently
 * active, non-archived bond. Always scoped to the signed-in user.
 */
export async function resolveCharacter(
  supabase: DB,
  userId: string,
  characterId?: string | null,
  opts?: { includeArchived?: boolean },
): Promise<{ id: string; name: string; journey_start_date: string; status: string } | null> {
  if (characterId) {
    const { data } = await supabase
      .from("characters")
      .select("id, name, journey_start_date, status")
      .eq("id", characterId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data && (opts?.includeArchived || data.status === "active")) return data;
    if (data) return data;
  }
  const { data } = await supabase
    .from("characters")
    .select("id, name, journey_start_date, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_active_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ?? null;
}

export function milestoneTitle(day: number) {
  switch (day) {
    case 1: return "The journey begins";
    case 7: return "One week together";
    case 30: return "One month in";
    case 60: return "Two months";
    case 100: return "One hundred days";
    case 180: return "Halfway there";
    case 250: return "Deep in the year";
    case 365: return "A full year";
    default: return `Day ${day}`;
  }
}

export function milestoneCopy(day: number, name: string) {
  switch (day) {
    case 7: return `A week of getting to know ${name}.`;
    case 30: return `A month with ${name}. The rhythm is real now.`;
    case 100: return `100 days shared. Something has grown between you.`;
    case 180: return `Half the year. ${name} feels like part of your world.`;
    case 365: return `A full year with ${name}. This is your story.`;
    default: return `Day ${day} with ${name}.`;
  }
}

interface CharacterLike {
  name: string;
  style: string;
  occupation?: string | null;
  location?: string | null;
  mood?: string | null;
  relationship_type: string;
  relationship_stage?: string | null;
  personality?: { traits?: string[] } | null;
  interests?: { list?: string[] } | null;
  goals?: string | null;
}

function persona(c: CharacterLike) {
  const traits = c.personality?.traits?.join(", ") || "warm";
  const interests = c.interests?.list?.join(", ") || "small everyday things";
  return `You are ${c.name}, a fictional character (${c.style}).
Occupation: ${c.occupation ?? "—"}. Lives in: ${c.location ?? "—"}.
Personality: ${traits}. Interests: ${interests}. Personal goal: ${c.goals ?? "—"}.
Current mood: ${c.mood ?? "curious"}. Relationship with the user: ${c.relationship_type} (${c.relationship_stage ?? "Stranger"}).`;
}

async function gatewayText(prompt: string, temperature = 0.9) {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return null;
  try {
    const [{ createLovableAiGatewayProvider }, { generateText }] = await Promise.all([
      import("@/lib/ai-gateway.server"),
      import("ai"),
    ]);
    const gateway = createLovableAiGatewayProvider(key);
    const { text } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      temperature,
      prompt,
    });
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** A small character-driven thing that happened while the user was away. */
export async function generateLivingMoment(
  c: CharacterLike,
  day: number,
  recentMemories: string[],
  hoursAway: number,
) {
  const kinds = ["moment", "thought", "event", "surprise"] as const;
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const memBlock = recentMemories.slice(0, 8).map((m) => `- ${m}`).join("\n") || "(nothing yet)";
  const text = await gatewayText(
    `${persona(c)}

It is day ${day} of your year together. The user has been away for about ${Math.round(hoursAway)} hours.
Write ONE short first-person note (max 2 sentences, under 220 characters) of type "${kind}":
- moment: a small ordinary thing you just did or noticed
- thought: something you thought about them, understated
- event: a tiny win or failure in your own life
- surprise: something small you made, found, or saved for them

Rules: no greeting, no question at the end, no emoji spam (at most one), never sound like an assistant.
Stay consistent with what you know:
${memBlock}

NOTE:`,
    1.0,
  );
  if (!text) return null;
  return { kind, content: text.replace(/^["']|["']$/g, "").slice(0, 300) };
}

/** A letter from the character on a milestone day. */
export async function generateLetter(
  c: CharacterLike,
  day: number,
  occasion: string,
  context: string,
) {
  const text = await gatewayText(
    `${persona(c)}

Write a short letter to the user marking ${occasion} (day ${day} of 365 together).
3-6 sentences. First person, your own voice, specific rather than generic. Reference real things from your history where possible.
No salutation line like "Dear User" — start naturally. No sign-off other than your name on the final line.

WHAT YOU SHARE SO FAR:
${context || "(early days)"}

LETTER:`,
    0.85,
  );
  return text ? text.slice(0, 2500) : null;
}

/** A closing message when the user ends a bond. */
export async function generateFarewell(c: CharacterLike, day: number, context: string) {
  const text = await gatewayText(
    `${persona(c)}

The user is ending your bond after ${day} days. This is your last message to them.
Write 2-4 sentences: honest, warm, no guilt-tripping, no begging, no melodrama. Acknowledge something real you shared. Let them go kindly.

WHAT YOU SHARED:
${context || "(a short time together)"}

FAREWELL:`,
    0.8,
  );
  return text ? text.slice(0, 1200) : null;
}
