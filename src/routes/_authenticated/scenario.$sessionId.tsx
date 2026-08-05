import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { getMyCharacter } from "@/lib/character.functions";
import { getScenarioSession, completeScenario } from "@/lib/scenario.functions";
import { parseChoices } from "@/lib/scenario-shared";
import { Send, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/scenario/$sessionId")({
  component: ScenarioPlayPage,
  head: () => ({
    meta: [
      { title: "Scenario — Lumen" },
      { name: "description", content: "A shared scene with your companion." },
      { property: "og:title", content: "Scenario — Lumen" },
      { property: "og:description", content: "A shared scene with your companion." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

async function getAccessToken(): Promise<string | undefined> {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    return result?.data?.session?.access_token;
  } catch {
    return undefined;
  }
}

function ScenarioPlayPage() {
  const { sessionId } = useParams({ from: "/_authenticated/scenario/$sessionId" });
  const fetchSession = useServerFn(getScenarioSession);
  const fetchCharacter = useServerFn(getMyCharacter);

  const { data: character } = useQuery({ queryKey: ["character"], queryFn: () => fetchCharacter() });
  const { data, isLoading, error } = useQuery({
    queryKey: ["scenario-session", sessionId],
    queryFn: () => fetchSession({ data: { sessionId } }),
  });

  if (isLoading || !character || !data) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          {error ? (
            <p className="text-sm text-muted-foreground">That scene isn't available.</p>
          ) : (
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>
      </AppShell>
    );
  }

  const session = data.session as unknown as {
    id: string;
    status: string;
    day_started: number;
    scenarios: { title: string; description: string; setting: string | null; duration_label: string };
  };

  return (
    <AppShell>
      <ScenarioWindow
        sessionId={sessionId}
        title={session.scenarios.title}
        blurb={session.scenarios.setting ?? session.scenarios.description}
        completed={session.status === "completed"}
        characterName={character.name}
        avatarUrl={character.avatar_url}
        initialMessages={data.messages as { id: string; role: string; content: string }[]}
      />
    </AppShell>
  );
}

const REQUEST_TIMEOUT_MS = 60_000;

function ScenarioWindow({
  sessionId,
  title,
  blurb,
  completed,
  characterName,
  avatarUrl,
  initialMessages,
}: {
  sessionId: string;
  title: string;
  blurb: string;
  completed: boolean;
  characterName: string;
  avatarUrl: string | null;
  initialMessages: { id: string; role: string; content: string }[];
}) {
  const navigate = useNavigate();
  const finish = useServerFn(completeScenario);

  const seed: UIMessage[] = useMemo(
    () =>
      initialMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
        })),
    [initialMessages],
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [recap, setRecap] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [showEnd, setShowEnd] = useState(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { scenarioSessionId: sessionId },
        fetch: async (input, init) => {
          const token = await getAccessToken();
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
          if (init?.signal) init.signal.addEventListener("abort", () => controller.abort(), { once: true });
          try {
            const res = await fetch(input, { ...init, headers, signal: controller.signal });
            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              throw new Error(
                res.status === 401
                  ? "Your session expired. Please sign in again."
                  : detail || "Something went wrong. Please try again.",
              );
            }
            return res;
          } finally {
            clearTimeout(timeout);
          }
        },
      }),
    [sessionId],
  );

  const { messages, sendMessage, status } = useChat({
    id: sessionId,
    messages: seed,
    transport,
    onError: (err) => setErrorMsg(err?.message || "Something went wrong. Please try again."),
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);
  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, errorMsg]);

  async function send(text: string) {
    if (!text || sendingRef.current || isBusy || completed) return;
    sendingRef.current = true;
    setErrorMsg(null);
    try {
      await sendMessage({ text });
    } finally {
      sendingRef.current = false;
    }
  }

  const openedRef = useRef(false);
  useEffect(() => {
    if (openedRef.current || messages.length > 0 || completed) return;
    openedRef.current = true;
    void send("(system: open the scene — set it in a few sentences and speak first, in character.)");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const visible = messages.filter((m) => {
    const t = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return !(m.role === "user" && t.startsWith("(system:"));
  });

  const last = visible[visible.length - 1];
  const lastText = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
  const choices = last?.role === "assistant" && !isBusy ? parseChoices(lastText).choices : [];

  async function endScene(saveMoment: boolean) {
    if (ending) return;
    setEnding(true);
    try {
      const res = await finish({ data: { sessionId, saveMoment, caption: caption || undefined } });
      setRecap(res.recap);
      if (saveMoment) toast.success("Saved to Our Story.");
      setShowEnd(false);
      navigate({ to: "/story" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't close the scene.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 pt-4 md:pt-6">
      <header className="glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-3">
        <div
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full"
          style={{ background: avatarUrl ? `center/cover url(${avatarUrl})` : "var(--gradient-primary)" }}
        >
          {!avatarUrl && (
            <div className="flex h-full w-full items-center justify-center font-display italic text-white">
              {characterName[0]}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{blurb}</div>
        </div>
        {!completed && (
          <button
            onClick={() => setShowEnd(true)}
            className="rounded-full px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
          >
            End scene
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {visible.map((m) => {
          const raw = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
          const text = m.role === "assistant" ? parseChoices(raw).body : raw;
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              {mine ? (
                <div
                  className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                  style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
                >
                  {text}
                </div>
              ) : (
                <div className="max-w-[90%] whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  <div className="mb-1 text-xs text-muted-foreground">{characterName}</div>
                  <div>{text}</div>
                </div>
              )}
            </div>
          );
        })}

        {status === "submitted" && !errorMsg && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>the scene continues</span>
            <span className="inline-flex gap-1">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground"
                  style={{ animation: "typing-bounce 1.2s infinite", animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          </div>
        )}

        {choices.length > 0 && !completed && (
          <div className="flex flex-wrap gap-2 pt-1">
            {choices.map((c) => (
              <button
                key={c}
                onClick={() => send(c)}
                className="glass rounded-full px-4 py-2 text-xs transition hover:bg-white/10"
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {recap && (
          <div className="glass rounded-2xl p-5 text-sm">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Scene closed</div>
            <p className="mt-2 text-muted-foreground">{recap}</p>
          </div>
        )}

        {errorMsg && (
          <div className="glass rounded-2xl px-4 py-3 text-sm text-muted-foreground">{errorMsg}</div>
        )}
      </div>

      {!completed ? (
        <div className="glass sticky bottom-24 mb-4 flex items-end gap-2 rounded-2xl p-2 md:bottom-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const t = input.trim();
                setInput("");
                void send(t);
              }
            }}
            placeholder="Say or do something…"
            rows={1}
            className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            style={{ maxHeight: "160px" }}
          />
          <button
            onClick={() => {
              const t = input.trim();
              setInput("");
              void send(t);
            }}
            disabled={isBusy || !input.trim()}
            className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="glass mb-4 rounded-2xl p-4 text-center text-xs text-muted-foreground md:mb-4">
          This scene has ended. It lives in Our Story now.
        </div>
      )}

      {showEnd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm md:items-center">
          <div className="glass w-full max-w-md rounded-3xl p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-lg">Save this moment?</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Keep "{title}" in Our Story, and let {characterName} remember it in future conversations.
                </p>
              </div>
              <button onClick={() => setShowEnd(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a short caption (optional)"
              className="mt-4 w-full rounded-xl bg-white/5 px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => endScene(true)}
                disabled={ending}
                className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50"
              >
                {ending ? "Saving…" : "Save moment"}
              </button>
              <button
                onClick={() => endScene(false)}
                disabled={ending}
                className="flex-1 rounded-xl bg-white/5 px-4 py-2.5 text-sm transition hover:bg-white/10 disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
