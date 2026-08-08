// Client-safe primitives for the immersive scene layer: character actions,
// scene state, quick interactions and the natural (never expiring) journey.

// -------------------- Journey time --------------------

/** Days you have known each other. Uncapped — the journey continues past 365. */
export function daysTogether(startDate: string | Date): number {
  const start = new Date(startDate).getTime();
  return Math.max(1, Math.floor((Date.now() - start) / 86_400_000) + 1);
}

export function journeyYear(days: number): number {
  return Math.floor((days - 1) / 365) + 1;
}

/** Human phrasing that never sounds like a countdown. */
export function journeyLabel(days: number): string {
  if (days === 1) return "First day together";
  if (days < 14) return `${days} days together`;
  if (days < 60) {
    const w = Math.floor(days / 7);
    return `${w} week${w === 1 ? "" : "s"} together`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} month${m === 1 ? "" : "s"} together`;
  }
  const years = Math.floor(days / 365);
  const rest = days % 365;
  const months = Math.floor(rest / 30);
  if (months === 0) return `${years} year${years === 1 ? "" : "s"} together`;
  return `${years} year${years === 1 ? "" : "s"}, ${months} month${months === 1 ? "" : "s"} together`;
}

export const MILESTONE_DAYS = [1, 7, 30, 100, 180, 250, 365, 500, 730] as const;

export function nextMilestone(days: number): { day: number; away: number } | null {
  const next = MILESTONE_DAYS.find((d) => d > days);
  if (!next) {
    // After the last named milestone, celebrate each anniversary.
    const nextYear = (journeyYear(days) ) * 365 + 1;
    return { day: nextYear, away: nextYear - days };
  }
  return { day: next, away: next - days };
}

export function absenceLabel(hours: number): string | null {
  if (hours < 12) return null;
  if (hours < 36) return "a day";
  const d = Math.round(hours / 24);
  if (d < 7) return `${d} days`;
  if (d < 30) {
    const w = Math.round(d / 7);
    return `${w} week${w === 1 ? "" : "s"}`;
  }
  const m = Math.round(d / 30);
  return `${m} month${m === 1 ? "" : "s"}`;
}

// -------------------- Scene state --------------------

const SCENE_TAG = /\[\[\s*SCENE\s*:\s*([^\]]{1,120})\]\]/i;

export function parseScene(text: string): { text: string; scene: string | null } {
  const m = text.match(SCENE_TAG);
  const stripped = text.replace(new RegExp(SCENE_TAG.source, "gi"), "").trimEnd();
  const scene = m?.[1]?.trim().slice(0, 120) || null;
  return { text: stripped, scene };
}

// -------------------- Character actions --------------------

export interface MessageSegment {
  type: "text" | "action";
  value: string;
}

/**
 * Splits a reply into spoken text and *physical actions*. Actions are written
 * by the model between asterisks, e.g. `*leans back on the bench*`.
 */
export function splitActions(text: string): MessageSegment[] {
  const out: MessageSegment[] = [];
  const re = /\*([^*\n]{2,180})\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index);
    if (before.trim()) out.push({ type: "text", value: before.trim() });
    out.push({ type: "action", value: m[1].trim() });
    last = m.index + m[0].length;
  }
  const tail = text.slice(last);
  if (tail.trim()) out.push({ type: "text", value: tail.trim() });
  return out.length ? out : [{ type: "text", value: text }];
}

// -------------------- Quick interactions --------------------

export interface QuickInteraction {
  label: string;
  /** What is actually sent to the character. */
  send: string;
}

const BASE_QUICK: QuickInteraction[] = [
  { label: "How are you?", send: "How are you feeling right now?" },
  { label: "Tell me something", send: "Tell me something that happened to you today." },
  { label: "What are you doing?", send: "What are you up to right now?" },
];

const ROMANTIC_QUICK: QuickInteraction[] = [
  { label: "Hold hands", send: "*reaches over and takes your hand*" },
  { label: "Hug", send: "*pulls you into a hug*" },
];

const CLOSE_QUICK: QuickInteraction[] = [
  { label: "Cheer them up", send: "*nudges you gently* Come on, tell me what's wrong." },
  { label: "Tease", send: "*grins* You're ridiculous, you know that?" },
];

/**
 * Context-aware suggestions: they change with the hour, the closeness of the
 * bond and how the character is currently feeling.
 */
export function quickInteractions(opts: {
  hour?: number;
  stageIndex?: number;
  romantic?: boolean;
  expression?: string | null;
}): QuickInteraction[] {
  const hour = opts.hour ?? new Date().getHours();
  const list: QuickInteraction[] = [];

  if (hour < 11) list.push({ label: "Good morning", send: "Morning. Sleep okay?" });
  else if (hour >= 22 || hour < 5)
    list.push({ label: "Goodnight", send: "It's late. I should sleep soon." });
  else list.push({ label: "Check in", send: "Hey — what's on your mind?" });

  if ((opts.expression === "sad" || opts.expression === "crying") && (opts.stageIndex ?? 0) >= 2) {
    list.push({ label: "Comfort them", send: "*sits closer* Talk to me. I'm not going anywhere." });
  }
  if ((opts.stageIndex ?? 0) >= 3) list.push(...CLOSE_QUICK);
  if (opts.romantic && (opts.stageIndex ?? 0) >= 4) list.push(...ROMANTIC_QUICK);

  list.push(...BASE_QUICK);
  return list.slice(0, 6);
}
