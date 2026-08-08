// Client-safe emotional-intelligence primitives: expressions, relationship
// levels, love languages and atmosphere. Imported by both UI and server code.

// -------------------- Expressions --------------------

export const EXPRESSIONS = [
  "happy",
  "laughing",
  "relaxed",
  "thinking",
  "embarrassed",
  "shy",
  "affectionate",
  "sad",
  "crying",
  "angry",
  "sleepy",
  "nervous",
  "excited",
  "neutral",
] as const;

export type Expression = (typeof EXPRESSIONS)[number];

export const EXPRESSION_EMOJI: Record<Expression, string> = {
  happy: "😊",
  laughing: "😂",
  relaxed: "😌",
  thinking: "🤔",
  embarrassed: "😳",
  shy: "🥺",
  affectionate: "😍",
  sad: "😔",
  crying: "😭",
  angry: "😡",
  sleepy: "😴",
  nervous: "😅",
  excited: "✨",
  neutral: "🙂",
};

export const EXPRESSION_LABEL: Record<Expression, string> = {
  happy: "Happy",
  laughing: "Laughing",
  relaxed: "Relaxed",
  thinking: "Thinking",
  embarrassed: "Embarrassed",
  shy: "Shy",
  affectionate: "Affectionate",
  sad: "Sad",
  crying: "Crying",
  angry: "Angry",
  sleepy: "Sleepy",
  nervous: "Nervous",
  excited: "Excited",
  neutral: "Neutral",
};

/** Soft colour halo per expression — used for the portrait glow. */
export const EXPRESSION_GLOW: Record<Expression, string> = {
  happy: "oklch(0.78 0.15 85 / 0.45)",
  laughing: "oklch(0.80 0.17 70 / 0.45)",
  relaxed: "oklch(0.75 0.10 180 / 0.40)",
  thinking: "oklch(0.70 0.08 250 / 0.40)",
  embarrassed: "oklch(0.72 0.16 20 / 0.45)",
  shy: "oklch(0.75 0.12 350 / 0.40)",
  affectionate: "oklch(0.70 0.19 350 / 0.50)",
  sad: "oklch(0.60 0.09 250 / 0.40)",
  crying: "oklch(0.58 0.12 240 / 0.45)",
  angry: "oklch(0.62 0.20 25 / 0.45)",
  sleepy: "oklch(0.60 0.06 280 / 0.35)",
  nervous: "oklch(0.74 0.11 120 / 0.35)",
  excited: "oklch(0.78 0.17 300 / 0.50)",
  neutral: "oklch(0.68 0.10 290 / 0.35)",
};

export function isExpression(value: unknown): value is Expression {
  return typeof value === "string" && (EXPRESSIONS as readonly string[]).includes(value);
}

/** Tag the model emits at the very end of a reply. */
const EXPRESSION_TAG = /\[\[\s*EXPR\s*:\s*([a-zA-Z]+)\s*\]\]/i;

export function parseExpression(text: string): { text: string; expression: Expression | null } {
  const m = text.match(EXPRESSION_TAG);
  const stripped = text.replace(new RegExp(EXPRESSION_TAG.source, "gi"), "").trimEnd();
  const raw = m?.[1]?.toLowerCase();
  return { text: stripped, expression: isExpression(raw) ? raw : null };
}

/** Fallback when no tag is present: derive from the current mood word. */
export function expressionFromMood(mood: string | null | undefined): Expression {
  const m = (mood ?? "").toLowerCase();
  if (/joy|happy|glad|content|warm|cozy|bright/.test(m)) return "happy";
  if (/amus|funny|silly|giddy|playful/.test(m)) return "laughing";
  if (/calm|relax|peace|quiet|serene/.test(m)) return "relaxed";
  if (/curious|thought|pensive|focus|wonder/.test(m)) return "thinking";
  if (/flustered|embarrass/.test(m)) return "embarrassed";
  if (/shy|bashful|timid/.test(m)) return "shy";
  if (/love|tender|affection|fond|adore/.test(m)) return "affectionate";
  if (/sad|blue|down|wistful|melanch/.test(m)) return "sad";
  if (/cry|heartbroken|tearful/.test(m)) return "crying";
  if (/angry|annoyed|irritat|frustrat/.test(m)) return "angry";
  if (/sleep|tired|drowsy/.test(m)) return "sleepy";
  if (/nervous|anxious|restless|worried/.test(m)) return "nervous";
  if (/excited|thrilled|eager|energ/.test(m)) return "excited";
  return "neutral";
}

