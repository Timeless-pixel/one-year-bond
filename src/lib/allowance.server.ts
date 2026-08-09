// Account-level chat allowance. Limits live in the database (account_limits),
// not in the chat UI, so plans can change without touching the client.

import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_DAILY_MESSAGE_LIMIT = 300;

export interface AllowanceResult {
  allowed: boolean;
  used: number;
  limit: number;
  /** True once the user is close enough to warrant a gentle heads-up. */
  low?: boolean;
}

export async function readAllowance(
  supabase: SupabaseClient,
  userId: string,
): Promise<AllowanceResult> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const [limitRes, countRes] = await Promise.all([
    supabase.from("account_limits").select("daily_message_limit").eq("user_id", userId).maybeSingle(),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", since.toISOString()),
  ]);

  const limit =
    (limitRes.data?.daily_message_limit as number | undefined) ?? DEFAULT_DAILY_MESSAGE_LIMIT;
  const used = countRes.count ?? 0;
  return { allowed: used < limit, used, limit, low: used >= limit * 0.8 };
}

export async function checkAllowance(supabase: SupabaseClient, userId: string) {
  try {
    return await readAllowance(supabase, userId);
  } catch {
    // Never block a conversation because the meter failed to read.
    return { allowed: true, used: 0, limit: DEFAULT_DAILY_MESSAGE_LIMIT };
  }
}
