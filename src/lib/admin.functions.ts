import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AiCreditStatus = {
  isAdmin: boolean;
  chatToday: number;
  chatMonth: number;
  portraitToday: number;
  portraitMonth: number;
  lastExhaustedAt: string | null;
  lastOkAt: string | null;
  exhausted: boolean;
  failuresLastHour: number;
};

const EMPTY: AiCreditStatus = {
  isAdmin: false, chatToday: 0, chatMonth: 0, portraitToday: 0, portraitMonth: 0,
  lastExhaustedAt: null, lastOkAt: null, exhausted: false, failuresLastHour: 0,
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
    const latest = async (status: string) => {
      const { data } = await supabase.from("ai_usage_events").select("created_at")
        .eq("status", status).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data?.created_at ?? null;
    };
    const [chatToday, chatMonth, portraitToday, portraitMonth, lastExhaustedAt, lastOkAt, fails] = await Promise.all([
      count("chat", dayStart), count("chat", monthStart),
      count("portrait", dayStart), count("portrait", monthStart),
      latest("credits_exhausted"), latest("ok"),
      supabase.from("ai_usage_events").select("id", { count: "exact", head: true })
        .eq("status", "credits_exhausted").gte("created_at", hourAgo),
    ]);
    const exhausted = !!lastExhaustedAt && (!lastOkAt || lastExhaustedAt > lastOkAt);
    return {
      isAdmin: true, chatToday, chatMonth, portraitToday, portraitMonth,
      lastExhaustedAt, lastOkAt, exhausted, failuresLastHour: fails.count ?? 0,
    };
  });
