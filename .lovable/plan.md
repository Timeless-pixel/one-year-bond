# Fix chat availability and add message editing

## Root cause to fix

The screen currently has two competing availability representations. The page can reach `available`, while a stale `limitInfo` value still makes `CooldownCard` render. When that stale limit has no future timestamp, `CooldownCard` derives its own local “Checking…” state but cannot trigger `onReady` because there is no `until` value. This produces the exact observed combination: a valid usage count, disabled “Chat paused” input, and a permanent “Checking…” card even though the request has finished.

The availability request is also initiated through React Query and then mirrored into separate local state, allowing cached usage, query status, `limitInfo`, `readyLimit`, and the cooldown card’s timer state to disagree.

## Implementation

### 1. Make availability one authoritative state machine

- Replace the parallel `availabilityStatus`, `limitInfo`, `readyLimit`, cached-limit derivation, and cooldown-card “checking” inference with one discriminated state:
  - `checking` with request id
  - `available` with the latest usage data
  - `cooldown` with the latest usage data and one authoritative `cooldownUntil`
  - `error` with retry copy
- Run exactly one availability check on chat mount after the authenticated page and character data are ready.
- Give each check a monotonically increasing request id and a real 10-second `Promise.race`; ignore every completion whose id is no longer current.
- Log each requested diagnostic transition without tokens or message content: start, server call started/resolved/failed, timeout, cooldown timestamp, and final state.
- Interpret the backend response from `serverNow` and `cooldownUntil`, not `allowed` alone:
  - null/invalid/expired cooldown → available
  - future cooldown → cooldown
- Do not automatically re-check after reaching `available`. A fresh check occurs only on initial mount, explicit Try Again/Continue, before a send, or when an active countdown expires.
- Keep availability reads read-only; they will not insert messages or invoke AI.

### 2. Remove competing cooldown UI behavior

- Make `CooldownCard` purely display the authoritative cooldown state; it will no longer invent a second “checking” state from a missing timestamp.
- At countdown expiry, issue one fresh availability check. Show the ready/continue state only from the parent state machine.
- Derive the composer placeholder and disabled conditions only from the single availability state.
- Before send, require the current state to be `available`, then perform one fresh authoritative check before adding the optimistic user message. Cooldown/checking/error states never send.
- Continue Chat and Try Again invalidate any stale request and start one new check.

### 3. Add secure persisted message editing

- Add an `edited_at` nullable timestamp to messages through a database migration.
- Tighten message update access so authenticated users can update only their own rows whose role is `user`; character/AI rows remain non-editable at the database level.
- Add an authenticated server operation that validates the message id/content, verifies ownership and `role = user`, updates that row in place, and returns the updated message. It will not call AI, insert a row, or touch usage/cooldown state.
- Include `created_at` and `edited_at` in message loading.
- Add a subtle three-dot menu to user bubbles with Copy and Edit. Edit becomes an inline textarea with Save and Cancel; Save updates the existing message immediately in the chat state and cache.
- Show a subtle “Edited” label on edited user messages.
- Treat the first existing assistant response after an edited user message as stale in the conversation display and show an explicit “Regenerate response” action. Editing alone never regenerates or consumes allowance; regeneration remains an explicit AI request and uses the existing retry protections.

### 4. Verification

- Add focused tests for the state reducer/response interpretation and stale-request protection:
  - success with no cooldown → available
  - expired cooldown → available
  - future cooldown → cooldown
  - rejection/10-second timeout → error
  - late Request A cannot overwrite successful Request B
  - countdown expiry requests one refresh
- Add tests for editing authorization and behavior:
  - owned user message updates in place and gets `edited_at`
  - assistant and non-owned messages cannot be edited
  - row count and usage count do not change
  - stale-response marker is derived correctly
- Run the actual signed-in chat in the browser and capture the visible transitions for normal availability, forced hanging request, cooldown, expiry, Continue Chat, message send, edit/save, refresh persistence, unchanged usage, and no duplicate row.
- Check runtime/network logs and the latest build result before reporting completion. If authenticated browser access is unavailable, report that limitation explicitly rather than claiming live verification.
