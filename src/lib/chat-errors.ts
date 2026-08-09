// Client-safe error vocabulary for the chat. The server never sends raw
// provider/database errors to the browser — only one of these codes plus a
// human line written in the product's voice.

export type ChatErrorCode =
  | "rate_limit"
  | "quota"
  | "allowance"
  | "timeout"
  | "offline"
  | "unauthorized"
  | "server";

export const CHAT_ERROR_PREFIX = "ONEYEARBOND_ERR:";

/** Encoded so it can travel through the AI SDK stream error channel as text. */
export function encodeChatError(code: ChatErrorCode): string {
  return `${CHAT_ERROR_PREFIX}${code}`;
}

export function decodeChatError(raw: string | undefined | null): ChatErrorCode | null {
  if (!raw) return null;
  const i = raw.indexOf(CHAT_ERROR_PREFIX);
  if (i === -1) return null;
  const code = raw.slice(i + CHAT_ERROR_PREFIX.length).trim().split(/[^a-z_]/)[0];
  return (
    ["rate_limit", "quota", "allowance", "timeout", "offline", "unauthorized", "server"] as const
  ).includes(code as ChatErrorCode)
    ? (code as ChatErrorCode)
    : null;
}

/** Contextual, never technical. `name` is the character's name. */
export function chatErrorMessage(code: ChatErrorCode, name: string): string {
  switch (code) {
    case "rate_limit":
      return `Looks like we're talking a little too much at once 😅 Give me a moment and I'll be back.`;
    case "quota":
      return `${name} needs a short breather — we've hit a temporary limit. Try again in a little while.`;
    case "allowance":
      return `You've reached today's chat allowance 💜 ${name} will be here tomorrow.`;
    case "timeout":
      return `${name} is taking longer than usual to respond.`;
    case "offline":
      return `Looks like the connection dropped.`;
    case "unauthorized":
      return `Your session expired. Please sign in again.`;
    default:
      return `${name} is having trouble responding right now.`;
  }
}

/** Only transient categories are worth an automatic retry. */
export function isRetryable(code: ChatErrorCode): boolean {
  return code === "timeout" || code === "offline" || code === "server" || code === "rate_limit";
}
