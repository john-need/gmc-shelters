# Tasks: Schema-Driven Wiki Header Editor

**Input**: Design documents from `/specs/014-wiki-header-schema-form/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wiki-header-ipc.md, contracts/collections-citation-type-ipc.md, quickstart.md
**Tests**: TDD explicitly requested (spec input, plan.md Technical Context) — every behavior-bearing task below writes a failing test before the implementation task that makes it pass.
**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md priorities P1/P2/P3) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

Hybrid layout (see plan.md's Structure Decision):

- TypeScript/Electron side, tests colocated `*.test.ts`/`*.test.tsx` next to the module (this repo's existing convention): `src/shared/`, `src/main/ipc/`, `src/main/preload.ts`, `src/renderer/hooks/`, `src/renderer/components/Settings/`
- Python side, tests under `tests/unit/` (this repo's existing convention): `scripts/`, `scripts/lib/`

## Phase 1: Setup

No new scaffolding, dependencies, or test-runner config needed — this feature reuses the existing Jest/pytest setup, the existing `SourceType` enum, and the existing `spawn('python3', …)` IPC pattern already used by `COLLECTIONS_RUN`. Skipped per plan.md (no new dependency, no new directory); proceed directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared per-citation-type field schema, plus the frontmatter parse/serialize and IPC contract rework that both User Story 1 and User Story 2 build on. Neither story's form can render or save correctly without this.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Write failing tests in `src/shared/wiki-header-schema.test.ts`: the schema table has an entry for all 12 `SourceType` values; `validateHeader('book', fields)` returns `{ ok: false, errors: [...] }` when a `required`-for-book property (e.g. `title`, `author`) is empty; returns an error when `citationType` isn't a known `SourceType`; returns an error when `printed_volume`/`printed_issue` holds a non-numeric string; returns `{ ok: true, fields }` with an `n/a`-for-that-type property (e.g. `volume` for `map`) silently dropped from the returned `fields` even if present in the input
- [X] T002 Implement `src/shared/wiki-header-schema.ts`: the `HEADER_SCHEMA` table from `data-model.md` (property → control kind → per-`SourceType` applicability) and `validateHeader(citationType, fields): { ok: true; fields: Record<string,string> } | { ok: false; errors: string[] }` — makes T001 pass
- [X] T003 [P] Write failing tests in `src/main/ipc/wiki-search.test.ts` for new `parseFrontmatter(raw: string)`: given a `---\nkey: "value"\n...\n---\n` block, returns `{ fields: Record<string,string> }` with quotes stripped; given text with no frontmatter fences, returns `{ fields: {} }`
- [X] T004 [P] Write failing tests in `src/main/ipc/wiki-search.test.ts` for new `serializeFrontmatter(fields: Record<string,string>)`: produces a `---\n...\n---\n` block with one `key: "value"` line per entry, values with embedded `"` escaped; round-tripping `parseFrontmatter(serializeFrontmatter(fields))` returns the original `fields`
- [X] T005 Implement `parseFrontmatter`/`serializeFrontmatter` in `src/main/ipc/wiki-search.ts` — makes T003/T004 pass
- [X] T006 [P] Write failing tests in `src/main/ipc/wiki-search.test.ts` for the reworked `WIKI_GET_HEADER` handler: given an existing wiki markdown file, returns `{ citationType, fields, preserved: { type, resource, timestamp, pages } }` per `contracts/wiki-header-ipc.md`, with `fields` containing only the properties `wiki-header-schema.ts` marks `required`/`optional` for that `citationType`; returns `null` when the file doesn't exist (unchanged behavior)
- [X] T007 [P] Write failing tests in `src/main/ipc/wiki-search.test.ts` for the reworked `WIKI_SAVE_HEADER` handler: given `{ citationType, fields }` that pass `validateHeader`, serializes `preserved` (read from the file's *existing* header, untouched by the payload) plus the validated `fields` into the frontmatter block, leaves the document body byte-identical, and returns `{ ok: true }`; given a payload that fails `validateHeader` (e.g. missing required field), returns `{ ok: false, errors }` and does not modify the file; given a file that doesn't exist, returns `{ ok: false, error: 'This file has not been added to the wiki yet.' }` (unchanged behavior)
- [X] T008 Implement the `WIKI_GET_HEADER` handler rework in `src/main/ipc/wiki-search.ts` (uses `parseFrontmatter` from T005) — makes T006 pass
- [X] T009 Implement the `WIKI_SAVE_HEADER` handler rework in `src/main/ipc/wiki-search.ts` (uses `validateHeader` from T002 and `serializeFrontmatter` from T005; reads `preserved.type` from the file's current header before overwriting) — makes T007 pass
- [X] T010 [P] Update `src/shared/ipc-types.ts`: add `WikiHeaderPayload`/`WikiHeaderPreserved` types and change `ElectronAPI['wiki']['getHeader']`/`['saveHeader']` signatures to match `contracts/wiki-header-ipc.md`
- [X] T011 Update `src/main/preload.ts`: change `wiki.getHeader`/`wiki.saveHeader` to invoke the channels with the new structured payload shape from T010

**Checkpoint**: `wiki-header-schema.ts` exists and is tested; `WIKI_GET_HEADER`/`WIKI_SAVE_HEADER` return/accept structured, schema-validated data. Foundation ready for User Story 1 and 2.

---

## Phase 3: User Story 1 - Edit a file's header with per-property controls (Priority: P1) 🎯 MVP

**Goal**: The header editor shows one labeled control per header property (instead of a single textarea), pre-filled from the file's current header, and blocks Save until every required property for the file's citation type is present and correctly shaped.

**Independent Test**: Per quickstart.md — open "Edit header" for an already-converted wiki file, confirm each property renders as its own field, clear a required field and confirm Save is blocked with a clear reason, then fill it back in, change the title, save, and confirm the file's frontmatter reflects only that change with the body untouched.

### Tests for User Story 1 ⚠️

- [X] T012 [P] [US1] Write failing tests in `src/renderer/components/Settings/CollectionsManagementPage.test.tsx`: `HeaderEditorDialog`, given a `getHeader` result with `citationType: 'magazine'`, renders one labeled input per property `wiki-header-schema.ts` marks `required`/`optional` for `magazine` (no `<textarea>` for the whole header); `resource`, `timestamp`, `pages`, and the preserved `type` render as read-only text, not editable controls
- [X] T013 [P] [US1] Write a failing test in `CollectionsManagementPage.test.tsx`: clearing a field marked `required` for the loaded citation type disables the Save button (or shows a blocking inline error) and does not call `window.api.wiki.saveHeader`
- [X] T014 [P] [US1] Write a failing test in `CollectionsManagementPage.test.tsx`: entering a non-numeric value into a `number`-control field (`printed_volume`/`printed_issue`) shows an inline error and blocks Save
- [X] T015 [P] [US1] Write a failing test in `CollectionsManagementPage.test.tsx`: with all required fields valid, clicking Save calls `window.api.wiki.saveHeader(path, { citationType, fields })` with exactly the schema-applicable fields for the loaded citation type, and closes the dialog when the result is `{ ok: true }`
- [X] T012a [P] [US1] Write failing tests in `src/main/ipc/wiki-search.test.ts`: `WIKI_GET_HEADER`, given a file whose on-disk `citation_type` is not one of the 12 known `SourceType` values, still returns a payload (does not throw or return `null`) with that raw value intact; given a file missing a property the schema requires for its citation type, still returns a payload with that field empty rather than omitting it
- [X] T012b [P] [US1] Write a failing test in `CollectionsManagementPage.test.tsx`: `HeaderEditorDialog`, given a `getHeader` payload with an unrecognized `citationType` or an empty required field, still renders the form (does not error or blank-screen) and visibly flags the non-conforming value(s)

### Implementation for User Story 1

- [X] T016 [US1] Rewrite `HeaderEditorDialog` in `src/renderer/components/Settings/CollectionsManagementPage.tsx`: on load, call `wiki.getHeader` and render one control per property from `wiki-header-schema.ts`'s table for the loaded `citationType` (text input, multiline textarea, number input, or select, per the property's `control` kind), plus read-only rows for `preserved`; flag an unrecognized `citationType` and treat a required-but-empty field as already-invalid on first render — makes T012/T012a/T012b pass
- [X] T017 [US1] In the same dialog, track draft field values in local state and call `validateHeader` (from `src/shared/wiki-header-schema.ts`) on every change; disable Save and show the specific error(s) when validation fails — makes T013/T014 pass
- [X] T018 [US1] Wire the Save button to call `wiki.saveHeader(path, { citationType, fields })` with the validated draft, close the dialog on `{ ok: true }`, and show returned `errors` inline without closing on `{ ok: false }` — makes T015 pass

**Checkpoint**: User Story 1 is fully functional and independently testable — the textarea is gone, every property has its own control, and invalid saves are blocked with a clear reason.

---

## Phase 4: User Story 2 - Header form adapts to the selected citation type (Priority: P2)

**Goal**: Changing the Citation Type field inside the header editor re-renders the visible fields to match the newly selected type's schema, retaining values for fields shared between the old and new type and dropping values for fields that no longer apply.

**Independent Test**: Per quickstart.md — open the header editor for a magazine-type file, switch Citation Type to Map, confirm volume/issue fields disappear and the title/description values are retained, then save and confirm the saved header contains no volume/issue properties.

### Tests for User Story 2 ⚠️

- [X] T019 [P] [US2] Write a failing test in `CollectionsManagementPage.test.tsx`: changing the Citation Type select from `magazine` to `map` removes the `volume`/`printed_volume`/`printed_issue` fields from the rendered form (per the schema's `n/a` entries for `map`)
- [X] T020 [P] [US2] Write a failing test in `CollectionsManagementPage.test.tsx`: a value entered in a field present in both the old and new citation type's schema (e.g. `title`) is still shown after switching citation type
- [X] T021 [P] [US2] Write a failing test in `CollectionsManagementPage.test.tsx`: a value entered in a field only applicable to the old citation type is not present in the `fields` object passed to `wiki.saveHeader` after switching to a type where that field is `n/a`, then saving

### Implementation for User Story 2

- [X] T022 [US2] Add a Citation Type `<select>` to `HeaderEditorDialog` (`src/renderer/components/Settings/CollectionsManagementPage.tsx`), populated from the `SourceType` union; on change, recompute the visible field set from `wiki-header-schema.ts` for the newly selected type, carrying over draft values for keys present in both the old and new type's schema and discarding the rest — makes T019/T020/T021 pass

**Checkpoint**: User Stories 1 and 2 both work independently — the form's field set always matches the currently selected citation type, live.

---

## Phase 5: User Story 3 - Set a collection's default citation type (Priority: P3)

**Goal**: An operator sets a citation type once per collection from the Collections Management page; new files added to the wiki from that collection default to it; existing files and other collections are unaffected.

**Independent Test**: Per quickstart.md — set a citation type on a collection with none configured, confirm it's saved, then add a new file from that collection to the wiki and confirm its header's `citation_type` matches the collection default without manual entry.

### Tests for User Story 3 ⚠️

- [X] T023 [P] [US3] Write a failing test in `tests/unit/test_collection_status.py`: `scan()` includes `citation_type` in each collection's dict, sourced from `load_collection_meta(folder).get('citation_type')`; a collection whose `metadata.yaml` has no `citation_type` key gets `citation_type: None`
- [X] T024 [P] [US3] Write failing tests in `tests/unit/test_wiki_convert.py` for new `set_collection_citation_type(collection_dir, citation_type)`: given a `metadata.yaml` with no `citation_type` key, inserts a new top-level `citation_type: "<value>"` line while leaving `organization:`, `files:`, and any comment lines byte-identical; given a `metadata.yaml` that already has a `citation_type` line, replaces only that line's value; given a collection with no `metadata.yaml` yet, creates one containing just the `citation_type` line; given a fixture with a sibling `wiki/<collection>/*.md` file, asserts that file's content and mtime are unchanged after the call
- [X] T025 [P] [US3] Write failing tests in `src/main/ipc/collections.test.ts` for a new `COLLECTIONS_SET_CITATION_TYPE` handler: spawns `python3 scripts/set_collection_citation_type.py <name> <type>` (mirroring the existing `python()` helper usage for `COLLECTIONS_RUN`) and returns `{ ok: true }` on exit code 0; returns `{ ok: false, error }` on non-zero exit, without throwing
- [X] T026 [P] [US3] Write a failing test in `CollectionsManagementPage.test.tsx`: each collection row renders a citation-type `<select>` pre-filled from that collection's `citationType` (or a distinct placeholder when `null`); changing it calls `window.api.collections.setCitationType(name, value)`

### Implementation for User Story 3

- [X] T027 [US3] Extend `scan()` in `scripts/lib/collection_status.py` to add `'citation_type': load_collection_meta(folder).get('citation_type')` to each collection's result dict — makes T023 pass
- [X] T028 [US3] Implement `set_collection_citation_type(collection_dir: Path, citation_type: str) -> None` in `scripts/lib/wiki_convert.py`, using the same targeted line-patch technique as `scripts/patch_citation_types.py` — makes T024 pass
- [X] T029 [US3] Create `scripts/set_collection_citation_type.py`: thin CLI wrapper (collection name + citation type as argv), mirroring `scripts/collection_status.py`'s shape, calling `set_collection_citation_type` from T028
- [X] T030 [US3] Add `COLLECTIONS_SET_CITATION_TYPE` to `CHANNELS` and `CollectionStatus.citationType: string | null` to `src/shared/ipc-types.ts`, per `contracts/collections-citation-type-ipc.md`
- [X] T031 [US3] Implement the `COLLECTIONS_SET_CITATION_TYPE` handler in `src/main/ipc/collections.ts` (spawns `scripts/set_collection_citation_type.py` from T029 via the existing `python()` helper) — makes T025 pass
- [X] T032 [P] [US3] Add `collections.setCitationType` to `src/main/preload.ts` and a matching stub to `src/renderer/hooks/useIpc.ts`'s `noopApi.collections`
- [X] T033 [US3] Add the citation-type `<select>` to each collection row in `CollectionsManagementPage.tsx`, wired to `window.api.collections.setCitationType` — makes T026 pass

**Checkpoint**: All three user stories are independently functional — per-property editing, type-adaptive fields, and the collection-level default all compose correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T034 Run the full suite (`npm test` and `pytest`) to confirm no regressions across `src/main`, `src/renderer`, and the Python `tests/unit`/`tests/integration` trees
- [ ] T035 [P] Walk through `quickstart.md`'s two scenarios manually in the running app (`npm run dev` or equivalent) and confirm each matches its expected outcome
- [ ] T036 [P] Update the Collections Management page's in-app description (`src/renderer/components/Settings/CollectionsManagementPage.tsx`) to mention the new per-collection citation-type control, per spec.md's Operator Documentation note

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, nothing to scaffold.
- **Foundational (Phase 2)**: No dependencies; blocks User Story 1 and User Story 2 (both render/validate/save through `wiki-header-schema.ts` and the reworked `WIKI_GET_HEADER`/`WIKI_SAVE_HEADER`).
- **User Story 1 (Phase 3)**: Depends on Phase 2. Independently completable and testable on its own (MVP).
- **User Story 2 (Phase 4)**: Depends on Phase 2 and on User Story 1's `HeaderEditorDialog` existing (T022 edits the same component T016–T018 create) — implement after US1.
- **User Story 3 (Phase 5)**: Depends only on Phase 2's existing `SourceType`/`ipc-types.ts` groundwork, not on US1/US2's header-editor work — touches entirely different files (`collections.ts`, `collection_status.py`, `wiki_convert.py`, the collection-row half of `CollectionsManagementPage.tsx`). Can be implemented in parallel with US1/US2 by a separate contributor once Phase 2 lands.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests (T012–T015, T012a–T012b, T019–T021, T023–T026) MUST be written and observed failing before their corresponding implementation tasks.
- `HeaderEditorDialog` in `CollectionsManagementPage.tsx` accumulates logic across US1 → US2 in this order: per-property rendering + validation (T016–T018) → citation-type switching (T022). Same component, same file — sequential, not parallel.
- `CollectionsManagementPage.tsx`'s collection-row citation-type `<select>` (T033, US3) is a separate piece of the same file from `HeaderEditorDialog` — can be worked in parallel with US1/US2's dialog changes without merge conflicts in practice, but review both together before considering the file done.

### Parallel Opportunities

- T001, T003, T004 (Foundational tests) touch different concerns in different describe blocks and can be written in parallel.
- T010, T011 (Foundational types/preload) touch different files and can run in parallel with each other, once T002/T005/T008/T009 define the shapes they mirror.
- T012–T015 and T012a–T012b (US1 tests) can be written in parallel with each other.
- T019–T021 (US2 tests) and T023–T026 (US3 tests) can be written in parallel with the US1 test tasks, since they're additive tests against not-yet-written behavior — but matching implementation tasks must wait for their own prerequisites (US2 waits on US1's dialog; US3's are independent of US1/US2 entirely).
- T027, T028, T029 (US3 Python implementation) are naturally sequential within `wiki_convert.py`/`scripts/`, but T030, T032 (TS types/preload/stub) can run in parallel with them since they don't depend on the Python side existing yet — only on the contract shape already fixed in `contracts/collections-citation-type-ipc.md`.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2 (Foundational): schema table, validation, frontmatter parse/serialize, reworked IPC contract.
2. Complete Phase 3 (US1): the textarea is gone, every property has its own validated control.
3. Validate via quickstart.md's header-editing walkthrough before expanding scope.

### Incremental Delivery

1. Foundational → US1 (MVP, safe per-property editing) → US2 (form adapts live to citation type) → US3 (collection-level default, can land in parallel with US1/US2 by a second contributor) → Polish.
2. Each story's checkpoint is independently demoable per quickstart.md.
