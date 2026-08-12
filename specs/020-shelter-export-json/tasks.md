---

description: "Task list template for feature implementation"
---

# Tasks: Shelter Export as Normalized JSON

**Input**: Design documents from `/specs/020-shelter-export-json/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)
**Tests**: Required for every task below — TDD requested explicitly, and this repo's constitution
(Principle II) mandates test-first for every automation path and regression fix. Every
implementation task has a preceding test task that must be written and observed failing first.
**Organization**: Tasks are grouped by user story (from spec.md) to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

This is a TypeScript Electron app (`src/main`, `src/renderer`, `src/shared`, `src/types`,
`src/factories`), not the generic `scripts/`/`tests/` layout — see plan.md's Structure Decision.
Tests are colocated `*.test.ts` files run by Jest's `main` project.

---

## Phase 1: Setup

**Purpose**: Confirm the test runner already covers every file path this feature touches — no new
scaffolding is actually needed (no new dependency, no new directory, no schema migration).

- [X] T001 Run `npx jest --listTests --selectProjects main` and confirm it picks up
      `src/main/db/builders.test.ts` (new) and `src/main/export/builder.test.ts` (rewritten)
      without any `jest.config.cjs` change — both already fall under the `main` project's
      `testMatch: ['<rootDir>/src/main/**/*.test.ts', ...]`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Two prerequisites that every user story's implementation depends on: a missing
`builders` read function, and a type-level fix (nullable relations) that `makeShelter` needs
before any shelter without an assigned architecture/builder/category can be exported correctly.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] Write a failing test in `src/main/db/builders.test.ts` (new file, modeled on
      `src/main/db/sources.test.ts`'s in-memory `better-sqlite3` + `jest.mock('./connection')`
      pattern) asserting `getAllBuilders()` returns every row from a `builders` table fixture,
      ordered by `name`.
- [X] T003 Implement `getAllBuilders()` in `src/main/db/builders.ts` (new file, matching the shape
      of `src/main/db/architectures.ts`'s `getAllArchitectures()`) to make T002 pass.
- [X] T004 [P] Extend the `makeShelter` test case in `src/factories/factories.test.ts` with a
      second assertion: calling `makeShelter(row, { architecture: null, builder: null,
      category: null, photos: [], sources: [], mapMarkers: [] })` must type-check and the result's
      `architecture`/`builder`/`category` fields must equal `null`. This will fail to compile
      until T005/T006 land.
- [X] T005 In `src/types/shelter.ts`, change `architecture: Architecture` to
      `architecture: Architecture | null`, `builder: Builder` to `builder: Builder | null`,
      `category: ShelterCategory` to `category: ShelterCategory | null`; change the `Architecture`
      import from `"@shared/ipc-types"` to `"./architecture"` (matching how `builder`/`category`
      already import their sibling raw types).
- [X] T006 In `src/factories/shelter.ts`, update the `ShelterRelations` interface's
      `architecture`/`builder`/`category` fields to `Architecture | null` / `Builder | null` /
      `ShelterCategory | null`, and change its `Architecture` import from `"@shared/ipc-types"` to
      `"../types/architecture"` to match T005. This makes T004 pass.

**Checkpoint**: Foundation ready — `getAllBuilders()` exists and `makeShelter` accepts `null`
relations. User story implementation can now begin.

---

## Phase 3: User Story 1 - Export a Normalized Data Package (Priority: P1) 🎯 MVP

**Goal**: Export produces `shelters.json` (built via `makeShelter` for every shelter, plus
top-level `architectures`/`shelterCategories`/`builders` arrays) and one photo+history folder per
shelter, all bundled into the existing dated `.zip` archive.

**Independent Test**: Trigger an export, choose a destination, and verify the `.zip` contains
`shelters.json` (with all four top-level arrays) and one folder per shelter with that shelter's
photos and history file.

**⚠️ Scope correction discovered during implementation**: `src/main/publish/index.ts` (the
Google Drive publish feature, spec 009) imports `buildManifest`, `ManifestJson`, `PhotoEntry`, and
`HistoryEntry` directly from `src/main/export/builder.ts` and diffs against that exact shape
(including `driveFileId` tracking) to decide what to upload. Rewriting `buildManifest()` in place —
as originally planned — would have broken Publish. Fix: `buildManifest()` and its types are left
**completely untouched** for Publish's use; a new, separate `buildSheltersJson()` function (with
its own `SheltersJson`/`SheltersJsonResult` types) was added alongside it for Export, and
`src/main/export/index.ts` was updated to call `buildSheltersJson()` instead of `buildManifest()`
(a one-line change to a file the plan called "unchanged" — corrected here for the record).

### Tests for User Story 1 ⚠️

- [X] T007 [P] [US1] Add a `describe('buildSheltersJson', ...)` block to
      `src/main/export/builder.test.ts` (alongside the existing `buildManifest` tests, left as-is)
      asserting: `buildSheltersJson()` writes `shelters.json` (not `shelter-manifest.json`) to
      `tmpDir`; the written JSON has top-level `shelters`, `architectures`, `shelterCategories`,
      `builders` arrays; an architecture/category/builder row with no shelter referencing it still
      appears in its top-level array (FR-004); a shelter with `show_on_web = 0` still appears in
      `shelters` (FR-006); a photo with `include_in_post = 0` still appears in its shelter's
      `photos` (FR-006).
- [X] T008 [P] [US1] Add test cases to the same `describe('buildSheltersJson', ...)` block
      asserting each shelter entry's `photos`/`sources`/`mapMarkers` arrays match what
      `makePhoto`/`makeSource`/`makeMapMarker` would produce from the same raw rows, that the
      history-file-copy behavior (a shelter's `.md` file copied into `tmpDir/{slug}/`) works, and —
      separately from the JSON shape — that each shelter's photo **files** are physically copied
      into `tmpDir/{slug}/` on disk (FR-005/SC-003), not just referenced in `shelters.json`.

### Implementation for User Story 1

- [X] T009 [US1] Add `buildSheltersJson()` to `src/main/export/builder.ts` (new function,
      `WHERE show_on_web = 1` / `WHERE include_in_post = 1` filters from the shelter/photo queries;
      add unfiltered queries for `sources` (via the `shelter_sources` join, matching
      `src/main/db/sources.ts`'s `SELECT_SOURCE`) and `map_markers`; issue **fresh**
      `SELECT * FROM architectures` / `categories` / `builders` queries — do NOT reuse the existing
      `getAllArchitectures()`/`getAllCategories()` (`src/main/db/architectures.ts`, `categories.ts`),
      which already return hydrated ipc-types shapes (e.g. `Category.name`, not
      `CategoryRow.category_name`), not the raw rows `makeArchitecture`/`makeShelterCategory`
      expect — run each raw row through `makeArchitecture`/`makeShelterCategory`/`makeBuilder`, and
      build `Map<id, T>` lookups; for each shelter row, build its
      `photos`/`sources`/`mapMarkers` via `makePhoto`/`makeSource`/`makeMapMarker`, look up its
      `architecture`/`builder`/`category` (or `null` if unset), and call
      `makeShelter(row, relations)`; write the result as `shelters.json` (top-level `shelters`,
      `architectures`, `shelterCategories`, `builders`) instead of `shelter-manifest.json`; reuse
      the photo-file-copy/history-file-copy pattern (new `copyPhotoFiles`/`copyHistoryFile`
      helpers, since the originals stayed private to `buildManifest`), returning a
      `{manifest, shelterCount, photoCount, skippedPhotos}`-shaped `SheltersJsonResult`. Update
      `src/main/export/index.ts` (and its mocks in `index.test.ts`) to call `buildSheltersJson()`
      instead of `buildManifest()` — this one file needed a one-line change, contrary to the
      original plan (see the scope-correction note above). Makes T007–T008 pass.
- [X] T010 [P] [US1] Diff the real `buildSheltersJson()` output shape (verified via the T007/T008
      test assertions) against `contracts/shelters-json-schema.md` and `quickstart.md`: field names,
      nullability, and nesting all matched what was drafted during `/speckit-plan` — no doc
      corrections were needed.

**Checkpoint**: User Story 1 is fully functional and independently testable.

---

## Phase 4: User Story 2 - Every Shelter Built the Same Way (Priority: P1)

**Goal**: Every shelter entry has an identical, complete field shape — this is a guarantee about
the output of User Story 1's implementation, not separate functionality.

**Independent Test**: Export shelters with every combination of missing data (no architecture, no
builder, no category, no photos, no sources, no map markers) and confirm every entry still has the
full field set, with `null`/`[]` in place of the missing pieces rather than an omitted field.

### Tests for User Story 2 ⚠️

- [X] T011 [P] [US2] Add fixture shelters to `src/main/export/builder.test.ts` covering every
      combination of missing `architecture_id`/`builder_id`/`category_id` and zero
      photos/sources/map_markers; assert every resulting shelter entry has `architecture`,
      `builder`, `category` present and equal to `null` when unset (never omitted, never a
      placeholder object with empty strings), and `photos`/`sources`/`mapMarkers` present and equal
      to `[]` when empty (never omitted).

### Implementation for User Story 2

No new implementation: this guarantee is already delivered by T009 calling `makeShelter` for every
shelter, which Foundational tasks T005/T006 made capable of representing unassigned relations as
`null`. This phase is test-only, confirming the guarantee holds under every combination.

**Checkpoint**: User Stories 1 and 2 both independently verified.

---

## Phase 5: User Story 3 - Export Failure Feedback (Priority: P2)

**Goal**: A missing photo file or a destination write failure still produces a usable,
non-crashing outcome for the operator — this is a regression guarantee across the rewrite, not new
functionality (`src/main/export/index.ts` and the AppHeader error-toast/re-enable logic are
unchanged per the plan).

**Independent Test**: Simulate a missing photo file on disk and confirm the export still completes
with an accurate skipped-photo count.

### Tests for User Story 3 ⚠️

- [X] T012 [P] [US3] Add a test case to `src/main/export/builder.test.ts` with a photo row whose
      `file_name` doesn't exist on disk; assert `buildSheltersJson()` skips it, still returns the
      rest of that shelter's photos, and `skippedPhotos` in the returned result reflects the
      skip — matching FR-007/SC-004.
- [X] T013 [P] [US3] `src/main/export/index.test.ts` needed a mechanical rename (its mock of
      `buildManifest` → `buildSheltersJson`, since `index.ts` now imports the new function) but no
      behavioral changes — its error-toast/re-enable coverage passes unchanged. This is the task
      that covers FR-008 (`'returns cancelled=true and savedTo=null when dialog is cancelled'`) and
      FR-009 (`'rejects and cleans up when builder throws'` and the two other
      `describe('runExport — error paths')` cases) — both unchanged by this feature, verified here
      rather than retested from scratch.

### Implementation for User Story 3

No new implementation — `src/main/export/index.ts`'s try/catch and
`src/renderer/components/AppShell/AppHeader.tsx`'s error toast/re-enable logic are unchanged; T009
already satisfies the skip-and-continue behavior this story tests.

**Checkpoint**: All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T014 [P] `npx jest --selectProjects main`: 534/534 passing (up from 514 — zero regressions).
      `npx tsc --noEmit -p .`: 18 pre-existing errors in `db/{shelters,photos,map-markers,
      categories}.ts` remain — these predate this feature (an in-progress, user-owned edit to
      `src/types/*` left those 4 files unreconciled; explicitly deferred per direct instruction
      earlier this session) and are unrelated to anything this feature touched. Zero new errors
      introduced by this feature's changes.
- [X] T015 [P] Added an addendum to `docs/adr/0011-raw-db-row-types-separate-from-ipc-types.md` —
      turned out to be more than the nullability fix: the ADR's core premise (raw column-for-column
      mirrors) had already drifted since it was written (`src/types/*` are now normalized
      camelCase shapes, produced by the new `src/factories/` layer), so the addendum documents that
      shift too, not just this feature's nullability change.
- [X] T016 Manually triggered Export from the running app (via the operator). First attempt threw:
      some photo `file_name` values include a nested subfolder (`slug/photos/x.jpg`, not just
      `slug/x.jpg`) — `copyPhotoFiles`/`buildPhotoEntries` only created the top-level shelter
      directory before copying, so `fs.copyFileSync` threw `ENOENT` on the missing `photos/`
      subfolder. Root-caused via a temporary `electron-log` trace (removed after diagnosis, except
      a permanent `log.error` on any `runExport` failure — this repo's electron-log file had zero
      visibility into export failures before now). Fixed in both `copyPhotoFiles` (new,
      `buildSheltersJson`) and `buildPhotoEntries` (old, `buildManifest` — same latent bug,
      unexercised until now since Publish never happened to touch a nested-subfolder photo);
      regression tests added to both `describe` blocks in `builder.test.ts`. Awaiting operator
      re-test after the fix to confirm the save dialog now appears end-to-end.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational completion.
- **User Story 2 (Phase 4)**: Depends on Phase 3's T009 (same implementation, additional test
  coverage) — not independent of US1's code, but independently testable/verifiable.
- **User Story 3 (Phase 5)**: Depends on Phase 3's T009 for its regression tests; otherwise
  touches no new implementation.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each Phase

- Tests (T002, T004, T007, T008, T011, T012, T013) MUST be written and observed failing before
  their corresponding implementation task.
- T005/T006 (the type fix) must land together — `src/types/shelter.ts` and
  `src/factories/shelter.ts` reference each other and will not typecheck independently.

### Parallel Opportunities

- T002 and T004 can run in parallel (different files, no shared dependency).
- T007 and T008 can run in parallel (both extend `builder.test.ts` but cover disjoint assertions —
  coordinate on the same file rather than true parallel edits if done by different people).
- T010, T014, T015 can run in parallel with each other once their prerequisites land.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (T001).
2. Complete Foundational (T002–T006).
3. Complete User Story 1 (T007–T010).
4. Validate: trigger an export and confirm `shelters.json` + photo folders + zip are correct.

### Incremental Delivery

1. Setup + Foundational.
2. User Story 1 — the export itself works end-to-end.
3. User Story 2 — confirm the shape guarantee across missing-data combinations.
4. User Story 3 — confirm failure/skip behavior survived the rewrite.
5. Polish — full suite, typecheck, ADR addendum, manual smoke test.
