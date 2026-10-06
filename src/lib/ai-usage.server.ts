// Records app-side AI activity so the admin card can show volume, the last
// error and credit-exhaustion alerts. Never throws — logging must not break chat.
export type AiUsageKind = "chat" | "portrait";
export type AiUsageStatus =
  | "ok"
  | "credits_exhausted"
  | "rate_limited"
  | "auth_error"
  | "provider_error"
  | "timeout"
  | "error"; // unknown

export const AI_PROVIDER = "Lovable AI";
export const CHAT_MODEL = "google/gemini-3-flash-preview";
export const PORTRAIT_MODEL = "google/gemini-2.5-flash-image";

type ErrLike = { statusCode?: number; status?: number; responseBody?: unknown; cause?: unknown; lastError?: unknown; errors?: unknown[]; name?: string; message?: string } | null;

/** Short, key-free summary of an upstream error. Unwraps AI SDK retry/cause wrappers to find the real HTTP status. */
export function describeAiError(error: unknown): { code: string; detail: string } {
  const chain: ErrLike[] = [];
  let cur = error as ErrLike;
  for (let i = 0; cur && i < 6; i++) {
    chain.push(cur);
    cur = (cur.lastError ?? (Array.isArray(cur.errors) ? cur.errors.at(-1) : undefined) ?? cur.cause) as ErrLike;
  }
  let status = 0;
  let body = "";
  for (const e of chain) {
    status ||= e?.statusCode ?? e?.status ?? 0;
    if (!body && e?.responseBody) body = typeof e.responseBody === "string" ? e.responseBody : JSON.stringify(e.responseBody);
  }
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const isTimeout = chain.some((e) => /abort|timeout/i.test(`${e?.name ?? ""} ${e?.message ?? ""}`));
  if (!status) status = Number(/\b(4\d\d|5\d\d)\b/.exec(`${body} ${msg}`)?.[1] ?? 0);
  const code = status ? String(status) : isTimeout ? "timeout" : "unknown";
  return { code, detail: (body || msg).replace(/Bearer\s+\S+/g, "Bearer ***").slice(0, 300) };
}

/** Classify only from what the provider actually reported — never guess "credits". */
export function statusFromCode(code: string, detail = ""): AiUsageStatus {
  if (code === "402" || /not enough credits|insufficient.{0,10}credits|credit_limit_reached/i.test(detail)) return "credits_exhausted";
  if (code === "429") return "rate_limited";
  if (code === "401" || code === "403") return "auth_error";
  if (code === "timeout" || code === "408" || code === "504") return "timeout";
  if (/^5\d\d$/.test(code)) return "provider_error";
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
