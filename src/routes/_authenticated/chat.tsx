import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCharacter, getMessages } from "@/lib/character.functions";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat — Lumen" },
      { name: "description", content: "Talk to your companion." },
    ],
  }),
});

function ChatPage() {
  const fetchCharacter = useServerFn(getMyCharacter);
  const fetchMessages = useServerFn(getMessages);
  const navigate = useNavigate();

  const { data: character, isLoading } = useQuery({
    queryKey: ["character"],
    queryFn: () => fetchCharacter(),
  });
  const { data: initialMessages } = useQuery({
    queryKey: ["messages"],
    queryFn: () => fetchMessages(),
    enabled: !!character,
  });

  useEffect(() => {
    if (!isLoading && !character) navigate({ to: "/create" });
  }, [isLoading, character, navigate]);

  if (isLoading || !character || !initialMessages) {
    return (
      <AppShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ChatWindow character={character} initialMessages={initialMessages as { id: string; role: string; content: string }[]} />
    </AppShell>
  );
}

interface CharacterRow {
  id: string;
  name: string;
  avatar_url: string | null;
  mood: string | null;
  relationship_stage: string | null;
}

const REQUEST_TIMEOUT_MS = 60_000;

/** supabase.auth.getSession() can hang on a stuck lock — never block the send on it. */
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

function ChatWindow({
  character,
  initialMessages,
}: {
  character: CharacterRow;
  initialMessages: { id: string; role: string; content: string }[];
}) {
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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: async (input, init) => {
          const token = await getAccessToken();
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
          if (init?.signal) {
            init.signal.addEventListener("abort", () => controller.abort(), { once: true });
          }
          try {
            const res = await fetch(input, { ...init, headers, signal: controller.signal });
            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              throw new Error(
                res.status === 401
                  ? "Your session expired. Please sign in again."
                  : detail || "Something went wrong while trying to respond. Please try again.",
              );
            }
            return res;
          } finally {
            clearTimeout(timeout);
          }
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: character.id,
    messages: seed,
    transport,
    onError: (err) => {
      const aborted = /abort/i.test(err?.message ?? "");
      setErrorMsg(
        aborted
          ? `${character.name} is taking a little longer than expected. Try again?`
          : err?.message || "Something went wrong while trying to respond. Please try again.",
      );
    },
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status, errorMsg]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const isBusy = status === "submitted" || status === "streaming";

  async function send(text: string) {
    if (!text || sendingRef.current || isBusy) return;
    sendingRef.current = true;
    setErrorMsg(null);
    try {
      await sendMessage({ text });
    } finally {
      sendingRef.current = false;
    }
  }

  async function submit() {
    const text = input.trim();
    if (!text || isBusy || sendingRef.current) return;
    setInput("");
    await send(text);
  }

  async function retry() {
    setErrorMsg(null);
    // Drop the trailing user message and resend it.
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
    if (!text) return;
    setMessages(messages.filter((m) => m.id !== last!.id));
    await send(text);
  }

  // Auto-generate first message if empty
  const greetedRef = useRef(false);
  useEffect(() => {
    if (greetedRef.current || messages.length > 0) return;
    greetedRef.current = true;
    void send(
      "(system: user just met you for the first time — greet them naturally in-character, one or two sentences.)",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  return (
    <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 pt-4 md:pt-6">
      <header className="glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-3">
        <div
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full"
          style={{
            background: character.avatar_url
              ? `center/cover url(${character.avatar_url})`
              : "var(--gradient-primary)",
          }}
        >
          {!character.avatar_url && (
            <div className="flex h-full w-full items-center justify-center font-display italic text-white">
              {character.name[0]}
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {character.name}
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" style={{ animation: "aurora-pulse 2s infinite" }} />
          </div>
          <div className="text-xs text-muted-foreground">
            {character.relationship_stage} · Mood {character.mood}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {messages
          .filter((m: UIMessage) => {
            const t = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            return !(m.role === "user" && t.startsWith("(system:"));
          })
          .map((m: UIMessage) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
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
                  <div className="max-w-[85%] text-sm leading-relaxed text-foreground">
                    <div className="mb-1 text-xs text-muted-foreground">{character.name}</div>
                    <div>{text}</div>
                  </div>
                )}
              </div>
            );
          })}
        {status === "submitted" && !errorMsg && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <div className="mb-1 text-xs">{character.name} is typing</div>
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
        {errorMsg && (
          <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
            <span>{errorMsg}</span>
            <button
              onClick={retry}
              disabled={isBusy}
              className="btn-primary rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
            >
              Try Again
            </button>
          </div>
        )}
      </div>

      <div className="glass sticky bottom-24 mb-4 flex items-end gap-2 rounded-2xl p-2 md:bottom-4">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={`Message ${character.name}…`}
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          style={{ maxHeight: "160px" }}
        />
        <button
          onClick={submit}
          disabled={isBusy || !input.trim()}
          className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
