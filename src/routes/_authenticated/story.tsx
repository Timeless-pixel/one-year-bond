import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getMyCharacter, listMilestones, checkMilestones } from "@/lib/character.functions";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/story")({
  component: StoryPage,
  head: () => ({
    meta: [
      { title: "Our Story — Lumen" },
      { name: "description", content: "Milestones from your year together." },
    ],
  }),
});

function StoryPage() {
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchMilestones = useServerFn(listMilestones);
  const check = useServerFn(checkMilestones);

  const { data: character } = useQuery({ queryKey: ["character"], queryFn: () => fetchCharacter() });
  const { data: milestones = [], refetch } = useQuery({
    queryKey: ["milestones"],
    queryFn: () => fetchMilestones(),
  });

  useEffect(() => {
    check().then(({ created }) => {
      if (created > 0) refetch();
    });
  }, [check, refetch]);

  const currentDay = character
    ? Math.max(1, Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1)
    : 1;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-10">
          <h1 className="text-4xl">
            Our <span className="text-gradient italic">story</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The milestones you've reached together, and the ones still ahead.
          </p>
        </div>

        <div className="relative pl-6">
          <div
            className="absolute left-2 top-2 bottom-2 w-px"
            style={{ background: "linear-gradient(to bottom, var(--primary), transparent)" }}
          />
          <ul className="space-y-6">
            {(milestones as Array<{ id: string; day: number; title: string; description: string | null; created_at: string }>).map((m) => {
              const reached = m.day <= currentDay;
              return (
                <li key={m.id} className="relative">
                  <div
                    className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full"
                    style={{
                      background: reached ? "var(--gradient-primary)" : "hsl(var(--muted))",
                      boxShadow: reached ? "0 0 12px var(--primary)" : undefined,
                    }}
                  />
                  <div className="glass rounded-2xl p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                      <span>Day {m.day}</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="mt-1 text-lg">{m.title}</div>
                    {m.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>
                    )}
                  </div>
                </li>
              );
            })}

            {/* upcoming milestone hint */}
            {character && (
              <UpcomingHint currentDay={currentDay} reached={new Set((milestones as Array<{ day: number }>).map((m) => m.day))} />
            )}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

const FUTURE_DAYS = [7, 30, 60, 100, 180, 250, 365];

function UpcomingHint({ currentDay, reached }: { currentDay: number; reached: Set<number> }) {
  const next = FUTURE_DAYS.find((d) => d > currentDay && !reached.has(d));
  if (!next) return null;
  return (
    <li className="relative">
      <div className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full border border-border" />
      <div className="rounded-2xl border border-dashed border-border/60 p-5">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Coming · Day {next}</div>
        <div className="mt-1 text-lg text-muted-foreground">
          {next - currentDay} day{next - currentDay === 1 ? "" : "s"} away
        </div>
      </div>
    </li>
  );
}
