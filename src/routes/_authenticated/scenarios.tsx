import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { getMyCharacter } from "@/lib/character.functions";
import { listScenarios, startScenario } from "@/lib/scenario.functions";
import {
  SCENARIO_CATEGORIES,
  SCENARIO_TYPE_LABEL,
  categoryLabel,
  recommendScenarios,
  type ScenarioRow,
} from "@/lib/scenario-shared";
import { Clock, Play, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/scenarios")({
  component: ScenariosPage,
  head: () => ({
    meta: [
      { title: "Scenarios — Lumen" },
      { name: "description", content: "Step into a shared scene with your companion." },
      { property: "og:title", content: "Scenarios — Lumen" },
      { property: "og:description", content: "Step into a shared scene with your companion." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

interface SessionRow {
  id: string;
  scenario_id: string;
  status: string;
  recap: string | null;
  day_started: number;
  last_active_at: string;
}

function ScenariosPage() {
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchScenarios = useServerFn(listScenarios);
  const begin = useServerFn(startScenario);
  const navigate = useNavigate();

  const [category, setCategory] = useState<string>("all");
  const [starting, setStarting] = useState<string | null>(null);

  const { data: character } = useQuery({ queryKey: ["character"], queryFn: () => fetchCharacter() });
  const { data, isLoading } = useQuery({ queryKey: ["scenarios"], queryFn: () => fetchScenarios() });

  const scenarios = (data?.scenarios ?? []) as unknown as ScenarioRow[];
  const sessions = (data?.sessions ?? []) as unknown as SessionRow[];

  const byId = useMemo(() => new Map(scenarios.map((s) => [s.id, s])), [scenarios]);
  const active = sessions.filter((s) => s.status === "active");
  const playedSlugs = sessions.map((s) => byId.get(s.scenario_id)?.slug).filter(Boolean) as string[];

  const recommended = useMemo(() => {
    if (!character || !scenarios.length) return [];
    const interests = ((character.interests as { list?: string[] } | null)?.list ?? []) as string[];
    return recommendScenarios(scenarios, {
      relationshipType: character.relationship_type,
      relationshipStage: character.relationship_stage,
      interests,
      playedSlugs,
    });
  }, [character, scenarios, playedSlugs]);

  const visible = category === "all" ? scenarios : scenarios.filter((s) => s.category === category);

  async function start(scenario: ScenarioRow) {
    if (starting) return;
    setStarting(scenario.id);
    try {
      const res = await begin({ data: { scenarioId: scenario.id } });
      navigate({ to: "/scenario/$sessionId", params: { sessionId: res.sessionId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start that scene.");
      setStarting(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 py-8 md:px-6 md:py-10">
        <header className="mb-8">
          <h1 className="text-4xl">
            <span className="text-gradient italic">Scenarios</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Same companion, same relationship — a different place to be together for a while.
          </p>
        </header>

        {active.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Continue</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {active.map((s) => {
                const sc = byId.get(s.scenario_id);
                if (!sc) return null;
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate({ to: "/scenario/$sessionId", params: { sessionId: s.id } })}
                    className="glass rounded-2xl p-5 text-left transition hover:bg-white/5"
                  >
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                      In progress · started day {s.day_started}
                    </div>
                    <div className="mt-1 text-lg">{sc.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{sc.description}</div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {recommended.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Suggested for you
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {recommended.map((s) => (
                <ScenarioCard key={s.id} s={s} onStart={start} starting={starting === s.id} compact />
              ))}
            </div>
          </section>
        )}

        <div className="mb-5 -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0">
          {[{ key: "all", label: "All" }, ...SCENARIO_CATEGORIES].map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs transition ${
                category === c.key ? "bg-white/15 text-foreground" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((s) => (
              <ScenarioCard key={s.id} s={s} onStart={start} starting={starting === s.id} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ScenarioCard({
  s,
  onStart,
  starting,
  compact,
}: {
  s: ScenarioRow;
  onStart: (s: ScenarioRow) => void;
  starting: boolean;
  compact?: boolean;
}) {
  return (
    <div className="glass flex flex-col rounded-2xl p-5">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
        {categoryLabel(s.category)} · {SCENARIO_TYPE_LABEL[s.scenario_type] ?? s.scenario_type}
      </div>
      <div className="mt-1 text-lg leading-tight">{s.title}</div>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.description}</p>
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        {s.duration_label}
      </div>
      {!compact && s.best_for.length > 0 && (
        <div className="mt-1 text-xs text-muted-foreground">Best for {s.best_for.join(" · ")}</div>
      )}
      <button
        onClick={() => onStart(s)}
        disabled={starting}
        className="btn-primary mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
      >
        <Play className="h-3.5 w-3.5" />
        {starting ? "Setting the scene…" : "Start scenario"}
      </button>
    </div>
  );
}
