import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  getMyCharacter,
  listMilestones,
  checkMilestones,
  listMemories,
} from "@/lib/character.functions";
import { listStoryEvents, deleteStoryEvent } from "@/lib/scenario.functions";
import { useActiveBondId } from "@/hooks/useActiveBond";
import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/story")({
  component: StoryPage,
  head: () => ({
    meta: [
      { title: "Our Story — Lumen" },
      { name: "description", content: "Milestones and shared moments from your time together." },
      { property: "og:title", content: "Our Story — Lumen" },
      { property: "og:description", content: "Milestones and shared moments from your time together." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Kind = "milestone" | "moment" | "memory";
type Entry = {
  key: string;
  id: string;
  kind: Kind;
  source: "milestone" | "event" | "memory";
  day: number;
  title: string;
  description: string | null;
  caption?: string | null;
  created_at: string;
};

const MOMENT_CATEGORIES = new Set(["moment", "event", "shared", "relationship"]);
const LOAD_TIMEOUT_MS = 12_000;

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), LOAD_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** A memory is a Moment when it describes a shared/meaningful event. */
function isMoment(m: { category: string; importance: number }) {
  return MOMENT_CATEGORIES.has(m.category) || m.importance >= 4;
}

function StoryPage() {
  const [characterId] = useActiveBondId();
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchMilestones = useServerFn(listMilestones);
  const fetchEvents = useServerFn(listStoryEvents);
  const fetchMemories = useServerFn(listMemories);
  const removeEvent = useServerFn(deleteStoryEvent);
  const check = useServerFn(checkMilestones);
  const qc = useQueryClient();

  const [filter, setFilter] = useState<"all" | "milestone" | "moment">("all");

  const opts = { data: { characterId } };
  const live = { refetchInterval: 20_000, refetchOnWindowFocus: true, retry: 1 } as const;

  const characterQ = useQuery({
    queryKey: ["character", characterId],
    queryFn: () => withTimeout(fetchCharacter(opts)),
    retry: 1,
  });
  const milestonesQ = useQuery({
    queryKey: ["milestones", characterId],
    queryFn: () => withTimeout(fetchMilestones(opts)),
    ...live,
  });
  const eventsQ = useQuery({
    queryKey: ["story-events", characterId],
    queryFn: () => withTimeout(fetchEvents(opts)),
    ...live,
  });
  const memoriesQ = useQuery({
    queryKey: ["memories", characterId],
    queryFn: () => withTimeout(fetchMemories(opts)),
    ...live,
  });

  const memoryCount = memoriesQ.data?.length ?? 0;
  useEffect(() => {
    let alive = true;
    check(opts)
      .then(({ created }) => {
        if (alive && created > 0) void milestonesQ.refetch();
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Re-run when the bond changes or new memories arrive (for "first memory").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId, memoryCount > 0]);

  const startDate = characterQ.data?.journey_start_date;
  const dayOf = (iso: string) =>
    startDate
      ? Math.max(1, Math.floor((new Date(iso).getTime() - new Date(startDate).getTime()) / 86_400_000) + 1)
      : 1;

  const entries = useMemo<Entry[]>(() => {
    const ms: Entry[] = (milestonesQ.data ?? []).map((m) => ({
      key: `milestone-${m.id}`,
      id: m.id,
      kind: "milestone",
      source: "milestone",
      day: m.day,
      title: m.title,
      description: m.description,
      created_at: m.created_at,
    }));
    const ev: Entry[] = ((eventsQ.data ?? []) as Array<{
      id: string;
      day: number;
      title: string;
      description: string | null;
      caption: string | null;
      created_at: string;
    }>).map((e) => ({
      key: `event-${e.id}`,
      id: e.id,
      kind: "moment",
      source: "event",
      day: e.day,
      title: e.title,
      description: e.description,
      caption: e.caption,
      created_at: e.created_at,
    }));
    const mem: Entry[] = (memoriesQ.data ?? [])
      .filter((m) => m.category !== "character")
      .map((m) => ({
        key: `memory-${m.id}`,
        id: m.id,
        kind: isMoment(m) ? "moment" : "memory",
        source: "memory",
        day: dayOf(m.created_at),
        title: m.content,
        description: null,
        created_at: m.created_at,
      }));
    return [...ms, ...ev, ...mem].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestonesQ.data, eventsQ.data, memoriesQ.data, startDate]);

  const loading = milestonesQ.isLoading || eventsQ.isLoading || memoriesQ.isLoading;
  const failed = milestonesQ.isError || eventsQ.isError || memoriesQ.isError;
  const visible = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  async function onDelete(id: string) {
    try {
      await removeEvent({ data: { id } });
      void qc.invalidateQueries({ queryKey: ["story-events"] });
    } catch {
      toast.error("Couldn't remove that moment.");
    }
  }

  function retry() {
    void milestonesQ.refetch();
    void eventsQ.refetch();
    void memoriesQ.refetch();
  }

  const empty = {
    all: ["Your story is just beginning.", "Create memories with your Bond and they'll appear here."],
    milestone: ["No milestones yet.", "Meaningful milestones will appear here as your Bond grows."],
    moment: ["No moments yet.", "Meaningful memories and moments will appear here."],
  }[filter];

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-5 py-8 md:px-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-4xl">
            Our <span className="text-gradient italic">story</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {characterQ.data?.name
              ? `Everything you and ${characterQ.data.name} have shared.`
              : "Milestones you've reached and moments you've shared."}
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

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : failed && entries.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center">
            <div className="text-lg">We couldn't load your story.</div>
            <p className="mt-1 text-sm text-muted-foreground">Please try again.</p>
            <button onClick={retry} className="btn-primary mt-5 rounded-xl px-5 py-2 text-sm">
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="glass rounded-3xl p-8 text-center">
            <div className="text-lg">{empty[0]}</div>
            <p className="mt-1 text-sm text-muted-foreground">{empty[1]}</p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div
              className="absolute left-2 top-2 bottom-2 w-px"
              style={{ background: "linear-gradient(to bottom, var(--primary), transparent)" }}
            />
            <ul className="space-y-6">
              {visible.map((m) => (
                <li key={m.key} className="relative">
                  <div
                    className="absolute -left-[22px] top-1.5 h-3 w-3 rounded-full"
                    style={{
                      background: "var(--gradient-primary)",
                      boxShadow: m.kind === "milestone" ? "0 0 12px var(--primary)" : undefined,
                    }}
                  />
                  <div className="glass group rounded-2xl p-5">
                    <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
                      <span>
                        Day {m.day} ·{" "}
                        {m.kind === "milestone" ? "Milestone" : m.kind === "moment" ? "Moment" : "Memory"}
                      </span>
                      <span className="flex items-center gap-2">
                        {new Date(m.created_at).toLocaleDateString()}
                        {m.source === "event" && (
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
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}