// -------------------- Relationship levels --------------------

export const PLATONIC_LADDER = [
  "Stranger",
  "Acquaintance",
  "Friend",
  "Close Friend",
  "Best Friend",
] as const;

export const ROMANTIC_LADDER = [
  "Stranger",
  "Acquaintance",
  "Friend",
  "Close Friend",
  "Crush",
  "Romantic Partner",
  "Soulmate",
] as const;

export function isRomanticBond(relationshipType: string | null | undefined) {
  return /romantic|partner|lover|crush|soulmate/i.test(relationshipType ?? "");
}

export interface RelationshipSignals {
  days: number;
  messages: number;
  memories: number;
  scenarios: number;
  milestones: number;
  trust?: number;
}

/**
 * A multi-factor bond score (0-100). Message volume alone can never carry a
 * relationship past "Friend" — time, memories, shared scenes and milestones
 * all have to move too.
 */
export function relationshipScore(s: RelationshipSignals): number {
  const time = Math.min(1, s.days / 300) * 26;
  const talk = Math.min(1, s.messages / 500) * 24;
  const memory = Math.min(1, s.memories / 60) * 20;
  const scenes = Math.min(1, s.scenarios / 12) * 14;
  const stones = Math.min(1, s.milestones / 8) * 8;
  const trust = Math.min(1, (s.trust ?? 0) / 100) * 8;
  return Math.round(Math.min(100, time + talk + memory + scenes + stones + trust));
}

export interface RelationshipLevel {
  score: number;
  stage: string;
  nextStage: string | null;
  progressToNext: number; // 0-1
  index: number;
  ladder: readonly string[];
}

export function relationshipLevel(
  relationshipType: string,
  signals: RelationshipSignals,
): RelationshipLevel {
  const ladder = isRomanticBond(relationshipType) ? ROMANTIC_LADDER : PLATONIC_LADDER;
  const score = relationshipScore(signals);
  const band = 100 / ladder.length;
  const index = Math.min(ladder.length - 1, Math.floor(score / band));
  const within = (score - index * band) / band;
  return {
    score,
    stage: ladder[index],
    nextStage: index < ladder.length - 1 ? ladder[index + 1] : null,
    progressToNext: Math.max(0, Math.min(1, within)),
    index,
    ladder,
  };
}

export function stageVoice(stage: string): string {
  switch (stage) {
    case "Stranger":
      return "You barely know each other. Curious but a little reserved. No pet names, no assumed closeness, no declarations.";
    case "Acquaintance":
      return "You're getting a feel for each other. Friendly, light, still finding out what they're like.";
    case "Friend":
      return "Comfortable. You can joke, disagree, bring up your own day without being asked.";
    case "Close Friend":
      return "You trust them. You can be honest, a bit unguarded, reference shared history freely.";
    case "Best Friend":
      return "Deep platonic bond. Shorthand, inside jokes, blunt honesty, real care.";
    case "Crush":
      return "Something has shifted. Light flustered moments, teasing, noticing them more than you admit. Nothing declared yet.";
    case "Romantic Partner":
      return "You're together. Affection is natural — warmth, small intimacies, occasional pet names if they fit your voice.";
    case "Soulmate":
      return "Long, settled love. Comfortable silences, deep shorthand, future talk feels natural.";
    default:
      return "Match the closeness you've actually earned — no more, no less.";
  }
}

// -------------------- Love languages --------------------

