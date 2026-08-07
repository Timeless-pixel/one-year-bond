import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCharacter, listMemories } from "@/lib/character.functions";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";
import { getLivingMoments, refreshLivingMoments, setLivingMomentStatus } from "@/lib/bond.functions";
import { useActiveBondId } from "@/hooks/useActiveBond";
import { MOMENT_KIND_LABEL, type LivingMoment } from "@/lib/bond-shared";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "Home — Lumen" },
      { name: "description", content: "Your companion is waiting." },
    ],
  }),
});

function computeDay(startDate: string) {
  const day = Math.floor(
    (Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24),
  ) + 1;
  return Math.max(1, Math.min(365, day));
}

function HomePage() {
  const [characterId] = useActiveBondId();
  const qc = useQueryClient();
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchMoments = useServerFn(getLivingMoments);
  const refreshMoments = useServerFn(refreshLivingMoments);
  const setMomentStatus = useServerFn(setLivingMomentStatus);
  const fetchMemories = useServerFn(listMemories);
  const navigate = useNavigate();
  const { data: character, isLoading } = useQuery({
    queryKey: ["character", characterId],
    queryFn: () => fetchCharacter({ data: { characterId } }),
  });
  const { data: memories = [] } = useQuery({
    queryKey: ["memories", characterId],
    queryFn: () => fetchMemories({ data: { characterId } }),
    enabled: !!character,
  });
  const { data: moments = [] } = useQuery({
    queryKey: ["living-moments", characterId],
    queryFn: async () => {
      await refreshMoments({ data: { characterId } }).catch(() => null);
      return fetchMoments({ data: { characterId } });
    },
    enabled: !!character,
  });

  function dismissMoment(id: string) {
    void setMomentStatus({ data: { id, status: "dismissed" } }).then(() =>
      qc.invalidateQueries({ queryKey: ["living-moments"] }),
    );
  }

  useEffect(() => {
    if (!isLoading && !character) navigate({ to: "/create" });
  }, [character, isLoading, navigate]);

  if (isLoading || !character) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const day = computeDay(character.journey_start_date);
  const daysLeft = 365 - day;
  const pct = (day / 365) * 100;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground">{greeting}.</p>
          <h1 className="mt-1 text-4xl">
            {character.name} is <span className="text-gradient italic">waiting</span> for you.
          </h1>
        </div>

        {(moments as LivingMoment[]).length > 0 && (
          <div className="mb-8 flex flex-col gap-3">
            {(moments as LivingMoment[]).map((m) => (
              <div key={m.id} className="glass flex items-start justify-between gap-4 rounded-2xl p-5">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {MOMENT_KIND_LABEL[m.kind] ?? "A small moment"} · while you were away
                  </div>
                  <p className="mt-1.5 text-sm">{m.content}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link to="/chat" className="btn-primary rounded-xl px-3 py-1.5 text-xs">
                    Reply
                  </Link>
                  <button
                    onClick={() => dismissMoment(m.id)}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="glass overflow-hidden rounded-3xl">
            <div
              className="relative aspect-square w-full"
              style={{
                background: character.avatar_url
                  ? `center/cover url(${character.avatar_url})`
                  : "var(--gradient-primary)",
              }}
            >
              {!character.avatar_url && (
                <div className="flex h-full w-full items-center justify-center text-8xl font-display italic text-white/70">
                  {character.name[0]}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/60">
                      {character.relationship_stage}
                    </div>
                    <div className="text-2xl text-white">{character.name}</div>
                  </div>
                  <div className="glass rounded-full px-3 py-1 text-xs text-white">
                    Mood · {character.mood}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="glass rounded-3xl p-7">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Your journey
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <div className="text-6xl">{day}</div>
                <div className="text-lg text-muted-foreground">/ 365</div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
                />
              </div>
              <div className="mt-3 flex justify-between text-xs text-muted-foreground">
                <span>Started {new Date(character.journey_start_date).toLocaleDateString()}</span>
                <span>{daysLeft} days remaining</span>
              </div>
            </div>

            <div className="glass rounded-3xl p-7">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Relationship
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <div className="text-2xl">{character.relationship_stage ?? character.relationship_type}</div>
                <div className="text-sm text-muted-foreground">
                  {EXPRESSION_EMOJI[expression] ?? "🙂"} {expression}
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${score}%`, background: "var(--gradient-primary)" }}
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {score}/100 — grows with time, memories and shared moments.
              </p>
            </div>


            {(() => {
              const latest = (memories as Array<{ id: string; content: string; category: string; created_at: string }>).find(
                (m) => m.category !== "character",
              );
              if (!latest) return null;
              return (
                <Link to="/memories" className="glass block rounded-3xl p-7 transition hover:bg-white/5">
                  <div className="text-xs uppercase tracking-widest text-muted-foreground">Your latest memory</div>
                  <p className="mt-2 text-sm">{latest.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Remembered {new Date(latest.created_at).toLocaleDateString()}
                  </p>
                </Link>
              );
            })()}


            <Link
              to="/chat"
              className="btn-primary flex items-center justify-between rounded-3xl px-7 py-6 text-lg font-medium"
            >
              <span>Continue conversation</span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
