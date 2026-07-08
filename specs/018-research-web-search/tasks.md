# Tasks: Research Tab Web Search Citations

**Input**: Design documents from `/specs/018-research-web-search/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/research-web-search-ipc.md, quickstart.md
**Tests**: Required — this feature was planned with a TDD approach (user-requested); every implementation task has a corresponding failing-test task that must exist and fail first.
**Organization**: Tasks are grouped by user story (US1/US2/US3 from spec.md) to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every description includes the exact file path(s) touched

## Path Conventions

This feature is a pure Electron/TypeScript change — no `scripts/`/Python, no `database/` migrations.

- Shared types/contracts: `src/shared/`
- New Anthropic-call/image-cache modules: `src/main/ai/`
- IPC wiring: `src/main/ipc/`, `src/main/index.ts`, `src/main/preload.ts`
- UI: `src/renderer/components/MainPane/tabs/ResearchTab.tsx`
- Feature docs/contracts: `specs/018-research-web-search/`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: The one shared contract shape every story's tests and code depend on.

- [X] T001 Add `CHANNELS.RESEARCH_WEB_SEARCH`, the `WebResearchResult`/`WebResearchError`/`WebSearchResponse` types, and `ElectronAPI.research.webSearch(query: string): Promise<WebSearchResponse>` to `src/shared/ipc-types.ts` (per `contracts/research-web-search-ipc.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure with no independent user-facing value on its own, but required by every user story's backend work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write failing tests in `src/main/ai/models.test.ts` for `resolvePrimaryModel('default')`/`resolvePrimaryModel('escalation')` mapping to the correct fixed Claude model IDs (mirroring `scripts/lib/llm_client.py`'s `DEFAULT_MODEL`/`ESCALATION_MODEL`)
- [X] T003 Implement `src/main/ai/models.ts` (`DEFAULT_MODEL`, `ESCALATION_MODEL`, `resolvePrimaryModel(tier)`) to make T002 pass
- [X] T004 [P] Extend `src/main/ipc/ai-settings.test.ts` with failing tests asserting new exported `readStoredApiKey()`/`readStoredModelTier()` behave identically to the existing `AI_GET_API_KEY`/`AI_GET_MODEL` handlers (empty-string/`'default'` fallback included)
- [X] T005 Refactor `src/main/ipc/ai-settings.ts` to export `readStoredApiKey()`/`readStoredModelTier()`, with the existing IPC handlers delegating to them (existing tests in `ai-settings.test.ts` must keep passing unchanged); makes T004 pass

**Checkpoint**: Foundation ready — model resolution and key/tier reads are available for the IPC handler built in User Story 1.

---

## Phase 3: User Story 1 - Turn on web research alongside archive search (Priority: P1) 🎯 MVP

