import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { getMyCharacter, listMilestones, checkMilestones } from "@/lib/character.functions";
import { listStoryEvents, deleteStoryEvent } from "@/lib/scenario.functions";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/story")({
  component: StoryPage,
  head: () => ({
    meta: [
      { title: "Our Story — Lumen" },
      { name: "description", content: "Milestones and shared moments from your year together." },
      { property: "og:title", content: "Our Story — Lumen" },
      { property: "og:description", content: "Milestones and shared moments from your year together." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Entry = {
  id: string;
  kind: "milestone" | "moment";
  day: number;
  title: string;
  description: string | null;
  caption?: string | null;
  created_at: string;
};

function StoryPage() {
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchMilestones = useServerFn(listMilestones);
  const fetchEvents = useServerFn(listStoryEvents);
  const removeEvent = useServerFn(deleteStoryEvent);
  const check = useServerFn(checkMilestones);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "milestone" | "moment">("all");

  const { data: character } = useQuery({ queryKey: ["character"], queryFn: () => fetchCharacter() });
  const { data: milestones = [], refetch } = useQuery({
    queryKey: ["milestones"],
    queryFn: () => fetchMilestones(),
  });
  const { data: events = [] } = useQuery({ queryKey: ["story-events"], queryFn: () => fetchEvents() });

  useEffect(() => {
    check().then(({ created }) => {
      if (created > 0) refetch();
    });
  }, [check, refetch]);

  const currentDay = character
    ? Math.max(1, Math.floor((Date.now() - new Date(character.journey_start_date).getTime()) / 86_400_000) + 1)
    : 1;

  const entries = useMemo<Entry[]>(() => {
    const ms = (milestones as Array<{
      id: string;
      day: number;
      title: string;
      description: string | null;
      created_at: string;
    }>).map((m) => ({ ...m, kind: "milestone" as const }));
    const ev = (events as unknown as Array<{
      id: string;
      day: number;
      title: string;
      description: string | null;
      caption: string | null;
      created_at: string;
    }>).map((e) => ({ ...e, kind: "moment" as const }));
    return [...ms, ...ev].sort(
      (a, b) => a.day - b.day || new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [milestones, events]);

  const visible = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  async function onDelete(id: string) {
    try {
      await removeEvent({ data: { id } });
      qc.invalidateQueries({ queryKey: ["story-events"] });
    } catch {
      toast.error("Couldn't remove that moment.");
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-4xl">
            Our <span className="text-gradient italic">story</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Milestones you've reached, scenes you've shared, and what's still ahead.
          </p>
        </div>

        <div className="mb-8 flex gap-2">
          {(
            [
              { key: "all", label: "Everything" },
              { key: "milestone", label: "Milestones" },
              { key: "moment", label: "Moments" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-4 py-1.5 text-xs transition ${
                filter === f.key ? "bg-white/15 text-foreground" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative pl-6">
          <div
            className="absolute left-2 top-2 bottom-2 w-px"
            style={{ background: "linear-gradient(to bottom, var(--primary), transparent)" }}
          />
          <ul className="space-y-6">
            {visible.map((m) => {
              const reached = m.day <= currentDay;
              return (
                <li key={`${m.kind}-${m.id}`} className="relative">
                  <div
                    className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full"
                    style={{
                      background: reached ? "var(--gradient-primary)" : "hsl(var(--muted))",
                      boxShadow: reached ? "0 0 12px var(--primary)" : undefined,
                    }}
                  />
                  <div className="glass group rounded-2xl p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                      <span>
                        Day {m.day} · {m.kind === "moment" ? "Shared moment" : "Milestone"}
                      </span>
                      <span className="flex items-center gap-2">
                        {new Date(m.created_at).toLocaleDateString()}
                        {m.kind === "moment" && (
                          <button
                            onClick={() => onDelete(m.id)}
                            className="opacity-0 transition group-hover:opacity-100 hover:text-foreground"
                            aria-label="Remove moment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="mt-1 text-lg">{m.title}</div>
                    {m.description && <p className="mt-1 text-sm text-muted-foreground">{m.description}</p>}
                    {m.caption && <p className="mt-2 text-sm italic text-muted-foreground">“{m.caption}”</p>}
                  </div>
                </li>
              );
            })}

            {character && filter !== "moment" && (
              <UpcomingHint
                currentDay={currentDay}
                reached={new Set((milestones as Array<{ day: number }>).map((m) => m.day))}
              />
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
