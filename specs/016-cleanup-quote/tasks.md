# Tasks: Clean Up Quote

**Input**: Design documents from `/specs/016-cleanup-quote/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sources-clean-quote-ipc.md, quickstart.md
**Tests**: TDD explicitly requested (user input to `/speckit-plan`) — every behavior-bearing task below writes a failing test before the implementation task that makes it pass.
**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md priorities P1/P2/P3) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Hybrid layout (see plan.md's Structure Decision):

- TypeScript/Electron side, tests colocated `*.test.ts`/`*.test.tsx` next to the module (this repo's existing convention): `src/shared/`, `src/main/db/`, `src/main/ipc/`, `src/main/preload.ts`, `src/renderer/store/`, `src/renderer/components/Settings/`, `src/renderer/components/MainPane/tabs/`
- Python side, tests under `tests/unit/` (this repo's existing convention): `scripts/`, `scripts/lib/`

## Phase 1: Setup

**Purpose**: N/A for this feature. No new dependency, config file, or `.gitignore` entry is needed — the clean-up call writes no files (unlike `.anthropic_api_key`/`.ai_model`), and every implementation task below extends an existing module.

**Checkpoint**: Proceed directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature. There is no shared groundwork all three stories need before any can start — User Story 1 (the core clean-up action) touches no files User Story 2 (key-validity gating) or User Story 3 (failure recovery) depend on except User Story 1's own deliverables, which each later story explicitly builds on (see Dependencies below).

**Checkpoint**: Proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Clean up a messy quote (Priority: P1) 🎯 MVP

**Goal**: A "Clean up quote" icon button appears in each source card's action row whenever the source has a quote. Clicking it runs the quote through the same Anthropic clean-up machinery already used for collection documents and replaces just that field, end-to-end, once a request completes successfully.

**Independent Test**: Per quickstart.md — on a source with a messy quote, click "Clean up quote," confirm the button shows a busy state and then the quote updates in place, with every other source field and the wiki markdown file untouched. (Key-validity gating from User Story 2 is not required for this story to be independently demoable — assume a working key is configured.)

### Tests for User Story 1 ⚠️

- [X] T001 [P] [US1] Write failing tests in `tests/unit/test_wiki_convert.py` (extend): new `QUOTE_CLEANUP_PROMPT` and `clean_quote(text, llm)` — calls the injected `llm` once with the quote wrapped in the prompt; the prompt carries the same fidelity contract as `CLEANUP_PROMPT` (never paraphrase/summarize/add text, preserve proper nouns unless unambiguous, mark unreadable spans `[illegible]`) but omits the multi-column/reading-order language, since a quote is a short excerpt, not a scanned page; returns the llm's output verbatim
- [X] T002 [P] [US1] Write failing tests in NEW `tests/unit/test_clean_quote_cli.py`: `scripts/clean_quote.py`, given a quote as `argv[1]` and a fake key file (injected/fake transport, no real network call), prints the cleaned text to stdout and exits 0; with no key file present, prints an error to stderr and exits non-zero; in both cases, writes no file
- [X] T003 [P] [US1] Write failing tests in `src/main/db/sources.test.ts` (extend): new `getSourceQuote(shelterId, sourceId)` returns the current quote for the matching row; new `updateSourceQuote(shelterId, sourceId, quote)` runs an `UPDATE shelter_sources SET quote = ...` for the matching row, leaves `sources.updated` and every other column on both tables untouched, never imports or calls a wiki-file write function (e.g. `writeWikiHeader` from `src/main/ipc/wiki-search.ts`) — locking in FR-003/SC-002's "wiki markdown file untouched" guarantee — and returns the hydrated `Source`
- [X] T004 [US1] Write failing tests in `src/main/ipc/sources.test.ts` (extend): new `SOURCES_CLEAN_QUOTE` handler calls `getSourceQuote` for the current text, spawns `clean_quote.py` (mock `child_process.spawn`, mirroring `collections.test.ts`'s existing mock) with that quote as an argv element; on exit 0, calls `updateSourceQuote` with the trimmed stdout and resolves with its return value
- [X] T005 [P] [US1] Write failing tests in `src/renderer/store/sourcesSlice.test.ts` (extend): new `cleanUpQuote` thunk — `pending` adds the source id to a new `cleaningQuoteIds` array in state; `fulfilled` replaces the source in `byShelter` with the resolved value and removes the id from `cleaningQuoteIds`; `rejected` removes the id from `cleaningQuoteIds` without altering the source already in state
- [X] T006 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/SourceCard.test.tsx` (extend): the "Clean up quote" button is absent when `s.quote` is empty; present, enabled, and titled "Clean up quote" when a new `hasValidApiKey` prop is `true` and `cleaning` is `false`; disabled and titled "Clean up quote (requires AI API key)" when `hasValidApiKey` is `false`; disabled with a busy indicator when `cleaning` is `true`; calls a new `onCleanUpQuote` prop when clicked
- [X] T007 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/SourcesTab.test.tsx` (extend): each rendered `SourceCard` receives `cleaning` computed from whether its id is in `state.sources.cleaningQuoteIds`, and clicking its clean-up button dispatches `cleanUpQuote({ id, shelterId })`; `hasValidApiKey` is passed through as a hardcoded `true` for now (User Story 2 replaces this with the real selector)

### Implementation for User Story 1

- [X] T008 [US1] Edit `src/shared/ipc-types.ts`: add `CHANNELS.SOURCES_CLEAN_QUOTE = 'sources:cleanQuote'`; extend `ElectronAPI['sources']` with `cleanUpQuote(args: { id: number; shelterId: number }): Promise<Source>` — unblocks T004, T005, T012–T014 (all reference the new channel/type)
- [X] T009 [P] [US1] Edit `scripts/lib/wiki_convert.py`: add `QUOTE_CLEANUP_PROMPT` and `clean_quote(text: str, llm: Callable[[str], str]) -> str` per T001 — makes T001 pass
- [X] T010 [US1] Create NEW `scripts/clean_quote.py`: read the quote from `sys.argv[1]`; load the API key and model tier exactly as `ocr_to_markdown.py`'s `main()` does (`load_api_key`, `load_model_tier`, `resolve_primary_model`); build an `AnthropicClient`; call `wc.clean_quote(text, client.complete)`; print the result to stdout and exit 0; on a missing key or any transport/API error, print a message to stderr and exit 1 — makes T002 pass (depends on T009)
- [X] T011 [P] [US1] Edit `src/main/db/sources.ts`: add `getSourceQuote(shelterId: number, sourceId: number): string` (a direct `SELECT quote FROM shelter_sources WHERE shelter_id = ? AND source_id = ?`) and `updateSourceQuote(shelterId: number, sourceId: number, quote: string): Source` (mirrors the `SELECT_SOURCE`/`hydrateSource` re-select already used by `createSource`/`updateSource`, but its `UPDATE` touches only `shelter_sources.quote`) — makes T003 pass
- [X] T012 [US1] Edit `src/main/ipc/sources.ts`: add a small local `spawnPython` helper (mirrors `collections.ts`'s `python()` helper; kept as a second small local copy rather than extracted into a shared module — two ~15-line copies is simpler than a new shared file for one helper used by two IPC modules) and the `SOURCES_CLEAN_QUOTE` handler: call `getSourceQuote` for the current text, spawn `clean_quote.py` with it as an argv element; on exit 0, call `updateSourceQuote` and resolve with its result; on a non-zero exit — including a missing/invalid key, which `clean_quote.py` itself reports via its own non-zero exit — reject with the captured stderr (no separate "no quote configured" guard: FR-001 means the UI never invokes this channel for a source without a quote) — makes T004 pass (depends on T008, T011)
- [X] T013 [US1] Edit `src/main/preload.ts`: wire `sources.cleanUpQuote` to `CHANNELS.SOURCES_CLEAN_QUOTE` — depends on T008
- [X] T014 [US1] Edit `src/renderer/store/sourcesSlice.ts`: add `cleaningQuoteIds: number[]` to state and a `cleanUpQuote` thunk (`window.api.sources.cleanUpQuote`) with the pending/fulfilled/rejected behavior described in T005 — makes T005 pass (depends on T008)
- [X] T015 [US1] Edit `src/renderer/components/MainPane/tabs/SourceCard.tsx`: add a 4th icon button in the existing action row (alongside view/edit/delete), rendered only when `s.quote` is set, with new `hasValidApiKey: boolean`, `cleaning: boolean`, and `onCleanUpQuote: () => void` props driving its disabled state, busy indicator, and title exactly as in T006 — makes T006 pass
- [X] T016 [US1] Edit `src/renderer/components/MainPane/tabs/SourcesTab.tsx`: pass `cleaning={cleaningQuoteIds.includes(src.id)}`, `hasValidApiKey={true}` (temporary hardcode — User Story 2 task T025 replaces this), and `onCleanUpQuote={() => dispatch(cleanUpQuote({ id: src.id, shelterId: s.id }))}` into each `SourceCard` — makes T007 pass (depends on T014, T015)

**Checkpoint**: User Story 1 is fully functional and independently testable — clicking "Clean up quote" on any source with a quote runs the clean-up end-to-end and updates just that field. The button is not yet gated on API key validity (always enabled when a quote exists) — that gating is User Story 2.

---

## Phase 4: User Story 2 - Button reflects API key availability (Priority: P2)

**Goal**: The button is disabled with the title "Clean up quote (requires AI API key)" whenever no Anthropic key is configured or the configured key doesn't match the existing `sk-ant-` format check, and reflects a key change made on the AI Settings page immediately, without restarting the app.

**Independent Test**: Per quickstart.md — remove the API key in AI Settings, return to Sources, confirm the button is disabled with the "requires AI API key" title; add a valid key without navigating away from Sources in between and confirm it becomes enabled.

### Tests for User Story 2 ⚠️

- [X] T017 [P] [US2] Write failing tests in NEW `src/shared/anthropic-key.test.ts`: `isValidAnthropicKey` returns `false` for an empty string, a whitespace-only string, and a string missing the `sk-ant-` prefix; returns `true` for a valid `sk-ant-...` value
- [X] T018 [P] [US2] Write failing tests in NEW `src/renderer/store/aiSettingsSlice.test.ts`: `loadApiKey()` thunk stores the key resolved by `window.api.ai.getApiKey()` on fulfilled; `apiKeyChanged(key)` action replaces the stored key; `selectHasValidApiKey(state)` returns `isValidAnthropicKey(state.aiSettings.apiKey)`
- [X] T019 [P] [US2] Edit `src/renderer/components/Settings/AiSettingsPage.test.tsx`: `save()` and `remove()` also dispatch `apiKeyChanged` with the new value after their `window.api.ai.setApiKey()` call resolves
- [X] T020 [US2] Edit `src/renderer/components/MainPane/tabs/SourcesTab.test.tsx`: the `hasValidApiKey` prop passed to `SourceCard` now comes from `selectHasValidApiKey(state)` instead of the T016 hardcoded `true`; dispatching `apiKeyChanged` into the store flips the rendered prop without remounting the component

### Implementation for User Story 2

- [X] T021 [P] [US2] Create NEW `src/shared/anthropic-key.ts`: `isValidAnthropicKey(key: string): boolean` — non-empty after trim, starts with `sk-ant-` — makes T017 pass
- [X] T022 [US2] Create NEW `src/renderer/store/aiSettingsSlice.ts`: `{ apiKey: string }` state, `loadApiKey` thunk, `apiKeyChanged` action, `selectHasValidApiKey` selector (uses `isValidAnthropicKey`) — makes T018 pass (depends on T021)
- [X] T023 [US2] Edit `src/renderer/store/index.ts`: register `aiSettings: aiSettingsReducer` — depends on T022
- [X] T024 [US2] Edit `src/renderer/components/Settings/AiSettingsPage.tsx`: dispatch `apiKeyChanged(...)` from `save()` and `remove()` after the IPC call resolves; replace the inline `sk-ant-` check in `save()` with `isValidAnthropicKey` — makes T019 pass (depends on T021, T022)
- [X] T025 [US2] Edit `src/renderer/components/MainPane/tabs/SourcesTab.tsx`: replace the hardcoded `hasValidApiKey={true}` from T016 with `useSelector(selectHasValidApiKey)`; dispatch `loadApiKey()` once on mount — makes T020 pass (depends on T022, T023)

**Checkpoint**: User Stories 1 and 2 both work independently — the button now truly reflects whether a usable key is configured, and updates live across pages without a restart.

---

## Phase 5: User Story 3 - Clean-up failure is recoverable (Priority: P3)

**Goal**: If a clean-up request fails, the stored quote is left exactly as it was and the user sees an error, instead of a silently stuck or lost edit.

**Independent Test**: Per quickstart.md — force a clean-up call to fail (e.g., a temporarily invalid key or a simulated subprocess failure) and confirm the original quote is still shown and an error toast appears; confirm the button returns to normal afterward.

### Tests for User Story 3 ⚠️

- [X] T026 [P] [US3] Edit `src/main/ipc/sources.test.ts`: on a non-zero `clean_quote.py` exit code, the `SOURCES_CLEAN_QUOTE` handler rejects with the captured stderr and `updateSourceQuote` is never called
- [X] T027 [P] [US3] Edit `src/renderer/store/sourcesSlice.test.ts`: on `cleanUpQuote.rejected`, the source already present in `byShelter` — including its `quote` — is unchanged; only `cleaningQuoteIds` is cleared
- [X] T028 [US3] Edit `src/renderer/components/MainPane/tabs/SourcesTab.test.tsx`: when the `cleanUpQuote` dispatch rejects, an error toast (`showToast`) is dispatched and the affected `SourceCard`'s button returns to its normal (non-busy) state

### Implementation for User Story 3

- [X] T029 [US3] Verify/adjust the `SOURCES_CLEAN_QUOTE` handler in `src/main/ipc/sources.ts` (built in T012) rejects with the captured stderr on a non-zero exit code without calling `updateSourceQuote` — makes T026 pass
- [X] T030 [US3] Verify/adjust the `cleanUpQuote.rejected` case in `src/renderer/store/sourcesSlice.ts` (built in T014) leaves the source's data untouched, clearing only `cleaningQuoteIds` — makes T027 pass
- [X] T031 [US3] Edit `src/renderer/components/MainPane/tabs/SourcesTab.tsx`: wrap the `cleanUpQuote` dispatch from T016 in `.unwrap().catch(...)`, dispatching `showToast({ id: 'clean-quote-' + src.id + '-error', message: 'Could not clean up this quote. The original text was kept.' })` on failure — makes T028 pass (depends on T016)

**Checkpoint**: All three user stories are independently functional — failures are safe and visible, not silent or stuck.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T032 [P] Walk through `quickstart.md`'s scenarios manually in the running app (a real messy quote, a missing/invalid key, a forced failure) and confirm each matches its expected outcome
- [X] T033 Run the full suite (`npm test` and `pytest`) to confirm no regressions across `src/main`, `src/renderer`, and `tests/unit`
- [X] T034 [P] Run `npx tsc --noEmit` and `npx eslint 'src/**/*.{ts,tsx}'` to confirm the new/changed TypeScript is clean

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: N/A — nothing to scaffold.
- **Foundational (Phase 2)**: N/A — skipped, nothing shared blocks all three stories (see note above).
- **User Story 1 (Phase 3)**: No dependencies. Independently completable and testable on its own (MVP).
- **User Story 2 (Phase 4)**: Depends on User Story 1 — T025 replaces the hardcoded `hasValidApiKey={true}` that T016 (US1) put in `SourcesTab.tsx`. Implement after US1's checkpoint.
- **User Story 3 (Phase 5)**: Depends on User Story 1 — T031 wraps the same `cleanUpQuote` dispatch T016 (US1) wired up. Independent of User Story 2 (does not touch key-validity gating).
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests (T001–T007 for US1; T017–T020 for US2; T026–T028 for US3) MUST be written and observed failing before their corresponding implementation tasks.
- Within US1, T008 (`src/shared/ipc-types.ts`) must land before T004, T005, T012, T013, T014 — all of them reference the new channel/type it defines.
- Within US1, the Python side (T009–T010) has no dependency on the TypeScript side (T008, T011–T016) or vice versa — different language, different files, same feature.
- Within US2, T021 (`anthropic-key.ts`) must land before T022 (`aiSettingsSlice.ts`) and T024 (`AiSettingsPage.tsx`), both of which import it.
- Within US3, T029/T030 mostly verify behavior already implemented in US1 (T012/T014); the only genuinely new implementation is T031's toast wiring in `SourcesTab.tsx`.

### Parallel Opportunities

- T001, T002, T003, T005, T006, T007 (US1 tests) touch six different files and can be written in parallel; T004 touches a file T003 doesn't, so it can join them too, but depends on T008 landing first for the type to exist.
- T009 (Python) can run in parallel with T011 (DB) and with T006/T007 (component tests) — no shared files.
- T017, T018, T019 (US2 tests) touch three different files and can be written in parallel; T020 depends on the selector T018 defines existing (even as a stub) to reference in its assertions.
- T026, T027 (US3 tests) touch two different files and can run in parallel; T028 depends on both existing to know what "recovered" looks like end-to-end.
- T032, T034 (Polish) can run in parallel with each other.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete User Story 1 (T001–T016): the clean-up action works end-to-end, with the button always enabled whenever a quote exists.
2. Validate via quickstart.md's first section before expanding scope.

### Incremental Delivery

1. User Story 1 (MVP: end-to-end clean-up, no key gating) → User Story 2 (real key-validity gating, replacing the US1 hardcode) → User Story 3 (failure recovery + toast) → Polish.
2. Each story's checkpoint is independently demoable per quickstart.md.
