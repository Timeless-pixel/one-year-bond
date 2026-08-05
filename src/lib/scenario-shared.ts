// Client-safe helpers shared by the scenario UI and server functions.

export const SCENARIO_CATEGORIES = [
  { key: "romance", label: "Romance" },
  { key: "slice-of-life", label: "Slice of Life" },
  { key: "adventure", label: "Adventure" },
  { key: "emotional", label: "Emotional" },
  { key: "mystery", label: "Mystery" },
  { key: "fantasy", label: "Fantasy" },
  { key: "scifi", label: "Sci-Fi" },
  { key: "seasonal", label: "Seasonal" },
] as const;

export const SCENARIO_TYPE_LABEL: Record<string, string> = {
  quick: "Quick moment",
  episode: "Story episode",
  arc: "Story arc",
};

export interface ScenarioRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  scenario_type: string;
  duration_label: string;
  setting: string | null;
  premise: string | null;
  tone: string | null;
  best_for: string[];
  instructions: string | null;
  sort_order: number;
}

export function categoryLabel(key: string) {
  return SCENARIO_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

const ROMANTIC = /romantic|partner|lover|crush/i;

/** Contextual ranking — relationship type/stage, interests, and what they've already played. */
export function recommendScenarios(
  scenarios: ScenarioRow[],
  ctx: {
    relationshipType: string;
    relationshipStage: string | null;
    interests: string[];
    playedSlugs: string[];
  },
  limit = 3,
): ScenarioRow[] {
  const romantic = ROMANTIC.test(ctx.relationshipType);
  const early = /stranger|curiosity|acquaintance/i.test(ctx.relationshipStage ?? "");
  const interests = ctx.interests.map((i) => i.toLowerCase());
  const played = new Set(ctx.playedSlugs);

  const scored = scenarios
    .filter((s) => !played.has(s.slug))
    .map((s) => {
      let score = 0;
      const fitsRomance = s.best_for.some((b) => ROMANTIC.test(b));
      if (romantic && fitsRomance) score += 3;
      if (!romantic && s.category === "romance") score -= 4;
      if (!romantic && s.best_for.some((b) => /friend|mentor|rival/i.test(b))) score += 2;
      // Early on, keep it light.
      if (early && (s.category === "emotional" || s.scenario_type === "arc")) score -= 3;
      if (early && s.scenario_type === "quick") score += 2;
      if (!early && s.scenario_type !== "quick") score += 1;
      const hay = `${s.title} ${s.description} ${s.setting ?? ""}`.toLowerCase();
      if (interests.some((i) => i.length > 3 && hay.includes(i))) score += 4;
      return { s, score };
    })
    .sort((a, b) => b.score - a.score || a.s.sort_order - b.s.sort_order);

  return scored.slice(0, limit).map((x) => x.s);
}

/** Scenario replies may end with a choice marker; strip it for display. */
const CHOICE_RE = /\[\[CHOICES:([^\]]*)\]\]/i;

export function parseChoices(text: string): { body: string; choices: string[] } {
  const match = text.match(CHOICE_RE);
  if (!match) return { body: text, choices: [] };
  const choices = match[1]
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c.length > 0 && c.length <= 80)
    .slice(0, 4);
  return { body: text.replace(CHOICE_RE, "").trim(), choices };
}