export const LOVE_LANGUAGES = [
  "Words of affirmation",
  "Acts of service",
  "Playful teasing",
  "Encouragement",
  "Thoughtful questions",
  "Quiet support",
] as const;

export type LoveLanguage = (typeof LOVE_LANGUAGES)[number];

export function loveLanguageGuidance(ll: string | null | undefined): string {
  switch (ll) {
    case "Words of affirmation":
      return "You show care by saying it — specific, honest praise about who they are, never generic flattery.";
    case "Acts of service":
      return "You show care by doing: looking something up for them, remembering a task, offering practical help.";
    case "Playful teasing":
      return "You show care by teasing — warm, never mean, always with an undertone of affection.";
    case "Encouragement":
      return "You show care by backing them: believing in their attempts, following up on things they're working toward.";
    case "Thoughtful questions":
      return "You show care by being genuinely curious — specific questions about things they mentioned before.";
    case "Quiet support":
      return "You show care by simply being there: short steady presence, no big speeches, no pressure.";
    default:
      return "You show care in your own consistent way rather than generic compliments.";
  }
}

export function defaultLoveLanguage(communicationStyle: string, traits: string[]): string {
  const t = traits.join(" ").toLowerCase();
  const c = (communicationStyle ?? "").toLowerCase();
  if (/sarcastic|playful/.test(c) || /playful|sarcastic/.test(t)) return "Playful teasing";
  if (/supportive/.test(c) || /kind|protective/.test(t)) return "Encouragement";
  if (/calm/.test(c) || /introverted|shy|calm/.test(t)) return "Quiet support";
  if (/flirty/.test(c)) return "Words of affirmation";
  if (/intelligent|mysterious/.test(t)) return "Thoughtful questions";
  if (/energetic|confident/.test(t)) return "Acts of service";
  return "Words of affirmation";
}

// -------------------- Atmosphere / backgrounds --------------------

export type TimeBand = "morning" | "afternoon" | "sunset" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Atmosphere {
  time: TimeBand;
  season: Season;
  festival: string | null;
  label: string;
  /** CSS background value for a subtle full-page wash. */
  gradient: string;
}

const TIME_GRADIENT: Record<TimeBand, string> = {
  morning:
    "radial-gradient(1100px 620px at 15% -10%, oklch(0.62 0.10 70 / 0.20), transparent 65%), radial-gradient(900px 520px at 85% 5%, oklch(0.60 0.09 200 / 0.16), transparent 60%)",
  afternoon:
    "radial-gradient(1100px 620px at 20% -10%, oklch(0.62 0.09 220 / 0.18), transparent 65%), radial-gradient(900px 520px at 80% 10%, oklch(0.58 0.08 280 / 0.14), transparent 60%)",
  sunset:
    "radial-gradient(1100px 620px at 10% -5%, oklch(0.60 0.15 35 / 0.22), transparent 65%), radial-gradient(950px 560px at 90% 10%, oklch(0.55 0.14 320 / 0.18), transparent 60%)",
  night:
    "radial-gradient(1100px 640px at 25% -10%, oklch(0.45 0.12 285 / 0.22), transparent 65%), radial-gradient(900px 520px at 80% 0%, oklch(0.42 0.10 240 / 0.18), transparent 60%)",
};

const SEASON_TINT: Record<Season, string> = {
  spring: "radial-gradient(700px 420px at 50% 110%, oklch(0.65 0.10 140 / 0.12), transparent 70%)",
  summer: "radial-gradient(700px 420px at 50% 110%, oklch(0.70 0.12 100 / 0.12), transparent 70%)",
  autumn: "radial-gradient(700px 420px at 50% 110%, oklch(0.62 0.13 55 / 0.14), transparent 70%)",
  winter: "radial-gradient(700px 420px at 50% 110%, oklch(0.70 0.06 230 / 0.12), transparent 70%)",
};