**Goal**: Checking "Search web" and clicking "Search Web" fires one live Claude call (via the app's existing AI Settings key/model) and renders results — title, link, snippet — in a separate "Web Sources" section, with correct no-key/empty/error/timeout/disabled-button behavior. No photos, no Add Citation yet (US3, US2).

**Independent Test**: Check "Search web", type a query, click Search Web, confirm a labeled "Web Sources" section appears with results while archive results are unaffected; confirm unchecking clears it; confirm a second click while in flight is inert; confirm the no-key and error/empty states render correctly.

### Tests for User Story 1 ⚠️

- [X] T006 [P] [US1] Write failing tests in `src/main/ai/web-research.test.ts`: request body includes the resolved model, the `web_search` tool (`type: 'web_search_20260209'`, `max_uses: 3`), and a prompt containing the spec's fixed template plus the trailing-JSON-array instruction; a well-formed trailing JSON array in the mocked response's final text block is parsed into results; entries missing `title` or `url` are dropped; an unparseable response yields `{ ok: true, results: [] }` (not an error); a non-2xx response yields `{ ok: false, error: 'network' }`; an aborted/timed-out request (inject a short timeout so the test doesn't wait ~45s) yields `{ ok: false, error: 'timeout' }`
- [X] T007 [P] [US1] Write failing tests in `src/main/ipc/research-web-search.test.ts`: no stored API key → `{ ok: false, error: 'no_api_key' }` with zero network calls; stored key present → resolves the model tier, calls `web-research.ts`, and returns its results with `localImagePath: null` on every entry (thumbnail fetching is wired in US3); a `web-research.ts` error response passes through unchanged
- [X] T008 [P] [US1] Extend `src/main/preload.test.ts` with failing tests: `research` appears in the exposed top-level namespace list; `research.webSearch` is exposed as a function that invokes `CHANNELS.RESEARCH_WEB_SEARCH` with the query
- [X] T009 [P] [US1] Extend `src/renderer/components/MainPane/tabs/ResearchTab.test.tsx` with failing tests: the "Search web" checkbox renders unchecked by default; checking it or editing the query text alone never calls `window.api.research.webSearch`; clicking "Search Web" with the box checked calls it with the current query; while the call is in flight, the Web Sources section shows a loading indicator (FR-014); the button is disabled for the duration of an in-flight call and re-enables after it resolves; a second click while disabled is a no-op; a successful response renders a "Web Sources" section separate from the archive results list; a `no_api_key` response renders a message pointing to AI Settings; an empty `results: []` response renders a distinct "no web results" state (not the archive tab's "no results" copy); a `timeout`/`network` error renders an inline error state and re-enables the button; unchecking "Search web" clears the section immediately without affecting archive results; a response with an arbitrarily large result list (e.g. 20 mocked entries) renders all of them, not a truncated subset (FR-013)
- [X] T009a [US1] Extend `src/renderer/components/MainPane/tabs/ResearchTab.test.tsx` with a failing test for FR-012: if a slow, superseded `webSearch` promise resolves after a newer one already has (simulate by resolving an earlier mocked call after a later one), the stale result is discarded — only the latest query's results are ever rendered

### Implementation for User Story 1

- [X] T010 [US1] Implement `src/main/ai/web-research.ts` (builds the request, POSTs via `fetch` with an `AbortController` ~45s timeout, extracts and parses the trailing JSON array, maps network/timeout/parse-failure per research.md) to make T006 pass
- [X] T011 [US1] Implement `src/main/ipc/research-web-search.ts` (`registerResearchWebSearchHandlers()`: short-circuits on empty `readStoredApiKey()`; otherwise resolves the model via `readStoredModelTier()` + `resolvePrimaryModel()`, calls `web-research.ts`, and maps each result to `{ title, url, snippet, localImagePath: null }`) to make T007 pass
- [X] T012 [US1] Register `registerResearchWebSearchHandlers()` alongside the other `register*Handlers()` calls in `src/main/index.ts`
- [X] T013 [US1] Wire `research: { webSearch }` into `src/main/preload.ts` to make T008 pass
- [X] T014 [US1] Add the "Search web" checkbox, "Search Web" button, and "Web Sources" section (loading indicator scoped to the section, disabled-while-in-flight button, no-key/error/empty/results states, immediate clear on uncheck, uncapped result rendering, and a request-sequence guard — e.g. a ref-based request counter — that discards a stale response per FR-012) to `src/renderer/components/MainPane/tabs/ResearchTab.tsx` to make T009/T009a pass

**Checkpoint**: User Story 1 is fully functional and independently testable — live web search with correct trigger/loading/error/empty behavior, text-only results.

---

## Phase 4: User Story 2 - Cite a web-found source (Priority: P1)

**Goal**: Each web result gets an Add Citation action that creates a `sources`/`shelter_sources` row for the current shelter using the exact same `SourceModal`/`createSource` flow archive results already use.

**Independent Test**: From a web result, click Add Citation; confirm a new entry appears on the Sources tab for the current shelter with title/url/access-date/quote filled in, indistinguishable from a citation added via an archive result.

### Tests for User Story 2 ⚠️

- [X] T015 [P] [US2] Write failing tests in `src/shared/web-research-cite.test.ts` for `webResultToSource()`: maps `title`→`container_title`, `url`→`url`, today's ISO date→`access_date`, `snippet`→`quote`, fixed `type: 'website'`, all other `Source` fields left at `BLANK_SOURCE` defaults
- [X] T016 [US2] Extend `src/renderer/components/MainPane/tabs/ResearchTab.test.tsx` with a failing test: clicking Add Citation on a web result opens the existing `SourceModal` pre-filled via `webResultToSource()` and saves through the existing `createSource` flow

### Implementation for User Story 2

- [X] T017 [US2] Implement `src/shared/web-research-cite.ts` (`webResultToSource()`) to make T015 pass
- [X] T018 [US2] Add the Add Citation action to each web result card in `src/renderer/components/MainPane/tabs/ResearchTab.tsx`, reusing the existing `openCitation`/`SourceModal`/`createSource` wiring already used for archive results, to make T016 pass

**Checkpoint**: User Stories 1 and 2 both work independently — staff can search the web and capture citations from it.

---

## Phase 5: User Story 3 - See a photo thumbnail when one is found (Priority: P2)

**Goal**: A web result whose research turned up a photo shows a small locally-cached thumbnail; results without one render cleanly with no placeholder.

**Independent Test**: Run a web search known to surface a photo-bearing source; confirm a small thumbnail renders next to that result (and not next to text-only results), served from a local cache path, never the original external URL.

### Tests for User Story 3 ⚠️

- [X] T019 [P] [US3] Write failing tests in `src/main/ai/web-research-images.test.ts`: a successful fetch resizes and writes a file under `app.getPath('userData')/research-thumbnails/<sha256(url)>.<ext>` and returns its path; a repeat call with the same URL returns the cached path without fetching again; a fetch/decode/write failure returns `null` without throwing
- [X] T020 [US3] Extend `src/main/ipc/research-web-search.test.ts` with failing tests: a result whose parsed answer includes an `image_url` gets a non-null `localImagePath` from the (mocked) image cache; a per-result image failure yields `localImagePath: null` for that result only, without failing the rest of the batch; the raw `image_url` never appears in the handler's response
- [X] T021 [US3] Extend `src/renderer/components/MainPane/tabs/ResearchTab.test.tsx` with failing tests: a result with `localImagePath` renders a small thumbnail sourced from a `shelter://` URL built from that path; a result with `localImagePath: null` renders with no thumbnail/placeholder

### Implementation for User Story 3

- [X] T022 [US3] Implement `src/main/ai/web-research-images.ts` (fetch with a ~5s per-image timeout, resize via `sharp` to 120px wide — matching the existing `grid` thumbnail size class in `src/main/fs/thumbnails.ts` — write to `userData/research-thumbnails/<sha256(image_url)>.<ext>`, reuse on cache hit) to make T019 pass
- [X] T023 [US3] Wire per-result thumbnail fetch/cache into `src/main/ipc/research-web-search.ts` for any result with an `image_url`, stripping `image_url` from the response entirely, to make T020 pass
- [X] T024 [US3] Render the thumbnail in `src/renderer/components/MainPane/tabs/ResearchTab.tsx` via `shelter://${encodeURI(localImagePath)}` (same convention as `src/renderer/utils/paths.ts`'s `buildPhotoUrl`) to make T021 pass

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories.

- [X] T025 [P] Update `specs/018-research-web-search/quickstart.md` if any implemented behavior drifted from the walkthrough during development
- [X] T026 Run the full Jest suite (`npm test`) and confirm every new/changed test passes with no regressions in `ResearchTab.test.tsx`, `ai-settings.test.ts`, or `preload.test.ts`
- [ ] T027 [P] Manually verify quickstart.md's edge cases: uncheck mid-flight, rapid double-click, temporarily-cleared API key, a gibberish query

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Setup (needs the shared types from T001); blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational (T002-T005). No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on User Story 1 being in place (needs `ResearchTab.tsx`'s Web Sources section and result cards to attach the Add Citation action to) and on the shared `Source`/`SourceModal`/`createSource` machinery, which already exists in the codebase.
- **User Story 3 (Phase 5)**: Depends on User Story 1 (needs `research-web-search.ts` and the Web Sources result cards to already exist) but not on User Story 2.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- US1 is the foundation every other story extends — it must land first.
- US2 and US3 both extend US1's result cards but touch different concerns (citation creation vs. thumbnails) and can be built in either order once US1 is done; they touch different files except for shared edits to `ResearchTab.tsx`, so treat them as sequential on that one file even though they're logically independent.

### Within Each User Story

- Tests are written and observed failing before implementation begins (T00X test task before its paired implementation task).
- Backend/shared modules (`src/main/ai/`, `src/shared/`) precede the IPC handler wiring, which precedes the renderer change, within each story.

### Parallel Opportunities

- T002 and T004 (Foundational tests, different files) can run in parallel.
- T006, T007, and T008 (US1 tests, three different files) can run in parallel; T009/T009a touch `ResearchTab.test.tsx` and can run alongside them.
- T015 (US2, `web-research-cite.test.ts`) and T019 (US3, `web-research-images.test.ts`) touch different files from each other and from any US1 file, so — once US1 is done — US2's and US3's test tasks could start in parallel if split across contributors, even though this task list sequences them US2-then-US3.

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

Both are Priority P1 in spec.md — "search the web" without any way to keep what you found is not a usable MVP for this feature's stated purpose. Recommended minimum ship slice:

1. Complete Setup (T001) and Foundational (T002-T005).
2. Complete User Story 1 (T006-T014) — validate independently (searches work, states are correct).
3. Complete User Story 2 (T015-T018) — validate independently (citations save correctly).
4. Ship. User Story 3 (thumbnails) is a P2 fast-follow, not required for a usable MVP.

### Incremental Delivery

1. Setup + Foundational.
2. User Story 1 → validate (manual test per quickstart.md steps 1-5, minus Add Citation).
3. User Story 2 → validate (quickstart.md step 6-7).
4. User Story 3 → validate (quickstart.md step 5's thumbnail note).
5. Polish (T025-T027).

### Parallel Team Strategy

1. One contributor completes Setup + Foundational.
2. One contributor takes User Story 1 (must land before US2/US3 can start, since both extend its result cards).
3. Once US1 lands, two contributors can take US2 and US3 in parallel — different backend files (`web-research-cite.ts` vs `web-research-images.ts`), coordinating only on their respective edits to `ResearchTab.tsx`.

---

## Notes

- `[P]` tasks touch different files with no dependency on an incomplete task in the same phase.
- Every user story remains independently completable and testable, per spec.md's own "Independent Test" for each story.
- No new top-level directory beyond `src/main/ai/` (parallel to the existing `src/main/fs/`); no new dependency; no `database/` or Python changes.
