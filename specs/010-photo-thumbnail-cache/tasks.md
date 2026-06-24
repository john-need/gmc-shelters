# Tasks: Photo Thumbnail Caching

**Input**: Design documents from `/specs/010-photo-thumbnail-cache/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md
**Tests**: TDD — every implementation task has a failing test written first (per plan.md Constitution Check and user's "use tdd" instruction).
**Ponytail note**: No eviction job, no per-container exact-size cache, no new size-config abstraction — two fixed size constants (`grid`, `preview`), reused across all four consumers. `nativeImage` only, no new dependency.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US4 per spec.md priorities

## Path Conventions

This feature lives entirely in the Electron app source tree: `src/main/fs/`, `src/main/index.ts`, `src/renderer/utils/`, `src/renderer/components/MainPane/tabs/`. No `scripts/`/`database/` changes, no new `contracts/` (no external consumer).

---

## Phase 1: Setup

- [ ] T001 Confirm Electron version supports `nativeImage.createThumbnailFromPath` — already verified in research.md (Electron 32); no action needed beyond running `npm test` once to confirm baseline passes before starting.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared thumbnail-cache module and protocol routing used by every consumer. No user story can be implemented until this lands.

- [X] T002 [P] Write failing tests in `src/main/fs/thumbnails.test.ts` for: cache filename pattern `<photoId>-<mtimeMs>.png` under `app.getPath('userData')/photo-thumbnails/<grid|preview>/`; cache hit returns existing file path without calling `nativeImage`; cache miss calls `nativeImage.createThumbnailFromPath` and writes the result; generation failure (mocked rejection) returns `null` without throwing and without writing a file.
- [X] T003 Before implementing, check `.shelter-media-frame` (index.css:881-889) and `.photo-preview-frame` (index.css:1706+) for realistic max rendered widths on a typical display; confirm 800px covers them (both currently cap effective width well under 800px in the existing two-column shelter layout). Implement `src/main/fs/thumbnails.ts` to make T002 pass: export `getThumbnailPath(photo: { id: number; file_name: string }, sizeClass: 'grid' | 'preview', sourcePath: string): Promise<string | null>`. Use `fs.statSync(sourcePath).mtimeMs` for the cache key, two literal size constants (`GRID_SIZE = { width: 240, height: 240 }`, `PREVIEW_SIZE = { width: 800, height: 600 }`), `fs.mkdirSync(..., { recursive: true })` for the cache dir, and `nativeImage.createThumbnailFromPath(sourcePath, size)` then `.toPNG()` written via `fs.writeFileSync`. Return `null` on any thrown error (caller falls back to original).
- [X] T004 [P] Write failing tests in `src/main/index.test.ts` for the `shelter://` protocol handler: a request URL with `?size=grid` or `?size=preview` resolves via `getThumbnailPath`, falling back to the original file if it returns `null`; a request URL with no `size` param serves the original file exactly as today (no regression).
- [X] T005 Modify the `shelter://` protocol handler in `src/main/index.ts` (around lines 115-143) to parse `request.url`'s search params, and when `size=grid|preview` is present, call `getThumbnailPath` from `src/main/fs/thumbnails.ts` and serve that file instead of the original, falling back to the original on `null`. Strips the query string before resolving the base file path (existing logic untouched otherwise).
- [X] T006 [P] Write failing tests in `src/renderer/utils/paths.test.ts` for `buildPhotoUrl(repoRoot, sheltersRoot, fileName, size?)`: omitting `size` produces today's URL unchanged; passing `'grid'` or `'preview'` appends `?size=grid` / `?size=preview`.
- [X] T007 Modify `buildPhotoUrl` in `src/renderer/utils/paths.ts` to accept an optional 4th parameter `size?: 'grid' | 'preview'` and append it as a query string when present.

**Checkpoint**: Thumbnail generation, caching, protocol routing, and URL building all work and are tested. No UI consumer wired yet.

---

## Phase 3: User Story 1 - Smooth reordering of many shelter photos (Priority: P1) 🎯 MVP

**Goal**: Photos tab grid and list views request `grid`-size thumbnails instead of full-resolution originals, fixing drag jank.

**Independent Test**: Per quickstart.md steps 4-5 — drag a photo card/row in a shelter with 50+ large photos; no visible stutter; new order persists.

### Tests for User Story 1

- [X] T008 [US1] Add tests to `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx` asserting the grid card's and list row's `<img src>` include `?size=grid`. **Deviation from original scope**: `buildPhotoUrl()` is called in `PhotosTab.tsx`'s `photoItemProps()`, not inside `PhotoCard.tsx`/`ListRow.tsx` (those components only receive an already-built `photoUrl` prop) — tests target the actual call site.
- [X] T009 *(merged into T008 — same test file/PR, see above)*

### Implementation for User Story 1

- [X] T010 [US1] In `src/renderer/components/MainPane/tabs/PhotosTab.tsx`'s `photoItemProps()` (~line 51), change `buildPhotoUrl(...)` call to pass `'grid'`. **No changes needed in `PhotoCard.tsx`/`ListRow.tsx`**: their `<img>` tags already sit inside containers with `aspect-ratio: 4/3` (`.photo-thumb`, index.css:1567) or a fixed `26×26` div (ListRow), so FR-006's layout-reservation requirement is already satisfied by existing CSS — no explicit `width`/`height` attributes needed on the `<img>` itself.
- [X] T011 *(no-op — see T010 note; nothing to do in ListRow.tsx beyond the URL change already covered by T010)*

**Checkpoint**: Photos tab grid/list drag-and-drop now renders only small cached thumbnails. MVP deliverable per spec.

---

