# Contract: `SOURCES_CLEAN_QUOTE` (internal IPC)

Internal contract between `src/renderer/components/MainPane/tabs/SourceCard.tsx` (via a new `cleanUpQuote` thunk in `src/renderer/store/sourcesSlice.ts`) and `src/main/ipc/sources.ts`. No out-of-repo consumer. New channel — no "before" shape exists.

## Shape

```ts
// src/shared/ipc-types.ts
CHANNELS.SOURCES_CLEAN_QUOTE = 'sources:cleanQuote'

sources.cleanUpQuote(args: { id: number; shelterId: number }): Promise<Source>
// Rejects (thrown Error) on failure — API key missing/invalid at call time,
// subprocess nonzero exit, or any transport error. On rejection the quote is
// guaranteed unchanged in the database (FR-007).
```

## Behavior

- `src/main/ipc/sources.ts` handler: looks up the source's current `quote` via a new `getSourceQuote(shelterId, sourceId): string` in `src/main/db/sources.ts` — a direct single-row `SELECT quote FROM shelter_sources WHERE shelter_id = ? AND source_id = ?`, mirroring the narrow-query/narrow-update pattern `updateSourceQuote` already establishes (research.md Decision 2) rather than reusing the heavier all-sources `getSourcesByShelter` and searching it client-side. Then spawns `python3 scripts/clean_quote.py "<quote text>"` (argv, not stdin/shell — spawned without `shell: true`, so no escaping needed regardless of quote content) the same way `src/main/ipc/collections.ts`'s internal `python()` helper spawns `ocr_to_markdown.py`.
- On exit code `0`: the handler calls `updateSourceQuote(shelterId, id, stdout.trim())` (`src/main/db/sources.ts`, research.md Decision 2 — does **not** touch `sources.updated`) and resolves with the updated, hydrated `Source`.
- On a non-zero exit code — including a missing or invalid API key, which `clean_quote.py` itself detects and reports via its own non-zero exit (see `scripts/clean_quote.py`) — the handler rejects with the captured stderr; no DB write occurs. There is no separate "no quote configured" guard: FR-001 means the UI never invokes this channel for a source without a quote, so that case isn't a reachable branch worth a dedicated check.
- `scripts/clean_quote.py <quote text>`: loads the API key (`load_api_key`) and model tier (`load_model_tier`/`resolve_primary_model`) exactly as `ocr_to_markdown.py` does, builds an `AnthropicClient`, calls the new `wiki_convert.clean_quote(text, client.complete)`, prints the corrected text to stdout and exits `0`. On a missing key or any transport/API error, prints a message to stderr and exits non-zero. Never writes to any file — this script's only output is stdout/stderr.

## Concurrency

Unlike `collections.ts`'s single global `activeChild` lock (one collection run at a time, app-wide), clean-up requests are scoped per source. The renderer is responsible for not dispatching a second `cleanUpQuote` for the same `id` while one is in flight (`cleaningQuoteIds`, data-model.md) — the main-process handler does not itself deduplicate concurrent calls for the same source, since normal UI use (button disabled while busy) already prevents it, and two different sources may clean up concurrently.

## Backward compatibility

None required — brand-new channel with a single caller, introduced in this change set.
