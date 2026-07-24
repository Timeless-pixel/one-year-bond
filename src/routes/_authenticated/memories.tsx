import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
} from "@/lib/character.functions";
import { Pin, PinOff, Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/memories")({
  component: MemoriesPage,
  head: () => ({
    meta: [
      { title: "Memories — Lumen" },
      { name: "description", content: "What your companion remembers about you." },
    ],
  }),
});

const CATEGORIES = [
  { key: "user", label: "About you" },
  { key: "preference", label: "Preferences" },
  { key: "goal", label: "Goals & dreams" },
  { key: "event", label: "Important events" },
  { key: "shared", label: "Shared moments" },
  { key: "character", label: "About them" },
] as const;

type Memory = {
  id: string;
  content: string;
  category: string;
  importance: number;
  pinned: boolean;
  source: string;
  created_at: string;
};

function MemoriesPage() {
  const list = useServerFn(listMemories);
  const create = useServerFn(createMemory);
  const update = useServerFn(updateMemory);
  const remove = useServerFn(deleteMemory);
  const qc = useQueryClient();

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories"] });

  const addMut = useMutation({
    mutationFn: (input: { content: string; category: string }) =>
      create({ data: { content: input.content, category: input.category as never, importance: 3, pinned: false } }),
    onSuccess: () => {
      invalidate();
      toast.success("Memory saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pinMut = useMutation({
    mutationFn: (m: Memory) => update({ data: { id: m.id, pinned: !m.pinned } }),
    onSuccess: invalidate,
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });

  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>("user");

  const grouped = CATEGORIES.map((c) => ({
    ...c,
    items: (memories as Memory[]).filter((m) => m.category === c.key),
  }));

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-4xl">
            What they <span className="text-gradient italic">remember</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Long-term memory that shapes every conversation. Add, pin, or remove what your companion carries with them.
          </p>
        </div>

        <div className="glass mb-8 rounded-3xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Add a memory</div>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.key} value={c.key} className="bg-background">
                  {c.label}
                </option>
              ))}
            </select>
            <input
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. User is learning guitar and loves acoustic covers"
              className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              disabled={!newContent.trim() || addMut.isPending}
              onClick={() => {
                addMut.mutate(
                  { content: newContent.trim(), category: newCategory },
                  {
                    onSuccess: () => {
                      setNewContent("");
                    },
                  },
                );
              }}
              className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Add
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((g) => (
              <section key={g.key}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-lg">{g.label}</h2>
                  <span className="text-xs text-muted-foreground">{g.items.length}</span>
                </div>
                {g.items.length === 0 ? (
                  <div className="glass rounded-2xl px-4 py-6 text-sm text-muted-foreground">
                    Nothing yet — memories will grow as you talk.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {g.items.map((m) => (
                      <li key={m.id} className="glass flex items-start gap-3 rounded-2xl px-4 py-3">
                        <div className="flex-1">
                          <div className="text-sm">{m.content}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{m.source === "manual" ? "Added by you" : m.source === "seed" ? "From creation" : "Learned in chat"}</span>
                            <span>·</span>
                            <span>Importance {m.importance}/5</span>
                          </div>
                        </div>
                        <button
                          onClick={() => pinMut.mutate(m)}
                          title={m.pinned ? "Unpin" : "Pin"}
                          className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                        >
                          {m.pinned ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Remove this memory?")) delMut.mutate(m.id);
                          }}
                          title="Delete"
                          className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/5 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
