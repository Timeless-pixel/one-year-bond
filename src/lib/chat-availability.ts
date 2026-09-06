import type { ChatLimitState, LimitReason } from "@/lib/chat-limits";

export const CHAT_AVAILABILITY_TIMEOUT_MS = 10_000;

export type ChatUsage = ChatLimitState & { allowed: boolean; low?: boolean };

export type AvailabilityState =
  | { status: "checking"; requestId: number; usage: ChatUsage | null }
  | { status: "available"; requestId: number; usage: ChatUsage }
  | {
      status: "cooldown";
      requestId: number;
      usage: ChatUsage;
      cooldownUntil: string;
      reason: LimitReason;
    }
  | { status: "error"; requestId: number; usage: ChatUsage | null; message: string };

export function resolveAvailability(usage: ChatUsage, requestId: number): AvailabilityState {
  const serverNow = new Date(usage.serverNow).getTime();
  const cooldownAt = usage.cooldownUntil ? new Date(usage.cooldownUntil).getTime() : Number.NaN;
  if (
    usage.cooldownUntil &&
    Number.isFinite(serverNow) &&
    Number.isFinite(cooldownAt) &&
    cooldownAt > serverNow
  ) {
    return {
      status: "cooldown",
      requestId,
      usage,
      cooldownUntil: usage.cooldownUntil,
      reason: usage.reason,
    };
  }
  return { status: "available", requestId, usage };
}