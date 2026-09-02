// Single source of truth for chat usage limits. The backend enforces these;
// the frontend only ever *displays* the state the backend reports.

export const CHAT_LIMITS = {
  /** Messages a user may send per day (can be overridden per account in the DB). */
  dailyMessages: 300,
  /** Burst protection: messages allowed inside `burstWindowMs`. */
  burstMessages: 15,
  burstWindowMs: 60_000,
  /** How long the bond rests once the burst allowance is spent. */
  cooldownMs: 5 * 60_000,
  /** Characters accepted in a single message. */
  maxMessageLength: 4000,
  /** Daily counters roll over at midnight in this zone. */
  resetTimeZone: "UTC" as const,
};

export type LimitReason = "burst" | "daily" | "provider" | null;

export interface ChatLimitState {
  used: number;
  limit: number;
  remaining: number;
  /** ISO timestamp of the next daily reset. */
  resetAt: string;
  /** ISO timestamp when chatting becomes possible again, if paused. */
  cooldownUntil: string | null;
  reason: LimitReason;
  burstLimit: number;
  burstWindowMs: number;
  maxMessageLength: number;
}

/** Next daily reset boundary (UTC midnight) — never the device clock. */
export function nextDailyReset(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

export function startOfDay(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** "12:43" under an hour, "8h 21m" beyond it. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "23:15" local wall-clock label for when chatting resumes. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function limitHeadline(reason: LimitReason, name: string): string {
  switch (reason) {
    case "daily":
      return `Today's chat limit reached`;
    case "provider":
      return `Chat is temporarily unavailable`;
    default:
      return `${name} needs a little breather`;
  }
}

export function limitBody(reason: LimitReason): string {
  switch (reason) {
    case "daily":
      return "You've used all of today's messages. Your bond will be waiting.";
    case "provider":
      return "The service is catching its breath. This clears on its own.";
    default:
      return "You've reached your temporary chat limit.";
  }
}
