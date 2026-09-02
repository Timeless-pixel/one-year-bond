// Client-safe error vocabulary for the chat. The server never sends raw
// provider/database errors to the browser — only one of these codes plus a
// human line written in the product's voice.

export type ChatErrorCode =
  | "rate_limit"
  | "quota"
  | "allowance"
  | "cooldown"
  | "context"
  | "no_character"
  | "timeout"
  | "offline"
  | "unauthorized"
  | "too_long"
  | "server";

const CODES = [
  "rate_limit",
  "quota",
  "allowance",
  "cooldown",
  "context",
  "no_character",
  "timeout",
  "offline",
  "unauthorized",
  "too_long",
  "server",
] as const;

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
  return CODES.includes(code as ChatErrorCode) ? (code as ChatErrorCode) : null;
}

/** True when the category is a usage limit and deserves the cooldown card. */
export function isLimitError(code: ChatErrorCode | null): boolean {
  return code === "allowance" || code === "cooldown" || code === "rate_limit" || code === "quota";
}

/** Contextual, never technical. `name` is the character's name. */
export function chatErrorMessage(code: ChatErrorCode, name: string): string {
  switch (code) {
    case "rate_limit":
      return `Chat is temporarily unavailable — too many requests at once.`;
    case "quota":
      return `${name} needs a short breather — we've hit a temporary limit.`;
    case "cooldown":
      return `${name} needs a little breather.`;
    case "allowance":
      return `You've reached today's chat allowance 💜 ${name} will be here tomorrow.`;
    case "timeout":
      return `That took longer than expected. Try again.`;
    case "offline":
      return `Connection problem. Please try again.`;
    case "unauthorized":
      return `Your session expired. Please sign in again.`;
    case "context":
      return `This conversation grew very large — we're tidying it up. Try again.`;
    case "no_character":
      return `We couldn't load this bond. Try reopening it.`;
    case "too_long":
      return `That message is a little too long — try trimming it down.`;
    default:
      return `Something went wrong while ${name} was responding.`;
  }
}

/** Only transient categories are worth an automatic retry. */
export function isRetryable(code: ChatErrorCode): boolean {
  return code === "timeout" || code === "offline" || code === "server" || code === "context";
}
