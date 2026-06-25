# Tasks: Safe Shelter Slug Renames

**Input**: Design documents from `/specs/012-shelter-slug-rename/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/shelters-update-ipc.md, quickstart.md
**Tests**: TDD explicitly requested — every behavior-bearing task below writes a failing test before the implementation task that makes it pass. The one exception is T024, a trivial one-line UI mirror of already-tested server-side logic (see T020–T023); per ponytail's "trivial one-liners need no test" rule, it carries no separate test task.
**Organization**: Tasks are grouped by user story (US1/US2/US3, matching spec.md priorities P1/P2/P3) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Every task names an exact file path

## Path Conventions

This is the existing Electron app layout (not the generic `scripts/`/`database/migrations/` layout in the constitution template — see plan.md's Constitution Check):

- Shared cross-process util: `src/shared/`
- Main process DB layer: `src/main/db/`
- Main process filesystem layer: `src/main/fs/`
- Main process IPC layer: `src/main/ipc/`
- Preload bridge: `src/main/preload.ts`
- Renderer store: `src/renderer/store/`
- Renderer UI: `src/renderer/components/MainPane/tabs/`
- Tests are colocated `*.test.ts`/`*.test.tsx` files next to the module they cover (this repo's existing convention — no separate `tests/` tree)

## Phase 1: Setup

No new scaffolding, dependencies, or test-runner config needed — this feature reuses the existing Jest setup, file layout, and IPC/preload patterns already in the repo (`SHELTERS_DELETE`'s `sheltersRoot` payload, `deleteShelter`'s `db.transaction()`). Skipped per plan.md / Constitution Check; proceed directly to Foundational.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Extract the slug sanitizer that today is duplicated inline in two places, into one shared module all three user stories will call. This is pure extraction — no behavior change yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 [P] Write failing tests for `slugify()` in `src/shared/slug.test.ts` — cases: lowercases input, replaces runs of non-alphanumeric chars with a single hyphen, strips leading/trailing hyphens, strips `/` and `..` segments, returns `''` for an all-symbol/space input
- [X] T002 Implement `slugify(name: string): string` in `src/shared/slug.ts` to make T001 pass — same regex already used at `src/main/db/shelters.ts:113-116` and `src/renderer/store/sheltersSlice.ts:63-66`, just exported from one place
- [X] T003 [P] Replace the inline slug regex in `createShelter()` (`src/main/db/shelters.ts:113-116`) with a call to the shared `slugify()` from T002 — run existing `src/main/db/shelters.test.ts` to confirm no regression
- [X] T004 [P] Replace the inline slug regex in the offline fallback of `createShelter` thunk (`src/renderer/store/sheltersSlice.ts:63-66`) with a call to the shared `slugify()` from T002 — run existing `src/renderer/store/sheltersSlice.test.ts` to confirm no regression

**Checkpoint**: `slugify()` exists, is tested, and both pre-existing call sites use it. Foundation ready for user story work.

---

## Phase 3: User Story 1 - Rename a shelter's slug without losing its photos or history (Priority: P1) 🎯 MVP

**Goal**: Changing a shelter's slug and saving renames its folder on disk and rewrites `photos.file_name`/`shelters.history` so photos and history keep working under the new slug. A save where the slug didn't change touches nothing on disk.

**Independent Test**: Per quickstart.md scenarios 1–2 — create a shelter with a photo and a history note, rename its slug, confirm the photo displays, history loads, and the old folder is gone; then edit an unrelated field and confirm nothing on disk moves.

### Tests for User Story 1 ⚠️

- [X] T005 [P] [US1] Write failing tests in `src/main/db/shelters.test.ts`: `updateShelter` given a changed slug rewrites `photos.file_name` rows (`shelter_id = ?` and `file_name LIKE oldSlug || '/%'`) and `shelters.history` (`history LIKE oldSlug || '/%'`) in the same call; given an unchanged slug, makes no `photos`/`history` prefix changes
- [X] T006 [P] [US1] Write failing tests in `src/main/fs/photos.test.ts` for a new `renameShelterDir(oldSlug, newSlug, sheltersRoot)`: renames `{sheltersRoot}/{oldSlug}` to `{sheltersRoot}/{newSlug}` via `fs.rename`; if the old dir doesn't exist, logs a warning and resolves without throwing
- [X] T007 [P] [US1] Write failing tests in `src/main/ipc/shelters.test.ts` for the `SHELTERS_UPDATE` handler: reads the shelter's current slug via `getShelterById` before calling `updateShelter`; when the returned slug differs from the read slug, calls `renameShelterDir(oldSlug, newSlug, sheltersRoot)` after the DB call succeeds; if `renameShelterDir` rejects, calls `updateShelter` again with the slug swapped back and rethrows the original error
- [X] T008 [P] [US1] Write a failing test in `src/renderer/store/sheltersSlice.test.ts`: the `saveShelter` thunk calls `window.api.shelters.update(shelter, sheltersRoot)` where `sheltersRoot` comes from `loadStoredPaths().SHELTERS_ROOT` (same helper already used by `loadHistory`/`saveHistory`)

### Implementation for User Story 1

- [X] T009 [US1] In `src/main/db/shelters.ts`, extend `updateShelter()` to: fetch the row's current slug before the `UPDATE`, and when `shelter.slug` differs from it, wrap the existing `UPDATE shelters ...` plus two new `UPDATE photos SET file_name = ...` / `UPDATE shelters SET history = ...` prefix-rewrite statements in one `db.transaction()` — makes T005 pass
- [X] T010 [US1] In `src/main/fs/photos.ts`, add `renameShelterDir(oldSlug, newSlug, sheltersRoot): Promise<void>` next to `ensureShelterDir`/`deleteShelterDir`, resolving paths the same way those two do — makes T006 pass
- [X] T011 [US1] In `src/main/ipc/shelters.ts`, change the `SHELTERS_UPDATE` handler to accept `{ shelter, sheltersRoot }`, read `oldSlug` via `getShelterById(shelter.id)`, call `updateShelter(shelter)`, then call `renameShelterDir` when the slug changed, with the rollback-and-rethrow behavior from T007 — makes T007 pass
- [X] T012 [US1] In `src/main/preload.ts`, change `shelters.update` to `(shelter: Shelter, sheltersRoot: string) => ipcRenderer.invoke(CHANNELS.SHELTERS_UPDATE, { shelter, sheltersRoot })`
- [X] T013 [US1] In `src/renderer/store/sheltersSlice.ts`, update the `saveShelter` thunk to call `window.api.shelters.update(shelter, loadStoredPaths().SHELTERS_ROOT)` — makes T008 pass

**Checkpoint**: User Story 1 is fully functional and independently testable — a slug rename moves the folder and keeps photos/history working; a no-op save touches nothing on disk.

---

## Phase 4: User Story 2 - Reject duplicate slugs with a clear message (Priority: P2)

**Goal**: Renaming a slug to one already in use, or to a name an untracked folder already occupies, is rejected up front with a clear message — no partial mutation, no raw constraint error.

**Independent Test**: Per quickstart.md scenarios 3 and 6 — create two shelters and rename one to the other's slug; separately, pre-create a stray folder and try to rename a shelter to that name. Both must fail with a clear toast and leave everything unchanged.

### Tests for User Story 2 ⚠️

- [X] T014 [P] [US2] Write a failing test in `src/main/db/shelters.test.ts`: `updateShelter` throws `Error('Slug "<value>" is already in use')` when the target slug matches another shelter's `slug` (`id != this.id`), and neither shelter's row is modified
- [X] T015 [P] [US2] Write a failing test in `src/main/fs/photos.test.ts`: `renameShelterDir` throws (`A folder named "<newSlug>" already exists`) when the target directory already exists, without touching the source directory
- [X] T016 [P] [US2] Write a failing test in `src/renderer/components/MainPane/tabs/ShelterTab.test.tsx`: when `dispatch(saveShelter(...))` resolves as `saveShelter.rejected`, `handleSave` dispatches `showToast` with the rejection's error message

### Implementation for User Story 2

- [X] T017 [US2] In `src/main/db/shelters.ts`, add the duplicate check to `updateShelter()` before the `UPDATE`/transaction added in T009: `SELECT id FROM shelters WHERE slug = ? AND id != ?`, throw if found — makes T014 pass
- [X] T018 [US2] In `src/main/fs/photos.ts`, add the target-exists guard to `renameShelterDir()` (from T010): check the new dir with `fs.access` before `fs.rename`, throw if it exists — makes T015 pass
- [X] T019 [US2] In `src/renderer/components/MainPane/tabs/ShelterTab.tsx`, update `handleSave` to check `saveShelter.rejected.match(result)` and `dispatch(showToast({ id: Date.now().toString(), message: result.error.message }))` — makes T016 pass

**Checkpoint**: User Stories 1 and 2 both work independently — renames succeed and move files, or fail clearly with zero side effects.

---

## Phase 5: User Story 3 - Slug is always sanitized to a safe value (Priority: P3)

**Goal**: Whatever a staff member types into the Slug field, the value used for the database and filesystem is always a safe, lowercase, hyphen-separated string with no path-traversal characters — and a value that sanitizes to nothing is rejected, not silently substituted.

**Independent Test**: Per quickstart.md scenarios 4 and 5 — enter a slug with uppercase/spaces/`/` and confirm the stored/on-disk slug is sanitized; enter an all-symbols slug and confirm the save is rejected with a clear error before any change.

### Tests for User Story 3 ⚠️

- [X] T020 [P] [US3] Write a failing test in `src/main/db/shelters.test.ts`: `updateShelter` given `shelter.slug = "My Shelter/Two"` stores and uses `"my-shelter-two"` for the rename/duplicate/patch logic from T009/T017 (the raw value is never used for file/folder paths)
- [X] T021 [P] [US3] Write a failing test in `src/main/db/shelters.test.ts`: `updateShelter` given a slug that sanitizes to `''` (e.g. `"!!!"`) throws `Error('Slug cannot be empty after removing invalid characters')` before any DB write or disk call

### Implementation for User Story 3

- [X] T022 [US3] In `src/main/db/shelters.ts`, at the top of `updateShelter()`, replace direct uses of `shelter.slug` with `slugify(shelter.slug)` (from T002) for the duplicate check (T017), rename detection (T009), and the stored value — makes T020 pass
- [X] T023 [US3] In `src/main/db/shelters.ts`, add the empty-sanitized-slug check immediately after the T022 sanitization call, before the duplicate check or any `UPDATE` — makes T021 pass
- [X] T024 [P] [US3] In `src/renderer/components/MainPane/tabs/ShelterTab.tsx`, normalize the Slug input's `onBlur` through the shared `slugify()` (from T002) so staff see the sanitized value immediately rather than discovering it after a failed save (cheap client-side guardrail; server-side checks from T022/T023 remain the source of truth — no test required, this is a one-line UX mirror of already-tested server logic)

**Checkpoint**: All three user stories are independently functional — sanitization, duplicate/empty rejection, and the rename-with-rollback flow from US1 all compose correctly.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T025 Run the full suite (`npm test`) to confirm no regressions across `src/main` and `src/renderer` Jest projects — 765/765 pass (one unrelated `publish/gdrive.test.ts` worker OOM in parallel run, confirmed pre-existing/unrelated by passing in isolation); `tsc --noEmit` and `eslint` also clean on all touched files
- [ ] T026 [P] Walk through quickstart.md scenarios 1–6 manually in the running app (`npm run dev` or equivalent) and confirm each matches its expected outcome — left for manual verification in the running Electron app

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None — skipped, nothing to scaffold.
- **Foundational (Phase 2)**: No dependencies; blocks all user stories (US1's rename, US2's duplicate check, and US3's sanitization all call `slugify()`).
- **User Story 1 (Phase 3)**: Depends on Phase 2. Independently completable and testable on its own (MVP).
- **User Story 2 (Phase 4)**: Depends on Phase 2. Builds on the `updateShelter()`/`renameShelterDir()` functions US1 introduces (T017/T018 add guards to functions T009/T010 create), so implement after US1, but its *tests* (T014–T016) can be written in parallel with US1's tests.
- **User Story 3 (Phase 5)**: Depends on Phase 2. Adds a `slugify()` call inside the same `updateShelter()` function US1/US2 already modified, so implement last.
- **Polish (Phase 6)**: Depends on all three user stories being complete.

### Within Each User Story

- Tests (T005–T008, T014–T016, T020–T021) MUST be written and observed failing before their corresponding implementation tasks.
- `src/main/db/shelters.ts` accumulates logic across US1 → US2 → US3 in this order: rename+patch (T009) → duplicate check (T017) → sanitize+empty check (T022/T023). Each later task edits the same function, so these three are sequential, not parallel.
- `src/main/fs/photos.ts`'s `renameShelterDir` similarly accumulates: create (T010) → target-exists guard (T018). Sequential.

### Parallel Opportunities

- T001, T003, T004 (Foundational) touch different files and can run in parallel.
- T005, T006, T007, T008 (US1 tests) touch different files and can run in parallel with each other.
- T014, T015, T016 (US2 tests) and T020, T021 (US3 tests) can be written in parallel with the US1 test tasks, since they're additive tests on functions not yet written — but their matching implementation tasks must wait for T009/T010 to exist first.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2 (Foundational): shared `slugify()`.
2. Complete Phase 3 (US1): rename moves the folder and patches `photos`/`history`. Slug input is otherwise untouched (no dedup/sanitization yet) — fine for the MVP since the spec scopes those as separate, lower-priority stories.
3. Validate via quickstart.md scenarios 1–2 before expanding scope.

### Incremental Delivery

1. Foundational → US1 (MVP, renames work) → US2 (renames stop being dangerous to collide) → US3 (renames stop being unsafe to type into) → Polish.
2. Each story's checkpoint is independently demoable per quickstart.md.
