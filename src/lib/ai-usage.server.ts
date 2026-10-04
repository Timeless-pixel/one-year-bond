// Records app-side AI activity so the admin card can show volume, the last
// error and credit-exhaustion alerts. Never throws — logging must not break chat.
export type AiUsageKind = "chat" | "portrait";
export type AiUsageStatus = "ok" | "credits_exhausted" | "rate_limited" | "error";

export const AI_PROVIDER = "Lovable AI";
export const CHAT_MODEL = "google/gemini-3-flash-preview";
export const PORTRAIT_MODEL = "google/gemini-2.5-flash-image";

/** Short, key-free summary of an upstream error for the admin card. */
export function describeAiError(error: unknown): { code: string; detail: string } {
  const e = error as { statusCode?: number; status?: number; responseBody?: unknown } | null;
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const status = e?.statusCode ?? e?.status ?? Number(/\b(4\d\d|5\d\d)\b/.exec(msg)?.[1] ?? 0);
  const body = typeof e?.responseBody === "string" ? e.responseBody : e?.responseBody ? JSON.stringify(e.responseBody) : "";
  return { code: status ? String(status) : "unknown", detail: (body || msg).replace(/Bearer\s+\S+/g, "Bearer ***").slice(0, 300) };
}

export function statusFromCode(code: string, detail = ""): AiUsageStatus {
  if (code === "402" || /not enough credits|payment.?required/i.test(detail)) return "credits_exhausted";
  if (code === "429") return "rate_limited";
  return "error";
}

export async function logAiUsage(
  kind: AiUsageKind,
  status: AiUsageStatus,
  extra: { model?: string; code?: string; detail?: string } = {},
) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage_events").insert({
      kind,
      status,
      model: extra.model ?? (kind === "chat" ? CHAT_MODEL : PORTRAIT_MODEL),
      error_code: extra.code ?? null,
      error_detail: extra.detail ?? null,
    });
  } catch (e) {
    console.error("[ai-usage] log failed", e instanceof Error ? e.message : e);
  }
}
