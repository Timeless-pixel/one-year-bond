import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useActiveBondId } from "@/hooks/useActiveBond";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyCharacter, getMessages, updateMessage } from "@/lib/character.functions";
import { getBondExperience } from "@/lib/bond.functions";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Check, Copy, MoreHorizontal, Pencil, RefreshCw, Send, X } from "lucide-react";
import { parseExpression, EXPRESSION_EMOJI, EXPRESSION_GLOW, isRomanticBond, DEFAULT_BOND_SETTINGS, type BondSettings, type Expression } from "@/lib/emotion-shared";
import { parseScene, splitActions, quickInteractions, daysTogether, journeyLabel } from "@/lib/scene-shared";
import { getChatUsage } from "@/lib/character.functions";
import { CooldownCard, UsageMeter } from "@/components/ChatLimit";
import type { ChatLimitState } from "@/lib/chat-limits";
import {
  CHAT_AVAILABILITY_TIMEOUT_MS,
  resolveAvailability,
  type AvailabilityState,
  type ChatUsage,
} from "@/lib/chat-availability";
import { Button } from "@/components/ui/button";
import {
  decodeChatError,
  isLimitError,
  encodeChatError,
  chatErrorMessage,
  isRetryable,
  type ChatErrorCode,
} from "@/lib/chat-errors";


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
  const { data: initial } = useQuery({
    queryKey: ["messages"],
    queryFn: () => fetchMessages({ data: {} }),
    enabled: !!character,
  });

  useEffect(() => {
    if (!isLoading && !character) navigate({ to: "/create" });
  }, [isLoading, character, navigate]);

  if (isLoading || !character || !initial) {
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
      <ChatWindow character={character} initialMessages={initial.messages} />
    </AppShell>
  );

}

interface CharacterRow {
  id: string;
  name: string;
  avatar_url: string | null;
  mood: string | null;
  relationship_stage: string | null;
  relationship_type?: string | null;
  journey_start_date?: string | null;
  expression?: string | null;
}


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

/** Strips the control tags and returns spoken text + physical actions. */
function renderable(raw: string) {
  const { text: noExpr } = parseExpression(raw);
  const { text, scene } = parseScene(noExpr);
  return { segments: splitActions(text), scene };
}

