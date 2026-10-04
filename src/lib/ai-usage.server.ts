// Records app-side AI activity so the admin card can show volume and
// credit-exhaustion alerts. Never throws — logging must not break chat.
export type AiUsageKind = "chat" | "portrait";
export type AiUsageStatus = "ok" | "credits_exhausted" | "error";

export async function logAiUsage(kind: AiUsageKind, status: AiUsageStatus) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_events").insert({ kind, status });
  } catch (e) {
    console.error("[ai-usage] log failed", e instanceof Error ? e.message : e);
  }
}
