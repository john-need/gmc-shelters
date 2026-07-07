# Implementation Plan: Clean Up Quote

**Branch**: `016-cleanup-quote` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/016-cleanup-quote/spec.md`

## Summary

Add a "Clean up quote" icon button to each source card's existing action row (view/edit/delete) on the Sources tab, shown whenever the source has a non-empty quote. Clicking it sends only that quote's text through a new thin CLI (`scripts/clean_quote.py`) built on the same `AnthropicClient`/key/model-tier machinery already used for collection-document OCR cleanup, and — on success — overwrites just the `shelter_sources.quote` column via a new narrow DB function that leaves `sources.updated` and every other field untouched. The button is disabled with the title "Clean up quote (requires AI API key)" whenever no key is configured or the configured key fails the existing `sk-ant-` format check (reused via a new shared helper), and reflects key changes made on the AI Settings page immediately via a new small Redux slice — no IPC push events, no polling, no live network validation. Failures leave the stored quote unchanged and surface a toast; there is no confirmation dialog before running (all three decided in `/speckit-clarify`). Test-first throughout, per Constitution Principle II and this session's explicit TDD request: every listed unit below gets a failing test before its implementation.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/renderer/preload) for the button, thunk, slice, and IPC handler; Python 3 (matching `scripts/lib/llm_client.py`, `scripts/lib/wiki_convert.py`) for the clean-up CLI itself.
**Primary Dependencies**: None new. Reuses `scripts/lib/llm_client.py`'s `AnthropicClient`/`load_api_key`/`load_model_tier`/`resolve_primary_model`, the existing `child_process.spawn('python3', ...)` pattern from `src/main/ipc/collections.ts`, the existing Redux Toolkit `createAsyncThunk`/`createSlice` conventions, and the existing toast mechanism (`uiSlice.showToast`).
**Storage**: SQLite, existing `shelter_sources.quote` column only (`database` file already in use — no migration). No new files, no new tables.
**Testing**: Jest (`src/main/**/*.test.ts` node env, `src/renderer/**/*.test.tsx`/`*.test.ts` jsdom) + pytest (`tests/unit/`). TDD — every unit below gets a failing test written first:
  - `tests/unit/test_wiki_convert.py` (extend) — new `QUOTE_CLEANUP_PROMPT`/`clean_quote(text, llm)`: calls the injected `llm` once with the quote wrapped in the prompt, fidelity contract present (no reading-order/column language, same never-paraphrase/`[illegible]` rules as `CLEANUP_PROMPT`), returns the llm's output verbatim, never escalates.
  - `tests/unit/test_clean_quote_cli.py` (NEW) — `scripts/clean_quote.py`: given a quote arg and a fake key file, prints the cleaned text and exits 0; missing key prints an error to stderr and exits non-zero; never writes any file.
  - `src/main/db/sources.test.ts` (extend) — new `getSourceQuote(shelterId, sourceId)`: returns the current quote for the matching row. New `updateSourceQuote(shelterId, sourceId, quote)`: updates only `shelter_sources.quote` for the matching row, does **not** touch `sources.updated` or any other column (and never imports/calls a wiki-file write function, e.g. `writeWikiHeader` — locks in FR-003/SC-002's "wiki markdown file untouched" guarantee), returns the hydrated `Source`.
  - `src/main/ipc/sources.test.ts` (extend) — new `SOURCES_CLEAN_QUOTE` handler: reads the current quote via `getSourceQuote`, spawns `clean_quote.py` with it as an argv element (mock `child_process.spawn`, mirroring `collections.test.ts`'s child-process mock); on exit 0 calls `updateSourceQuote` and resolves with its result; on nonzero exit (including a missing/invalid key, which `clean_quote.py` itself reports via its own nonzero exit), rejects with stderr and does not call `updateSourceQuote`.
  - `src/renderer/store/sourcesSlice.test.ts` (extend) — new `cleanUpQuote` thunk: adds the id to `cleaningQuoteIds` on pending, replaces the source and clears the id on fulfilled, clears the id (leaving the source's quote untouched) on rejected.
  - `src/renderer/store/aiSettingsSlice.test.ts` (NEW) — `loadApiKey` thunk stores the fetched key; `apiKeyChanged` action replaces it; `selectHasValidApiKey` selector returns true only for a non-empty, `sk-ant-`-prefixed key.
  - `src/shared/anthropic-key.test.ts` (NEW) — `isValidAnthropicKey`: empty string, whitespace-only, missing prefix, and valid `sk-ant-...` cases.
  - `src/renderer/components/Settings/AiSettingsPage.test.tsx` (extend) — `save`/`remove` also dispatch `apiKeyChanged` so a mounted Sources tab would observe the update (asserted via the shared store, not by re-testing `SourceCard` here).
  - `src/renderer/components/MainPane/tabs/SourceCard.test.tsx` (extend) — button hidden when `s.quote` is empty; disabled with title "Clean up quote (requires AI API key)" when `hasValidApiKey` prop is false; enabled with title "Clean up quote" when true; shows a busy state and stays disabled when `cleaning` prop is true; calls `onCleanUpQuote` on click.
  - `src/renderer/components/MainPane/tabs/SourcesTab.test.tsx` (extend) — passes `hasValidApiKey` (from the new selector) and `cleaning`/`onCleanUpQuote` (from `cleaningQuoteIds` + the new thunk) down to each `SourceCard`.
**Target Platform**: Electron desktop app (macOS primary), local filesystem + the existing outbound HTTPS call to the Anthropic API (unchanged endpoint/auth, just a second call site).
**Project Type**: Hybrid Electron app + Python conversion-pipeline scripts, same split as `specs/013-research-and-citation`/`specs/014-wiki-header-schema-form`/`specs/015-ai-settings-page`: the app owns the UI, IPC, and DB write; a small Python CLI owns the one Anthropic call, reusing `scripts/lib/llm_client.py` exactly as the OCR pipeline does.
**Performance Goals**: One subprocess spawn + one Anthropic call per click, scoped to a single short string (a quote, not a full document) — well under the runtime of an existing collection-document clean-up pass; no batch path.
**Constraints**: Must not modify any source field other than `quote` (FR-003) — specifically must not bump `sources.updated` (research.md Decision 2). Must not write or touch the source's wiki markdown file. No new npm/pip dependency. No live Anthropic call just to validate the key (clarified: format check only).
**Scale/Scope**: Touches: `scripts/lib/wiki_convert.py` (`QUOTE_CLEANUP_PROMPT`, `clean_quote`), `scripts/clean_quote.py` (new), `src/main/db/sources.ts` (`getSourceQuote`, `updateSourceQuote`), `src/main/ipc/sources.ts` (new handler + a second small local spawn helper, deliberately not extracted into a shared module — see research.md Decision 1), `src/shared/ipc-types.ts` (new `CHANNELS.SOURCES_CLEAN_QUOTE`, `ElectronAPI.sources.cleanUpQuote`), `src/main/preload.ts` (wire the new channel), `src/shared/anthropic-key.ts` (new), `src/renderer/store/aiSettingsSlice.ts` (new) + `src/renderer/store/index.ts` (register it), `src/renderer/components/Settings/AiSettingsPage.tsx` (dispatch `apiKeyChanged`), `src/renderer/store/sourcesSlice.ts` (`cleanUpQuote` thunk, `cleaningQuoteIds`), `src/renderer/components/MainPane/tabs/SourceCard.tsx` (4th icon button), `src/renderer/components/MainPane/tabs/SourcesTab.tsx` (wire selector + thunk + prop passing).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Source of truth identified** (Principle I): The `shelter_sources.quote` SQLite column is the sole canonical input/output, named explicitly in spec.md and data-model.md. The Anthropic API remains an existing, already-approved external consumer of quote text (same role it already has for OCR text) — no new external system.
- [x] **Test-first scope identified** (Principle II): Failing tests planned first for every unit listed under Testing above, spanning `tests/unit/` (pytest), `src/main/db/`, `src/main/ipc/` (Jest node env), and `src/renderer/store/`, `src/renderer/components/Settings/`, `src/renderer/components/MainPane/tabs/` (Jest jsdom) — matching this repo's existing per-module pairing convention.
- [x] **External contract coverage** (Principle III): N/A for out-of-repo consumers (the Anthropic API's request/response shape is unchanged — same client, same headers, just a second short prompt). This feature adds one new *internal* IPC contract, documented in `contracts/sources-clean-quote-ipc.md`, following the same internal-contract convention as `specs/015-ai-settings-page/contracts/ai-model-ipc.md`.
- [x] **Idempotency and auditability** (Principle IV): N/A in the batch-import/sync sense — this is a single-source, single-operator action, not a rerunning batch workflow. Re-running clean-up on the same quote is a safe no-op overwrite (a no-op *result* is explicitly an acceptable outcome per spec.md Edge Cases), not a duplicate side effect.
- [x] **Minimal-change fit** (Principle V): All changes stay within `scripts/lib/`, `scripts/`, `src/shared/`, `src/main/db/`, `src/main/ipc/`, `src/main/preload.ts`, `src/renderer/store/`, `src/renderer/components/Settings/`, `src/renderer/components/MainPane/tabs/`, and `tests/unit/` — the same trees prior features already touch. No new top-level directory, no new dependency, no new storage mechanism (reuses the exact `AnthropicClient`/key-file pattern `scripts/lib/llm_client.py` already established, and the exact spawn pattern `collections.ts` already established).
- [x] **WordPress/theme boundary respected** (Principle V/III): N/A — no theme or WordPress surface touched; explicitly, no wiki markdown file is written by this feature (FR-003).

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/016-cleanup-quote/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── sources-clean-quote-ipc.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
scripts/lib/
└── wiki_convert.py                     # NEW: QUOTE_CLEANUP_PROMPT constant; clean_quote(text, llm)
                                         #   — pure function, same Callable[[str], str] shape as
                                         #   clean_pages(), no reading-order/column language

scripts/
└── clean_quote.py                      # NEW: thin CLI — argv[1] is the quote text; loads key/model
                                         #   tier exactly like ocr_to_markdown.py's main(); builds
                                         #   AnthropicClient; calls wc.clean_quote(text, client.complete);
                                         #   prints result to stdout, exit 0; prints error to stderr,
                                         #   exit 1 on missing key or any transport failure

tests/unit/
├── test_wiki_convert.py                # TDD: extend — clean_quote() tests
└── test_clean_quote_cli.py             # TDD: NEW — CLI-level tests for clean_quote.py

src/shared/
├── ipc-types.ts                        # new CHANNELS.SOURCES_CLEAN_QUOTE; ElectronAPI.sources
│                                        #   gains cleanUpQuote({id, shelterId}): Promise<Source>
├── anthropic-key.ts                    # NEW: isValidAnthropicKey(key: string): boolean
└── anthropic-key.test.ts               # TDD: NEW — failing tests first

src/main/db/
├── sources.ts                          # NEW: getSourceQuote(shelterId, sourceId): string;
│                                        #   updateSourceQuote(shelterId, sourceId, quote): Source
└── sources.test.ts                     # TDD: extend — failing tests first for both new functions

src/main/ipc/
├── sources.ts                          # NEW: SOURCES_CLEAN_QUOTE handler — reads the quote via
│                                        #   getSourceQuote, spawns clean_quote.py via a small local
│                                        #   spawn helper (not extracted/shared with collections.ts's
│                                        #   own python()), calls updateSourceQuote on success,
│                                        #   rejects otherwise
└── sources.test.ts                     # TDD: extend — mocked child_process.spawn, mirroring
                                         #   collections.test.ts's existing mock pattern

src/main/preload.ts                     # sources.cleanUpQuote wired to the new channel

src/renderer/store/
├── aiSettingsSlice.ts                  # NEW: { apiKey: string }; loadApiKey() thunk; apiKeyChanged
│                                        #   action; selectHasValidApiKey selector (uses
│                                        #   isValidAnthropicKey)
├── aiSettingsSlice.test.ts             # TDD: NEW — failing tests first
├── sourcesSlice.ts                     # cleanUpQuote thunk; cleaningQuoteIds: number[] in state
├── sourcesSlice.test.ts                # TDD: extend — failing tests first for cleanUpQuote
└── index.ts                            # registers aiSettings: aiSettingsReducer

src/renderer/components/Settings/
├── AiSettingsPage.tsx                  # save/remove also dispatch(apiKeyChanged(...)); inline
│                                        #   sk-ant- check replaced by isValidAnthropicKey import
└── AiSettingsPage.test.tsx             # TDD: extend — failing tests first for the new dispatch

src/renderer/components/MainPane/tabs/
├── SourceCard.tsx                      # 4th icon button (only when s.quote is set); new props
│                                        #   hasValidApiKey, cleaning, onCleanUpQuote
├── SourceCard.test.tsx                 # TDD: extend — failing tests first for the new button
├── SourcesTab.tsx                      # wires selectHasValidApiKey + cleaningQuoteIds +
│                                        #   dispatch(cleanUpQuote(...)) through to each SourceCard
└── SourcesTab.test.tsx                 # TDD: extend — failing tests first for the new wiring
```

**Structure Decision**: Same hybrid Electron-app-plus-Python-scripts split already established by `specs/013-research-and-citation`/`specs/014-wiki-header-schema-form`/`specs/015-ai-settings-page`: the app owns the UI, IPC, Redux state, and the one narrow DB write; a small Python CLI reuses the existing `AnthropicClient`/key/model-tier machinery for the one call site that needs Claude. No `database/migrations/` (no schema change) and no new top-level directory.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