## Phase 4: User Story 2 - Full-quality photo still available when needed (Priority: P2)

**Goal**: Photos tab selected-photo preview uses the `preview`-size thumbnail; opening the photo editor still loads the full-resolution original.

**Independent Test**: Per quickstart.md steps 6-7 — select a photo, confirm fast preview load; open editor, confirm full-resolution image loads.

### Tests for User Story 2

- [X] T012 [US2] Added tests to `PhotoDetailPane.test.tsx` (preview pane renders `selectedPhotoUrl`) and `PhotosTab.test.tsx` (`?size=preview` on the preview pane `<img>`).
- [X] T013 [US2] Added a test to `PhotoDetailPane.test.tsx` ("passes editorPhotoUrl (not selectedPhotoUrl) to the photo editor dialog") and to `PhotosTab.test.tsx` ("opening the photo editor loads the full-resolution image (no size param)").

### Implementation for User Story 2

- [X] T014 [US2] **Deviation from original scope**: discovered `PhotoEditorDialog` was wired to receive the *same* `selectedPhotoUrl` as the inline preview (`PhotoDetailPane.tsx` line 209 previously) — there was no separate full-res URL for the editor. Fixed by: (1) `PhotosTab.tsx` now computes two URLs — `selectedPhotoUrl` (with `'preview'` size, for the inline pane) and a new `editorPhotoUrl` (no size param, full-res, for the editor); (2) added `editorPhotoUrl` to `PhotoDetailPaneProps` and threaded it through to `PhotoEditorDialog`'s `photoUrl` prop instead of `selectedPhotoUrl`.
- [X] T015 [US2] Verified — `PhotoEditorDialog.tsx` itself needed no changes; it was already agnostic to which URL string it receives. The fix lives entirely in T014's caller-side wiring.

**Checkpoint**: Selected-photo preview is fast; editor unaffected. US1 + US2 both independently functional.

---

## Phase 5: User Story 3 - Fast-loading default photo on the Shelters tab (Priority: P2)

**Goal**: Shelters tab default photo display uses the `preview`-size thumbnail.

**Independent Test**: Per quickstart.md step 3 — open the Shelters tab for a shelter with a large default photo; it loads quickly and isn't blurry.

### Tests for User Story 3

- [X] T016 [US3] Updated two pre-existing assertions in `ShelterTab.test.tsx` that checked the literal default-photo `<img src>` to expect the new `?size=preview` suffix (these tests predated this feature and asserted the exact URL string, so they doubled as regression coverage once updated).

### Implementation for User Story 3

- [X] T017 [US3] In `src/renderer/components/MainPane/tabs/ShelterTab.tsx`: `defaultPhotoUrl` (~line 572) now passes `'preview'`. Also updated `DefaultPhotoModal`'s own large "stage" image (`dppPhotoUrl`, ~line 86) to `'preview'` (it's a large modal-width image, same blur risk as the main display) and its filmstrip thumbnails (`thumbUrl`, ~line 155) to `'grid'` (small selection thumbnails).

**Checkpoint**: All three primary display surfaces (grid, list, shelters tab, photos-tab preview) use cached thumbnails.

---

## Phase 6: User Story 4 - Thumbnails stay correct after photo changes (Priority: P3)

**Goal**: Confirm the mtime-keyed cache (built in Phase 2) actually produces fresh thumbnails when a photo's source file changes — no new production code, just the end-to-end regression test the earlier foundational work was designed for.

**Independent Test**: Per quickstart.md step 8 — edit/replace a photo, confirm grid/list/shelter-tab/preview all show the updated image.

### Tests for User Story 4

- [X] T018 [US4] Covered by the "regenerates when the source file mtime changes (cache invalidation)" test already added to `src/main/fs/thumbnails.test.ts` in T002/Foundational — no further code needed; this checkpoint just confirms FR-004 is proven.

**Checkpoint**: All four user stories independently functional and tested.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T019 [P] Ran full two-project Jest suite: 707/707 passed.
- [ ] T020 [P] Manual pass through quickstart.md steps 1-8 in `npm start` — left for the user to verify visually (drag smoothness/blur are perceptual checks an automated run can't confirm).
- [X] T021 Ran `npm run lint`: zero errors.

---

## Dependencies & Execution Order

- **Setup (T001)**: No dependencies.
- **Foundational (T002-T007)**: Blocks all user stories — thumbnail module, protocol routing, and URL helper must exist first.
- **US1 (T008-T011)**: Depends on Foundational. Independent of US2/US3/US4.
- **US2 (T012-T015)**: Depends on Foundational. Independent of US1/US3/US4.
- **US3 (T016-T017)**: Depends on Foundational. Independent of US1/US2/US4.
- **US4 (T018)**: Depends on Foundational (Phase 2's cache logic); written as a regression test, no implementation dependency on US1-US3.
- **Polish (T019-T021)**: Depends on all desired stories being complete.

### Parallel Opportunities

- T002, T004, T006 (all test-writing, different files) can run in parallel.
- T008+T009, and T010+T011, are each parallel pairs (different files).
- Once Foundational is done, US1/US2/US3/US4 phases can proceed in parallel across contributors since they touch disjoint files (`PhotoCard.tsx`+`ListRow.tsx` vs `PhotoDetailPane.tsx`+`PhotoEditorDialog.tsx` vs `ShelterTab.tsx` vs `thumbnails.test.ts`).

---

## Implementation Strategy

**MVP first**: Phase 1 → Phase 2 → Phase 3 (US1) delivers the core complaint fix (drag-and-drop jank) and is independently shippable.

**Incremental delivery**: Add US2 (editor/preview split), then US3 (shelters tab), then US4's regression test, then polish.
