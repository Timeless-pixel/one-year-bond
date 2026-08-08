import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Archive, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { listBonds, archiveBond, restoreBond } from "@/lib/bond.functions";
import { computeDay, daysAgo, type BondSummary } from "@/lib/bond-shared";
import { useActiveBondId } from "@/hooks/useActiveBond";

export const Route = createFileRoute("/_authenticated/bonds")({
  component: BondsPage,
  head: () => ({
    meta: [
      { title: "Your Bonds — Lumen" },
      { name: "description", content: "Every relationship you're building, and the ones you've closed." },
    ],
  }),
});

function BondsPage() {
  const fetchBonds = useServerFn(listBonds);
  const doArchive = useServerFn(archiveBond);
  const doRestore = useServerFn(restoreBond);
  const [, setActiveId] = useActiveBondId();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [farewell, setFarewell] = useState<{ name: string; text: string } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["bonds"], queryFn: () => fetchBonds() });

  const archiveMut = useMutation({
    mutationFn: (characterId: string) => doArchive({ data: { characterId } }),
    onSuccess: (res, id) => {
      const name = (data?.bonds as BondSummary[] | undefined)?.find((b) => b.id === id)?.name ?? "";
      setConfirming(null);
      setFarewell({ name, text: res.farewell });
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreMut = useMutation({
    mutationFn: (characterId: string) => doRestore({ data: { characterId } }),
    onSuccess: () => {
      toast.success("Bond reopened.");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bonds = (data?.bonds ?? []) as BondSummary[];
  const active = bonds.filter((b) => b.status === "active");
  const archived = bonds.filter((b) => b.status !== "active");

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-4xl">
          Your <span className="text-gradient italic">bonds</span>
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {active.length} of {data?.max ?? 3} active. Every bond has its own memories, story and voice —
          nothing crosses between them.
        </p>

        {isLoading && <p className="mt-10 text-sm text-muted-foreground">Loading…</p>}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((b) => (
            <div key={b.id} className="glass overflow-hidden rounded-3xl">
              <div
                className="aspect-[4/3] w-full"
                style={{
                  background: b.avatar_url
                    ? `center/cover url(${b.avatar_url})`
                    : "var(--gradient-primary)",
                }}
              />
              <div className="p-5">
                <div className="text-xl">{b.name}</div>
                <div className="text-xs text-muted-foreground">
                  {journeyLabel(computeDay(b.journey_start_date))} · {b.relationship_stage ?? b.relationship_type}
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded-full border border-border px-2 py-0.5">{b.message_count} messages</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{b.memory_count} memories</span>
                  <span className="rounded-full border border-border px-2 py-0.5">{b.keepsake_count} keepsakes</span>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Last together {daysAgo(b.last_active_at)}</p>
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/chat"
                    onClick={() => {
                      setActiveId(b.id);
                      void qc.invalidateQueries();
                    }}
                    className="btn-primary flex-1 rounded-xl px-3 py-2 text-center text-sm"
                  >
                    Open
                  </Link>
                  <button
                    onClick={() => setConfirming(b.id)}
                    className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground"
                    aria-label={`End bond with ${b.name}`}
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {(data?.slotsLeft ?? 0) > 0 && (
            <Link
              to="/create"
              className="glass flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-white/15 p-6 text-center transition hover:bg-white/5"
            >
              <Plus className="h-6 w-6 text-primary" />
              <div className="text-sm">Begin a new bond</div>
              <div className="text-xs text-muted-foreground">
                {data?.slotsLeft} slot{(data?.slotsLeft ?? 0) === 1 ? "" : "s"} left
              </div>
            </Link>
          )}
        </div>

        {archived.length > 0 && (
          <>
            <h2 className="mt-14 text-xs uppercase tracking-widest text-muted-foreground">Archive</h2>
            <div className="mt-4 flex flex-col gap-3">
              {archived.map((b) => (
                <div key={b.id} className="glass rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg">{b.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {computeDay(b.journey_start_date)} days together · closed{" "}
                        {b.archived_at ? daysAgo(b.archived_at) : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreMut.mutate(b.id)}
                      className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground transition hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reopen
                    </button>
                  </div>
                  {b.farewell_message && (
                    <p className="mt-3 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                      {b.farewell_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {confirming && (
        <Modal onClose={() => setConfirming(null)}>
          <h3 className="text-2xl">End this bond?</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            They'll write you a last message, and everything you shared moves to your archive. You can
            reopen it later — nothing is deleted.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => archiveMut.mutate(confirming)}
              disabled={archiveMut.isPending}
              className="btn-primary flex-1 rounded-xl px-4 py-3 text-sm disabled:opacity-60"
            >
              {archiveMut.isPending ? "Saying goodbye…" : "End bond"}
            </button>
            <button
              onClick={() => setConfirming(null)}
              className="rounded-xl border border-border px-4 py-3 text-sm text-muted-foreground"
            >
              Keep it
            </button>
          </div>
        </Modal>
      )}

      {farewell && (
        <Modal onClose={() => setFarewell(null)}>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Last message from {farewell.name}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{farewell.text}</p>
          <button
            onClick={() => setFarewell(null)}
            className="btn-primary mt-6 w-full rounded-xl px-4 py-3 text-sm"
          >
            Close
          </button>
        </Modal>
      )}
    </AppShell>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="glass relative w-full max-w-md rounded-3xl p-7">{children}</div>
    </div>
  );
}
