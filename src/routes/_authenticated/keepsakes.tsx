import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Mail } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  listKeepsakes,
  createKeepsake,
  deleteKeepsake,
  listLetters,
  markLetterRead,
  ensureMilestoneLetter,
} from "@/lib/bond.functions";
import type { Keepsake, Letter } from "@/lib/bond-shared";
import { useActiveBondId } from "@/hooks/useActiveBond";

export const Route = createFileRoute("/_authenticated/keepsakes")({
  component: KeepsakesPage,
  head: () => ({
    meta: [
      { title: "Keepsakes — Lumen" },
      { name: "description", content: "Small things you kept, and letters they wrote you." },
    ],
  }),
});

function KeepsakesPage() {
  const [characterId] = useActiveBondId();
  const fetchKeepsakes = useServerFn(listKeepsakes);
  const fetchLetters = useServerFn(listLetters);
  const ensureLetter = useServerFn(ensureMilestoneLetter);
  const addKeepsake = useServerFn(createKeepsake);
  const removeKeepsake = useServerFn(deleteKeepsake);
  const readLetter = useServerFn(markLetterRead);
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [open, setOpen] = useState<Letter | null>(null);

  const { data: keepsakes = [] } = useQuery({
    queryKey: ["keepsakes", characterId],
    queryFn: () => fetchKeepsakes({ data: { characterId } }),
  });
  const { data: letters = [] } = useQuery({
    queryKey: ["letters", characterId],
    queryFn: async () => {
      await ensureLetter({ data: { characterId } }).catch(() => null);
      return fetchLetters({ data: { characterId } });
    },
  });

  const addMut = useMutation({
    mutationFn: () => addKeepsake({ data: { characterId, title, note: note || undefined } }),
    onSuccess: () => {
      setTitle("");
      setNote("");
      void qc.invalidateQueries({ queryKey: ["keepsakes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => removeKeepsake({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["keepsakes"] }),
  });

  function openLetter(l: Letter) {
    setOpen(l);
    if (!l.read_at) {
      void readLetter({ data: { id: l.id } }).then(() =>
        qc.invalidateQueries({ queryKey: ["letters"] }),
      );
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="text-4xl">
          <span className="text-gradient italic">Keepsakes</span> & letters
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The small things worth holding on to from this bond.
        </p>

        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Letters</h2>
          {(letters as Letter[]).length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              They'll write to you as your milestones arrive.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(letters as Letter[]).map((l) => (
                <button
                  key={l.id}
                  onClick={() => openLetter(l)}
                  className="glass rounded-2xl p-5 text-left transition hover:bg-white/5"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-primary" />
                    {l.title}
                    {!l.read_at && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Day {l.day}</div>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{l.body}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Your keepsakes</h2>
          <div className="glass mt-4 rounded-2xl p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Something to keep…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why it matters (optional)"
              rows={2}
              className="mt-2 w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={() => title.trim() && addMut.mutate()}
              disabled={!title.trim() || addMut.isPending}
              className="btn-primary mt-3 flex items-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Keep it
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {(keepsakes as Keepsake[]).map((k) => (
              <div key={k.id} className="glass flex items-start justify-between gap-3 rounded-2xl p-5">
                <div>
                  <div className="text-sm">{k.title}</div>
                  {k.note && <p className="mt-1 text-xs text-muted-foreground">{k.note}</p>}
                  <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                    Day {k.day}
                  </div>
                </div>
                <button
                  onClick={() => delMut.mutate(k.id)}
                  className="text-muted-foreground transition hover:text-foreground"
                  aria-label="Remove keepsake"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(null)} />
          <div className="glass relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-3xl p-7">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Day {open.day}
            </div>
            <h3 className="mt-1 text-2xl">{open.title}</h3>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{open.body}</p>
            <button
              onClick={() => setOpen(null)}
              className="btn-primary mt-6 w-full rounded-xl px-4 py-3 text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
