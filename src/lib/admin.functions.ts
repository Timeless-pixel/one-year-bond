import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiCreditStatus = {
  isAdmin: boolean;
  provider: string;
  model: string;
  chatToday: number;
  chatMonth: number;
  portraitToday: number;
  portraitMonth: number;
  lastOkAt: string | null;
  lastFailAt: string | null;
  lastErrorCode: string | null;
  lastErrorDetail: string | null;
  lastFailStatus: string | null;
  exhausted: boolean;
  failuresLastHour: number;
};

const EMPTY: AiCreditStatus = {
  isAdmin: false, provider: "", model: "", chatToday: 0, chatMonth: 0, portraitToday: 0, portraitMonth: 0,
  lastOkAt: null, lastFailAt: null, lastErrorCode: null, lastErrorDetail: null, lastFailStatus: null,
  exhausted: false, failuresLastHour: 0,
};

export const getAiCreditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AiCreditStatus> => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return EMPTY;

    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const hourAgo = new Date(now.getTime() - 3600_000).toISOString();

    const count = async (kind: string, since: string) => {
      const { count } = await supabase.from("ai_usage_events").select("id", { count: "exact", head: true })
        .eq("kind", kind).eq("status", "ok").gte("created_at", since);
      return count ?? 0;
    };
    const [chatToday, chatMonth, portraitToday, portraitMonth, okRes, failRes, fails] = await Promise.all([
      count("chat", dayStart), count("chat", monthStart),
      count("portrait", dayStart), count("portrait", monthStart),
      supabase.from("ai_usage_events").select("created_at").eq("status", "ok")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ai_usage_events").select("created_at, status, error_code, error_detail").neq("status", "ok")
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("ai_usage_events").select("id", { count: "exact", head: true })
        .neq("status", "ok").gte("created_at", hourAgo),
    ]);
    const lastOkAt = okRes.data?.created_at ?? null;
    const fail = failRes.data;
    const exhausted = fail?.status === "credits_exhausted" && (!lastOkAt || fail.created_at > lastOkAt);
    return {
      isAdmin: true,
      provider: "Lovable AI",
      model: "google/gemini-3-flash-preview",
      chatToday, chatMonth, portraitToday, portraitMonth,
      lastOkAt,
      lastFailAt: fail?.created_at ?? null,
      lastErrorCode: fail?.error_code ?? null,
      lastErrorDetail: fail?.error_detail ?? null,
      lastFailStatus: fail?.status ?? null,
      exhausted,
      failuresLastHour: fails.count ?? 0,
    };
  });
