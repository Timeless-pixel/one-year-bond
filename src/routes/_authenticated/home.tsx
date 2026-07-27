import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCharacter, listMemories } from "@/lib/character.functions";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";

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
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchMemories = useServerFn(listMemories);
  const navigate = useNavigate();
  const { data: character, isLoading } = useQuery({
    queryKey: ["character"],
    queryFn: () => fetchCharacter(),
  });
  const { data: memories = [] } = useQuery({
    queryKey: ["memories"],
    queryFn: () => fetchMemories(),
    enabled: !!character,
  });

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
              <div className="mt-2 text-2xl">{character.relationship_type}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                You're currently {character.relationship_stage?.toLowerCase() ?? "getting to know each other"}.
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
