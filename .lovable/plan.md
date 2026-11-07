# Move text generation to Google Gemini

## User outcome
Companion text generation uses the app’s own Google Gemini API connection instead of Lovable AI, so text requests no longer consume Lovable AI credits. Portrait generation remains on Lovable AI. Chat behavior, prompts, saved conversation data, and database structure stay unchanged.

## Work
1. Securely connect the Google Gemini API key through Lovable’s connector flow; keep credentials server-only.
2. Add a shared server-side text provider that selects Google Gemini and the existing `gemini-3-flash-preview` model. Preserve each existing prompt, sampling setting, output handling, and the live chat stream.
3. Move every text-generation call to that provider: chat replies, summaries, mood and memory extraction, relationship growth and bond moments/letters/dreams, and scenario recaps. Do not alter portrait generation.
4. Update AI error reporting and the admin status card to identify Google Gemini, show its model and real observed status/error details, and clearly say its exact credit balance is unavailable.
5. Add focused tests for provider/error mapping, verify the build, and exercise the chat’s streamed response path if the Google connection is available.

## Technical notes
- Use the official Gemini API from server-side code with the secret held outside browser code; use a Worker-compatible HTTP/AI SDK path.
- No database migration, no new cooldown/allowance, and no changes to chat persistence or message-count rules.
- If the Gemini key is unavailable or rejected, surface the actual provider error; do not silently fall back to Lovable AI.