function ChatWindow({
  character,
  initialMessages,
}: {
  character: CharacterRow;
  initialMessages: {
    id: string;
    role: string;
    content: string;
    created_at?: string;
    edited_at?: string | null;
  }[];
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

  const [activeBondId] = useActiveBondId();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ChatErrorCode | null>(null);
  // Absolute timestamp reported by the backend — survives refresh because the
  // backend recomputes it from persisted rows.
  const limitRef = useRef<{ retryAt: string | null; reason: string | null }>({
    retryAt: null,
    reason: null,
  });
  const availabilityRequestIdRef = useRef(0);
  const [availability, setAvailability] = useState<AvailabilityState>({
    status: "checking",
    requestId: 0,
    usage: null,
  });
  const [showUsage, setShowUsage] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [messageMeta, setMessageMeta] = useState(() =>
    new Map(
      initialMessages.map((message) => [
        message.id,
        { createdAt: message.created_at ?? null, editedAt: message.edited_at ?? null },
      ]),
    ),
  );

  const fetchUsage = useServerFn(getChatUsage);
  const editMessage = useServerFn(updateMessage);


  const fetchExperience = useServerFn(getBondExperience);
  const { data: experience } = useQuery({
    queryKey: ["bond-experience", activeBondId ?? character.id],
    queryFn: () => fetchExperience({ data: { characterId: activeBondId } }),
  });
  const settings: BondSettings = experience?.settings ?? DEFAULT_BOND_SETTINGS;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { characterId: activeBondId ?? null, localHour: new Date().getHours() },
        fetch: async (input, init) => {
          const token = await getAccessToken();
          const headers = new Headers(init?.headers);
          if (token) headers.set("Authorization", `Bearer ${token}`);

          try {
            const res = await fetch(input, { ...init, headers });
            if (!res.ok) {
              const detail = await res.text().catch(() => "");
              let code = decodeChatError(detail);
              try {
                const parsed = JSON.parse(detail) as {
                  error?: ChatErrorCode;
                  retryAt?: string | null;
                  reason?: string | null;
                };
                code = code ?? parsed.error ?? null;
                limitRef.current = {
                  retryAt: parsed.retryAt ?? null,
                  reason: parsed.reason ?? null,
                };
              } catch {
                limitRef.current = { retryAt: null, reason: null };
              }
              if (!limitRef.current.retryAt) {
                const ra = res.headers.get("retry-after");
                if (ra && Number.isFinite(Number(ra))) {
                  limitRef.current = {
                    retryAt: new Date(Date.now() + Number(ra) * 1000).toISOString(),
                    reason: limitRef.current.reason ?? "provider",
                  };
                }
              }
              throw new Error(
                encodeChatError(
                  code ?? (res.status === 401 ? "unauthorized" : res.status === 429 ? "rate_limit" : "server"),
                ),
              );

            }
            return res;
          } finally {
            // AI generation has no artificial timeout; the SDK signal still
            // supports an explicit user cancellation.
          }
        },
      }),
    [activeBondId],
  );

  const { messages, sendMessage, status, setMessages } = useChat({
    id: character.id,
    messages: seed,
    transport,
    onError: (err) => {
      const raw = err?.message ?? "";
      const code: ChatErrorCode =
        decodeChatError(raw) ?? (/abort|timeout/i.test(raw) ? "timeout" : "server");
      setErrorCode(code);
      setErrorMsg(chatErrorMessage(code, character.name));
      if (isLimitError(code)) {
        void refreshAvailability();
      }
    },

  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: settings.animations ? "smooth" : "auto",
    });
  }, [messages, status, errorMsg, settings.animations]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [status]);

  const isBusy = status === "submitted" || status === "streaming";
  const checkingAvailability = availability.status === "checking";
  const usage = availability.usage;

  async function refreshAvailability(): Promise<ChatUsage | null> {
    const requestId = ++availabilityRequestIdRef.current;
    console.log("[CHAT AVAILABILITY] START", { requestId });
    setAvailability((current) => ({ status: "checking", requestId, usage: current.usage }));
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      console.log("[CHAT AVAILABILITY] getChatUsage started", { requestId });
      const current = await Promise.race([
        fetchUsage(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            console.log("[CHAT AVAILABILITY] timeout", { requestId });
            reject(new Error("Chat availability request timed out"));
          }, CHAT_AVAILABILITY_TIMEOUT_MS);
        }),
      ]);
      if (requestId !== availabilityRequestIdRef.current) return null;
      console.log("[CHAT AVAILABILITY] getChatUsage resolved", current);
      console.log("[CHAT AVAILABILITY] cooldownUntil", current.cooldownUntil);
      const next = resolveAvailability(current, requestId);
      setAvailability(next);
      console.log("[CHAT AVAILABILITY] final status", next.status);
      return current;
    } catch (error) {
      if (requestId !== availabilityRequestIdRef.current) return null;
      console.log("[CHAT AVAILABILITY] getChatUsage failed", error);
      setAvailability({
        status: "error",
        requestId,
        usage: null,
        message: "Unable to check chat availability.",
      });
      console.log("[CHAT AVAILABILITY] final status", "error");
      return null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  useEffect(() => {
    void refreshAvailability();
    return () => {
      availabilityRequestIdRef.current += 1;
    };
    // The authenticated chat window mounts once per bond.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character.id]);

  async function send(text: string, opts?: { retry?: boolean }) {
    if (!text || sendingRef.current || isBusy || availability.status !== "available") return;
    sendingRef.current = true;
    setErrorMsg(null);
    setErrorCode(null);

    try {
      // The backend is authoritative. This prevents an optimistic user bubble
      // from appearing before a still-active cooldown is discovered.
      const availability = await refreshAvailability();
      if (!availability) return;
      const confirmed = resolveAvailability(availability, availabilityRequestIdRef.current);
      if (confirmed.status !== "available") return;
      await sendMessage({ text }, opts?.retry ? { body: { retry: true } } : undefined);
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
    setErrorCode(null);
    // Regenerate from the message that is already on screen and already saved:
    // the server skips re-recording it when `retry` is set.
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
    if (!text) return;
    if (!last) return;
    setMessages(messages.filter((m) => m.id !== last.id));
    await send(text, { retry: true });
  }

  function messageText(message: UIMessage) {
    return message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  }

  function startEditing(message: UIMessage) {
    setEditingId(message.id);
    setEditText(messageText(message));
    setEditError(null);
    setOpenMenuId(null);
  }

  async function saveEdit(messageId: string) {
    const content = editText.trim();
    if (!content || savingEdit) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await editMessage({ data: { id: messageId, content } });
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, parts: [{ type: "text" as const, text: updated.content }] }
            : message,
        ),
      );
      setMessageMeta((current) => {
        const next = new Map(current);
        const previous = next.get(messageId);
        next.set(messageId, {
          createdAt: updated.created_at ?? previous?.createdAt ?? null,
          editedAt: updated.edited_at,
        });
        return next;
      });
      setEditingId(null);
      setEditText("");
    } catch {
      setEditError("Unable to save this edit. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  function staleReplyFor(index: number) {
    const message = messages[index];
    if (!message || message.role !== "assistant" || index === 0) return null;
    const previous = messages[index - 1];
    if (!previous || previous.role !== "user") return null;
    const editedAt = messageMeta.get(previous.id)?.editedAt;
    const assistantCreatedAt = messageMeta.get(message.id)?.createdAt;
    if (!editedAt || !assistantCreatedAt) return null;
    return new Date(assistantCreatedAt).getTime() < new Date(editedAt).getTime() ? previous : null;
  }

  async function regenerateEdited(userMessage: UIMessage) {
    if (availability.status !== "available" || isBusy) return;
    const targetIndex = messages.findIndex((message) => message.id === userMessage.id);
    if (targetIndex < 0) return;
    setMessages(messages.slice(0, targetIndex));
    await send(messageText(userMessage), { retry: true });
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

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastAssistantRaw =
    lastAssistant?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";
  const liveExpression =
    parseExpression(lastAssistantRaw).expression ??
    ((character.expression as Expression | null) ?? "neutral");
  const liveScene = renderable(lastAssistantRaw).scene ?? settings.scene;
  const glow = settings.expressions ? EXPRESSION_GLOW[liveExpression] : "transparent";

  const quick = useMemo(
    () =>
      quickInteractions({
        stageIndex: experience?.level?.index ?? 0,
        romantic: isRomanticBond(character.relationship_type ?? ""),
        expression: liveExpression,
      }),
    [experience?.level?.index, character.relationship_type, liveExpression],
  );

  const availabilityStatus = availability.status;
  const availabilityError = availability.status === "error" ? availability.message : null;
  const activeLimit =
    availability.status === "cooldown"
      ? { retryAt: availability.cooldownUntil, reason: availability.reason }
      : null;
  const limited = Boolean(activeLimit);

  const days = character.journey_start_date ? daysTogether(character.journey_start_date) : null;

  return (
    <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col px-4 pt-4 md:pt-6">
      <header className="glass mb-4 flex items-center gap-3 rounded-2xl px-4 py-3">
        <div
          className="h-11 w-11 shrink-0 overflow-hidden rounded-full"
          style={{
            background: character.avatar_url
              ? `center/cover url(${character.avatar_url})`
              : "var(--gradient-primary)",
            boxShadow: `0 0 0 2px ${glow ?? "transparent"}, 0 0 22px -4px ${glow ?? "transparent"}`,
            transition: settings.animations ? "box-shadow 700ms ease, transform 3s ease-in-out" : "none",
            animation: settings.animations ? "breathe 6s ease-in-out infinite" : undefined,
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
            <span
              className="h-1.5 w-1.5 rounded-full bg-green-400"
              style={settings.animations ? { animation: "aurora-pulse 2s infinite" } : undefined}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            {character.relationship_stage}
            {settings.expressions && ` · ${EXPRESSION_EMOJI[liveExpression] ?? "🙂"} ${liveExpression}`}
            {days ? ` · ${journeyLabel(days)}` : ""}
          </div>
        </div>
      </header>

      {liveScene && (
        <div className="mb-3 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
          {liveScene}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
        {messages
          .filter((m: UIMessage) => {
            const t = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            return !(m.role === "user" && t.startsWith("(system:"));
          })
          .map((m: UIMessage) => {
            const raw = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const { segments } = renderable(raw);
            const mine = m.role === "user";
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} ${settings.animations ? "animate-fade-in" : ""}`}
              >
                {mine ? (
                  <div
                    className="max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm"
                    style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
                  >
                    {segments.map((s, i) =>
                      s.type === "action" ? (
                        <span key={i} className="mr-1 italic opacity-80">
                          *{s.value}*
                        </span>
                      ) : (
                        <span key={i}>{s.value} </span>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="max-w-[85%] text-sm leading-relaxed text-foreground">
                    <div className="mb-1 text-xs text-muted-foreground">{character.name}</div>
                    <div className="space-y-1">
                      {segments.map((s, i) =>
                        s.type === "action" ? (
                          <div
                            key={i}
                            className="border-l-2 border-primary/40 pl-3 text-[13px] italic text-muted-foreground"
                          >
                            {s.value}
                          </div>
                        ) : (
                          <div key={i}>{s.value}</div>
                        ),
                      )}
                    </div>
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
                  style={
                    settings.animations
                      ? { animation: "typing-bounce 1.2s infinite", animationDelay: `${d}ms` }
                      : undefined
                  }
                />
              ))}
            </span>
          </div>
        )}
        {limited && activeLimit && (
          <CooldownCard
            name={character.name}
            reason={(activeLimit.reason as "burst" | "daily" | "provider" | null) ?? "burst"}
            until={activeLimit.retryAt}
            busy={isBusy || checkingAvailability}
            onContinue={() => {
              void refreshAvailability().then((current) => {
                if (!current?.allowed) return;
                setErrorMsg(null);
                setErrorCode(null);
                inputRef.current?.focus();
              });
            }}
          />
        )}
        {errorMsg && !limited && (
          <div className="glass flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm text-muted-foreground">
            <span>{errorMsg}</span>
            {(!errorCode || isRetryable(errorCode)) && (
              <button
                onClick={retry}
                disabled={isBusy}
                className="btn-primary rounded-xl px-3 py-1.5 text-xs disabled:opacity-50"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {availabilityStatus === "error" && availabilityError && !limited && (
          <div className="glass mx-auto flex w-full max-w-sm flex-col items-center rounded-2xl px-5 py-5 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-medium">{availabilityError}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
            <Button
              type="button"
              size="sm"
              className="mt-4"
              disabled={checkingAvailability}
              onClick={() => void refreshAvailability()}
            >
              Try Again
            </Button>
          </div>
        )}

        {checkingAvailability && !limited && (
          <div
            className="mx-auto flex items-center gap-2 py-3 text-xs text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
            Checking chat availability…
          </div>
        )}

      </div>

      {settings.quickButtons && (
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
          {quick.map((q) => (
            <button
              key={q.label}
              onClick={() => void send(q.send)}
              disabled={isBusy || limited}
              className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {usage && (
        <div className="mb-2">
          <button
            onClick={() => setShowUsage((v) => !v)}
            className="text-[11px] text-muted-foreground transition hover:text-foreground"
          >
            {showUsage ? "Hide usage" : `${usage.remaining} messages left today`}
          </button>
          {showUsage && <UsageMeter state={usage as ChatLimitState} className="mt-2" />}
        </div>
      )}

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
          disabled={limited || checkingAvailability || availabilityStatus === "error"}
          placeholder={
            limited
              ? "Chat paused — see the timer above"
              : `Message ${character.name}… (*actions in asterisks*)`
          }
          rows={1}
          className="flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
          style={{ maxHeight: "160px" }}
        />
        <button
          onClick={submit}
          disabled={
            isBusy ||
            limited ||
            checkingAvailability ||
            availabilityStatus === "error" ||
            !input.trim()
          }
          className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
