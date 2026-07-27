import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  deleteAllMemories,
  clearConversation,
  exportUserData,
} from "@/lib/character.functions";
import { Star, Trash2, Plus, Pencil, Check, X, Download, Trash } from "lucide-react";
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

// New category buckets — each bucket collects one or more raw DB categories.
const BUCKETS = [
  {
    key: "about-you",
    label: "About You",
    hint: "Personal info, preferences, interests, goals",
    matches: ["user", "goal"] as string[],
    writeAs: "user",
  },
  {
    key: "likes",
    label: "Things You Like",
    hint: "Music, movies, anime, games, food, hobbies",
    matches: ["likes", "preference"],
    writeAs: "likes",
  },
  {
    key: "moments",
    label: "Important Moments",
    hint: "Significant events, achievements, difficult experiences",
    matches: ["moment", "event"],
    writeAs: "moment",
  },
  {
    key: "shared",
    label: "Our Memories",
    hint: "Shared experiences, inside jokes, special conversations",
    matches: ["shared"],
    writeAs: "shared",
  },
  {
    key: "relationship",
    label: "Relationship",
    hint: "Relationship moments, milestones, special memories",
    matches: ["relationship"],
    writeAs: "relationship",
  },
  {
    key: "them",
    label: "About Them",
    hint: "What's true about your companion",
    matches: ["character"],
    writeAs: "character",
  },
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
  const wipe = useServerFn(deleteAllMemories);
  const clearChat = useServerFn(clearConversation);
  const doExport = useServerFn(exportUserData);
  const qc = useQueryClient();

  const { data: memories = [], isLoading } = useQuery({
    queryKey: ["memories"],
    queryFn: () => list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["memories"] });

  const addMut = useMutation({
    mutationFn: (input: { content: string; category: string }) =>
      create({ data: { content: input.content, category: input.category, importance: 3, pinned: false } } as never),
    onSuccess: () => { invalidate(); toast.success("Memory saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const editMut = useMutation({
    mutationFn: (input: { id: string; content: string }) =>
      update({ data: { id: input.id, content: input.content } }),
    onSuccess: () => { invalidate(); toast.success("Updated"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const importantMut = useMutation({
    mutationFn: (m: Memory) => update({ data: { id: m.id, pinned: !m.pinned, importance: !m.pinned ? 5 : 3 } }),
    onSuccess: invalidate,
  });
  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
  });
  const wipeMut = useMutation({
    mutationFn: () => wipe(),
    onSuccess: () => { invalidate(); toast.success("All memories cleared"); },
  });
  const clearMut = useMutation({
    mutationFn: () => clearChat(),
    onSuccess: () => toast.success("Conversation history cleared"),
  });

  const [newContent, setNewContent] = useState("");
  const [newBucket, setNewBucket] = useState<string>(BUCKETS[0].key);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const grouped = BUCKETS.map((b) => ({
    ...b,
    items: (memories as Memory[]).filter((m) => (b.matches as readonly string[]).includes(m.category)),
  }));

  async function handleExport() {
    try {
      const data = await doExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumen-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-4xl">
            What they <span className="text-gradient italic">remember</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Long-term memory that shapes every conversation. You're in control — add, edit, mark important, or remove
            anything. You can also tell them in chat: <em>"Remember that I love anime"</em> or <em>"Forget that I told you about coffee."</em>
          </p>
        </div>

        {/* Add */}
        <div className="glass mb-6 rounded-3xl p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Add a memory</div>
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <select
              value={newBucket}
              onChange={(e) => setNewBucket(e.target.value)}
              className="rounded-xl border border-border bg-transparent px-3 py-2 text-sm"
            >
              {BUCKETS.map((b) => (
                <option key={b.key} value={b.key} className="bg-background">{b.label}</option>
              ))}
            </select>
            <input
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="e.g. I'm learning guitar and love acoustic covers"
              className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2 text-sm outline-none"
            />
            <button
              disabled={!newContent.trim() || addMut.isPending}
              onClick={() => {
                const bucket = BUCKETS.find((b) => b.key === newBucket)!;
                addMut.mutate(
                  { content: newContent.trim(), category: bucket.writeAs },
                  { onSuccess: () => setNewContent("") },
                );
              }}
              className="btn-primary flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Remember this
            </button>
          </div>
        </div>

        {/* Privacy controls */}
        <div className="glass mb-8 flex flex-wrap gap-2 rounded-3xl p-4 text-sm">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 hover:bg-white/5"
          >
            <Download className="h-4 w-4" /> Export my data
          </button>
          <button
            onClick={() => confirm("Clear all conversation history? This cannot be undone.") && clearMut.mutate()}
            className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 hover:bg-white/5"
          >
            <Trash className="h-4 w-4" /> Clear conversation history
          </button>
          <button
            onClick={() => confirm("Delete ALL your memories? Your companion will forget everything they've learned.") && wipeMut.mutate()}
            className="flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" /> Delete all memories
          </button>
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
                  <div>
                    <h2 className="text-lg">{g.label}</h2>
                    <p className="text-xs text-muted-foreground">{g.hint}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{g.items.length}</span>
                </div>
                {g.items.length === 0 ? (
                  <div className="glass rounded-2xl px-4 py-6 text-sm text-muted-foreground">
                    Nothing yet — memories will grow as you talk.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {g.items.map((m) => {
                      const isEditing = editingId === m.id;
                      return (
                        <li key={m.id} className="glass flex items-start gap-3 rounded-2xl px-4 py-3">
                          <div className="flex-1">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <input
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="flex-1 rounded-lg border border-border bg-transparent px-2 py-1 text-sm outline-none"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (editingText.trim()) editMut.mutate({ id: m.id, content: editingText.trim() });
                                    setEditingId(null);
                                  }}
                                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setEditingId(null)}
                                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="text-sm">{m.content}</div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                  <span>Remembered {new Date(m.created_at).toLocaleDateString()}</span>
                                  <span>·</span>
                                  <span>
                                    {m.source === "manual" ? "Added by you" : m.source === "seed" ? "From creation" : "Learned in chat"}
                                  </span>
                                  {m.pinned && (<><span>·</span><span className="text-amber-300">Important</span></>)}
                                </div>
                              </>
                            )}
                          </div>
                          {!isEditing && (
                            <>
                              <button
                                onClick={() => importantMut.mutate(m)}
                                title={m.pinned ? "Unmark important" : "Mark as important"}
                                className={`rounded-lg p-2 transition hover:bg-white/5 ${m.pinned ? "text-amber-300" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                <Star className={`h-4 w-4 ${m.pinned ? "fill-current" : ""}`} />
                              </button>
                              <button
                                onClick={() => { setEditingId(m.id); setEditingText(m.content); }}
                                title="Edit"
                                className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => confirm("Remove this memory?") && delMut.mutate(m.id)}
                                title="Delete"
                                className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/5 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </li>
                      );
                    })}
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
