# Research: Clean Up Quote

## Decision 1: Reuse the Python `AnthropicClient`, don't add a second Anthropic caller in TypeScript

**Decision**: The quote clean-up call goes through a new thin CLI, `scripts/clean_quote.py`, built on the existing `scripts/lib/llm_client.py` (`AnthropicClient`, `load_api_key`, `load_model_tier`, `resolve_primary_model`) and a new pure function `clean_quote(text, llm)` in `scripts/lib/wiki_convert.py`. The Electron main process spawns it via `child_process.spawn('python3', [...])`, the same pattern `src/main/ipc/collections.ts` already uses for `ocr_to_markdown.py`.

**Rationale**: Every existing Claude call (OCR cleanup, illustration captions) already goes through `llm_client.py`, which owns key loading, model-tier resolution, the HTTP transport, and error handling. Adding a second, parallel Anthropic client in Node would duplicate all of that (API version header, `MAX_TOKENS`, key-file path, model IDs) in a second language for no benefit — the quote text is small, so there's no latency/perf reason to avoid the subprocess hop. This matches Constitution Principle V (minimal additions, repo-fit design): extend `scripts/lib/`, don't invent a second implementation.

**Alternatives considered**:
- *Direct HTTPS call from the Electron main process (Node's built-in `fetch`)*: rejected — duplicates key loading, model resolution, and the request shape already implemented and tested in `llm_client.py`; two copies of the same integration drift over time.
- *Reuse `ocr_to_markdown.py` itself with a new flag*: rejected — that script is structured around walking a collection's PDF folders; forcing a single short string through it would be a worse fit than a small dedicated CLI.

## Decision 2: Narrow DB read/update — don't reuse the generic `updateSource()` path or fetch every source to find one

**Decision**: Add two narrow functions to `src/main/db/sources.ts`: `getSourceQuote(shelterId: number, sourceId: number): string` (a direct `SELECT quote FROM shelter_sources WHERE shelter_id = ? AND source_id = ?`, used by the IPC handler to fetch the text to clean up) and `updateSourceQuote(shelterId: number, sourceId: number, quote: string): Source` (only runs `UPDATE shelter_sources SET quote = ? WHERE shelter_id = ? AND source_id = ?`, then re-selects and returns the hydrated `Source`). The clean-up IPC handler calls both — never the existing `updateSource()`, and never `getSourcesByShelter()` (which returns every source for the shelter just to find one by id).

**Rationale**: The existing `updateSource()` also runs `UPDATE sources SET ... updated = ? WHERE id = ?`, unconditionally bumping the `sources.updated` timestamp (shown on every `SourceCard`) even though only one join-table column changed. Spec requirement FR-003 ("MUST NOT modify any other field") and SC-002 ("100% ... leave every other source field ... byte-for-byte unchanged") would be violated by that timestamp bump if the generic path were reused.

**Alternatives considered**:
- *Route through `updateSource()` with the full source object*: rejected for the `updated`-timestamp reason above, and because it requires the renderer to already hold every other field correctly to avoid clobbering them — the narrow update needs only `(shelterId, sourceId, quote)`.

## Decision 3: Reactive API-key-validity gating via a small shared Redux slice, not IPC push events or polling

**Decision**: Add `src/renderer/store/aiSettingsSlice.ts` holding `{ apiKey: string }`, with a `loadApiKey()` thunk (calls the existing `window.api.ai.getApiKey()`) and a plain `apiKeyChanged(key)` action. `AiSettingsPage`'s existing `save`/`remove` handlers additionally `dispatch(apiKeyChanged(...))` after the IPC call succeeds. A selector `selectHasValidApiKey(state)` applies the shared format check (Decision 4) to `state.aiSettings.apiKey`. The Sources tab reads this selector to gate the button.

**Rationale**: This is a single-window renderer — Settings and the Sources tab are different "pages" of the same React tree sharing one Redux store, not separate processes. The app has no existing pub/sub channel for settings changes (no `webContents.send` for key changes, unlike `COLLECTIONS_PROGRESS`/`PUBLISH_PROGRESS`), and there's no existing cross-page reactive state for the key today (`AiSettingsPage` only holds it in local `useState`). Adding one small slice — matching the existing per-domain slice pattern (`photosSlice`, `categoriesSlice`, etc.) — is the smallest change that satisfies User Story 2 Scenario 4 (button reflects a key change made while the Sources tab stays open, no restart) without inventing a new IPC event or a polling loop.

**Alternatives considered**:
- *New `AI_KEY_CHANGED` IPC broadcast event*: rejected — more moving parts (main process must track and notify every renderer subscriber) for a same-window, same-store case a Redux slice already solves.
- *Poll `window.api.ai.getApiKey()` on an interval from the Sources tab*: rejected — polling for state that's one Redux dispatch away is unnecessary complexity and adds latency to the reactive update.

## Decision 4: Extract the `sk-ant-` format check into one shared pure function

**Decision**: Add `src/shared/anthropic-key.ts` exporting `isValidAnthropicKey(key: string): boolean` (non-empty after trim, starts with `sk-ant-`). `AiSettingsPage`'s inline check and the new `selectHasValidApiKey` selector both call it.

**Rationale**: The check already exists once, inline, in `AiSettingsPage.tsx`'s `save()`. The clean-up gating needs the exact same rule (per the clarification: format check only, no live validation). Extracting it avoids a second, potentially-drifting copy of `sk-ant-` — a one-line, zero-risk dedup, not a new abstraction layer (still a single function, no interface/class).

**Alternatives considered**:
- *Duplicate the inline check in the selector*: rejected — trivial to keep in sync today, but exactly the kind of small duplication that silently diverges later (e.g., if the prefix rule ever changes).

## Decision 5: Button placement and busy/error state live in `SourceCard` + `sourcesSlice`, not a new component

**Decision**: `SourceCard` gains a 4th icon button (rendered only when `s.quote` is non-empty), driven by a new `cleanUpQuote` thunk in `sourcesSlice.ts`. Busy state is tracked as a `Set<number>`/array of in-flight source IDs in `sourcesSlice`'s state (`cleaningQuoteIds`), set on the thunk's `pending` action and cleared on `fulfilled`/`rejected`. Errors surface through the existing `uiSlice.showToast` mechanism already used elsewhere for async failures, rather than a new dialog.

**Rationale**: `SourceCard` already renders the three sibling icon buttons (view/edit/delete) and already receives `s` as a prop; a fourth button following the same convention is the smallest change. `sourcesSlice` already has the `createAsyncThunk` pattern for `create`/`update`/`delete`; a fourth thunk fits directly. Reusing the toast mechanism for the failure case avoids introducing a new modal/dialog component for what the spec (User Story 3) only requires to be "surfaced," not blocking.

**Alternatives considered**:
- *New standalone `CleanUpQuoteButton` component*: rejected — the button has no logic complex enough to warrant extraction; it's one conditional icon button among three existing ones in the same card.
- *A dedicated error dialog per failure*: rejected — heavier than what FR-007 requires, and inconsistent with how other async source-tab failures are already surfaced (toast).

## Prompt adaptation

The existing `CLEANUP_PROMPT` in `scripts/lib/wiki_convert.py` is tuned for full scanned pages (explicitly instructs reconstructing multi-column reading order). A quote is a short, already-extracted excerpt, so a new `QUOTE_CLEANUP_PROMPT` drops the reading-order/column language but keeps the fidelity contract identical: never paraphrase/summarize/add text, preserve proper nouns unless unambiguous, mark unreadable spans as `[illegible]`, return only the restored text. This satisfies the spec's Assumption that this is "the same correction goals ... applied to a single short text field," minus the illustration-captioning behavior (not applicable — quotes have no images) already called out as excluded in spec.md.
