// Account-level chat allowance. Limits live in the backend (config in
// src/lib/chat-limits.ts + per-account overrides in account_limits), never in
// the chat UI, so refreshing, new tabs or local storage edits cannot bypass them.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CHAT_LIMITS,
  nextDailyReset,
  startOfDay,
  type ChatLimitState,
} from "@/lib/chat-limits";

export const DEFAULT_DAILY_MESSAGE_LIMIT = CHAT_LIMITS.dailyMessages;

export interface AllowanceResult extends ChatLimitState {
  allowed: boolean;
  /** True once the user is close enough to warrant a gentle heads-up. */
  low?: boolean;
}

function baseState(now: Date): ChatLimitState {
  return {
    serverNow: now.toISOString(),
    used: 0,
    limit: DEFAULT_DAILY_MESSAGE_LIMIT,
    remaining: DEFAULT_DAILY_MESSAGE_LIMIT,
    resetAt: nextDailyReset(now).toISOString(),
    cooldownUntil: null,
    reason: null,
    burstLimit: CHAT_LIMITS.burstMessages,
    burstWindowMs: CHAT_LIMITS.burstWindowMs,
    maxMessageLength: CHAT_LIMITS.maxMessageLength,
  };
}

/**
 * Derived entirely from persisted rows, so the same answer comes back after a
 * refresh, from another tab, or from another device.
 */
export async function readAllowance(
  supabase: SupabaseClient,
  userId: string,
): Promise<AllowanceResult> {
  const now = new Date();
  const since = startOfDay(now);
  // Read far enough back to reconstruct an active cooldown. Looking back only
  // one burst window forgets the triggering messages before the cooldown ends.
  const burstSince = new Date(now.getTime() - CHAT_LIMITS.cooldownMs);

  const [limitRes, countRes, burstRes] = await Promise.all([
    supabase.from("account_limits").select("daily_message_limit").eq("user_id", userId).maybeSingle(),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", since.toISOString()),
    supabase
      .from("messages")
      .select("created_at")
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", burstSince.toISOString())
      .order("created_at", { ascending: false })
      .limit(CHAT_LIMITS.burstMessages),
  ]);

  const state = baseState(now);
  state.limit =
    (limitRes.data?.daily_message_limit as number | undefined) ?? DEFAULT_DAILY_MESSAGE_LIMIT;
  state.used = countRes.count ?? 0;
  state.remaining = Math.max(0, state.limit - state.used);

  // Daily cap first — it is the longer of the two waits.
  if (state.used >= state.limit) {
    state.reason = "daily";
    state.cooldownUntil = state.resetAt;
    return { ...state, allowed: false, low: true };
  }

  const burst = (burstRes.data ?? []) as { created_at: string }[];
  if (burst.length >= CHAT_LIMITS.burstMessages) {
    const newest = new Date(burst[0]?.created_at ?? 0).getTime();
    const oldest = new Date(burst[burst.length - 1]?.created_at ?? 0).getTime();
    const reachedBurstLimit = newest - oldest <= CHAT_LIMITS.burstWindowMs;
    const until = newest + CHAT_LIMITS.cooldownMs;
    if (reachedBurstLimit && until > now.getTime()) {
      state.reason = "burst";
      state.cooldownUntil = new Date(until).toISOString();
      return { ...state, allowed: false, low: state.remaining <= state.limit * 0.2 };
    }
  }

  return { ...state, allowed: true, low: state.remaining <= state.limit * 0.2 };
}

export async function checkAllowance(supabase: SupabaseClient, userId: string) {
  try {
    return await readAllowance(supabase, userId);
  } catch {
    // Never block a conversation because the meter failed to read.
    return { ...baseState(new Date()), allowed: true } as AllowanceResult;
  }
}
