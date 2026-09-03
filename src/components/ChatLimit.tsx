import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  formatClock,
  formatCountdown,
  limitBody,
  limitHeadline,
  type ChatLimitState,
  type LimitReason,
} from "@/lib/chat-limits";

/** Live remaining milliseconds against an absolute timestamp (refresh-proof). */
export function useCountdown(untilIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!untilIso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [untilIso]);
  if (!untilIso) return { remaining: 0, done: true };
  const remaining = new Date(untilIso).getTime() - now;
  return { remaining: Math.max(0, remaining), done: remaining <= 0 };
}

export function CooldownCard({
  name,
  reason,
  until,
  onReady,
  onContinue,
  busy,
  readyConfirmed = false,
}: {
  name: string;
  reason: LimitReason;
  until: string | null;
  onReady?: () => void;
  onContinue: () => void;
  busy?: boolean;
  readyConfirmed?: boolean;
}) {
  const { remaining, done } = useCountdown(until);
  const [open, setOpen] = useState(false);
  const notifiedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!done || !until || !onReady || notifiedFor.current === until) return;
    notifiedFor.current = until;
    onReady();
  }, [done, until, onReady]);

  const ready = readyConfirmed;
  const checking = done && !readyConfirmed;

  return (
    <div
      className="glass relative mx-auto w-full max-w-sm overflow-hidden rounded-3xl px-6 py-7 text-center"
      style={{ boxShadow: "0 0 60px -25px var(--primary)" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-40 opacity-40 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative">
        <div className="text-3xl">{ready ? "✨" : "💜"}</div>
        <h2 className="mt-3 text-lg font-medium">
          {ready
            ? `${name} is ready to talk again.`
            : checking
              ? "Checking chat availability…"
              : limitHeadline(reason, name)}
        </h2>

        {!ready && !checking && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{limitBody(reason)}</p>
            <div
              className="text-gradient mt-5 font-display text-5xl tabular-nums"
              aria-live="polite"
            >
              {formatCountdown(remaining)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              until you can chat again{until ? ` · around ${formatClock(until)}` : ""}
            </p>
            <p className="mt-4 text-sm italic text-muted-foreground">Your bond will be waiting.</p>
          </>
        )}

        <button
          onClick={onContinue}
          disabled={!ready || busy}
          className="btn-primary mt-5 rounded-xl px-5 py-2 text-sm disabled:opacity-40"
        >
          {ready ? "Continue chat" : checking ? "Checking…" : "Waiting…"}
        </button>

        <button
          onClick={() => setOpen((o) => !o)}
          className="mx-auto mt-5 flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          Why can&apos;t I chat?
          <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <p className="mt-2 text-left text-xs leading-relaxed text-muted-foreground">
            One-Year Bond temporarily limits AI messages to protect performance and prevent
            excessive usage. Nothing is wrong with {name} — you can continue as soon as the timer
            ends.
          </p>
        )}
      </div>
    </div>
  );
}

/** Subtle "40 / 50 messages" meter. */
export function UsageMeter({ state, className = "" }: { state: ChatLimitState; className?: string }) {
  const pct = state.limit > 0 ? Math.min(100, (state.used / state.limit) * 100) : 0;
  const { remaining } = useCountdown(state.resetAt);
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Today&apos;s bond usage</span>
        <span className="tabular-nums">
          {state.used} / {state.limit} messages
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: "var(--gradient-primary)" }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{state.remaining} remaining today</span>
        <span className="tabular-nums">resets in {formatCountdown(remaining)}</span>
      </div>
    </div>
  );
}