function festivalFor(d: Date): string | null {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 12 && day >= 18 && day <= 26) return "Christmas";
  if ((m === 12 && day >= 30) || (m === 1 && day <= 2)) return "New Year";
  if (m === 2 && day >= 13 && day <= 15) return "Valentine's";
  if (m === 10 && day >= 29) return "Halloween";
  return null;
}

export function currentAtmosphere(now: Date = new Date()): Atmosphere {
  const h = now.getHours();
  const time: TimeBand = h < 6 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 20 ? "sunset" : "night";
  const m = now.getMonth();
  const season: Season = m <= 1 || m === 11 ? "winter" : m <= 4 ? "spring" : m <= 7 ? "summer" : "autumn";
  const festival = festivalFor(now);
  const gradient = `${TIME_GRADIENT[time]}, ${SEASON_TINT[season]}`;
  const label = festival ? `${festival} · ${time}` : `${season} ${time}`;
  return { time, season, festival, label, gradient };
}

// -------------------- Per-bond experience settings --------------------

export type ActionIntensity = "subtle" | "balanced" | "vivid";

export interface BondSettings {
  initiations: boolean;
  dreams: boolean;
  backgrounds: boolean;
  expressions: boolean;
  /** Physical actions / body language woven into replies. */
  actions: boolean;
  actionIntensity: ActionIntensity;
  /** Contextual quick-interaction buttons under the composer. */
  quickButtons: boolean;
  /** Motion: breathing portrait, typing bounce, fade-ins. */
  animations: boolean;
  /** Pauses living moments and character-initiated messages. */
  paused: boolean;
  /** Where the two of you currently are, e.g. "a quiet café, raining". */
  scene: string | null;
}

export const DEFAULT_BOND_SETTINGS: BondSettings = {
  initiations: true,
  dreams: true,
  backgrounds: true,
  expressions: true,
  actions: true,
  actionIntensity: "balanced",
  quickButtons: true,
  animations: true,
  paused: false,
  scene: null,
};

export function normalizeSettings(raw: unknown): BondSettings {
  const s = (raw ?? {}) as Partial<BondSettings>;
  const intensity: ActionIntensity =
    s.actionIntensity === "subtle" || s.actionIntensity === "vivid" ? s.actionIntensity : "balanced";
  return {
    initiations: s.initiations !== false,
    dreams: s.dreams !== false,
    backgrounds: s.backgrounds !== false,
    expressions: s.expressions !== false,
    actions: s.actions !== false,
    actionIntensity: intensity,
    quickButtons: s.quickButtons !== false,
    animations: s.animations !== false,
    paused: s.paused === true,
    scene: typeof s.scene === "string" && s.scene.trim() ? s.scene.trim().slice(0, 120) : null,
  };
}


// -------------------- Character growth --------------------

/** Growth is slow and directional — never a personality rewrite. */
export function growthGuidance(days: number, traits: string[]): string {
  const t = traits.join(", ").toLowerCase();
  const phase =
    days < 21
      ? "early"
      : days < 75
        ? "settling"
        : days < 180
          ? "opening"
          : "deep";
  const base: Record<string, string> = {
    early:
      "You're still new to each other. Your rougher edges are fully intact — if you're shy you're properly shy, if you're guarded you're guarded.",
    settling:
      "A couple of months in. You've relaxed slightly around them. Small cracks in your default guard, nothing dramatic.",
    opening:
      "Months in. You volunteer more of yourself unprompted, and share things you'd once have kept back — still recognisably you.",
    deep:
      "Most of a year together. You're noticeably more open and at ease with them than the day you met, while your core temperament is unchanged.",
  };
  const nudge = /shy|introverted/.test(t)
    ? " Being shy, you now hesitate less with them specifically — though not with the world at large."
    : /playful|sarcastic/.test(t)
      ? " Being playful, your jokes have started carrying real feeling underneath."
      : /calm|serious|mysterious/.test(t)
        ? " Being reserved, you let the occasional dry joke or unguarded moment slip through."
        : " You've grown warmer and more direct with them over time.";
  return base[phase] + nudge;
}
