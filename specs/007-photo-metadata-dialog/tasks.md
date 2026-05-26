# Tasks: Photo Metadata Dialog (File Layer)

**Input**: `specs/007-photo-metadata-dialog/spec.md` + codebase context (plan.md absent — derived from spec + codebase)
**Prerequisites**: spec.md ✅ — plan.md ⚠️ absent
**Tests**: TDD — every user story starts with failing tests before any implementation.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in all descriptions

## Tech Stack Reference

- Renderer: React + TypeScript, Redux Toolkit (`useDispatch`, `useSelector`)
- Main process: Electron IPC + `exiftool-vendored` (`ExifTool` class)
- Tests (renderer): Jest + `@testing-library/react`, store-per-test pattern
- Tests (main): Jest, exiftool mocked via `jest.mock`
- Dialog pattern: `position:fixed` overlay + `role="dialog" aria-modal="true"`
- Existing analogues: `PhotoEditorDialog.tsx`, `writePhotoXmp` / `readPhotoXmp` in `src/main/fs/photos.ts`

---

## Phase 1: Setup (Shared Types)

**Purpose**: Add the `FileMetadataTag` type, new IPC channel constants, and updated `ElectronAPI` interface to shared types — just enough for TypeScript to compile in all test files before implementation begins.

- [x] T001 Add `FileMetadataTag` interface (`{ group: string; key: string; label: string; value: string | null; writable: boolean }`), `PHOTOS_READ_FILE_METADATA: 'photos:readFileMetadata'` and `PHOTOS_WRITE_FILE_METADATA: 'photos:writeFileMetadata'` to `CHANNELS`, and `readFileMetadata(slug: string, fileName: string, sheltersRoot: string): Promise<FileMetadataTag[]>` + `writeFileMetadata(slug: string, fileName: string, sheltersRoot: string, tags: Record<string, string>): Promise<void>` stubs to `ElectronAPI.photos` in `src/shared/ipc-types.ts`; add matching stub `ipcRenderer.invoke` calls to `src/main/preload.ts`

---

## Phase 2: Foundational — Main Process IPC

**Purpose**: Implement and test the two new main-process functions and their IPC wiring before any renderer work begins.

**⚠️ CRITICAL**: Renderer tests mock `window.api`, so they can be written in parallel with this phase, but the real IPC must be complete before integration testing.

- [x] T002 [P] Write failing tests in `src/main/fs/photos.test.ts` under a new `describe('readPhotoFileMetadata')` block: (a) calls `exiftool.read()` with the resolved file path, (b) returns a `FileMetadataTag[]` where each entry has `group`, `key`, `label`, `value` (stringified), and `writable` fields, (c) File-system intrinsic tags (`FileSize`, `ImageWidth`, `ImageHeight`, `FileType`, `MIMEType`, `ExifToolVersion`, `FileName`, `Directory`, `FileModifyDate`, `FileAccessDate`, `FileInodeChangeDate`, `FilePermissions`) have `writable: false`, all other tags have `writable: true`, (d) tags with null/undefined value are excluded from the returned array, (e) throws on file-not-found

- [x] T003 [P] Write failing tests in `src/main/fs/photos.test.ts` under a new `describe('writePhotoFileMetadata')` block: (a) calls `exiftool.write()` with the resolved file path and the provided `Record<string, string>` tag map, (b) resolves `void` on success, (c) throws and logs on write error

- [x] T004 [P] Write failing tests in `src/main/ipc/photos.test.ts`: (a) `PHOTOS_READ_FILE_METADATA` handler calls `readPhotoFileMetadata(slug, fileName, sheltersRoot)` and returns the result, (b) `PHOTOS_WRITE_FILE_METADATA` handler calls `writePhotoFileMetadata(slug, fileName, sheltersRoot, tags)` and resolves

- [x] T005 Implement `readPhotoFileMetadata(slug, fileName, sheltersRoot): Promise<FileMetadataTag[]>` in `src/main/fs/photos.ts`: resolve file path via `photoFilePath`, call `exiftool.read(filePath)`, iterate all properties on the returned `Tags` object, skip null/undefined values, stringify each value (reusing the existing `getString` helper), determine `group` from the tag name using exiftool family-0 group prefixes (prefix-match against `GPS`, `XMP`, `IPTC`, `EXIF`, `File`, `Composite` — in that order to avoid `GPS` being swallowed by `EXIF`; default to `Other`), compute `label` by splitting the tag key on camelCase boundaries (e.g., `ExposureTime` → "Exposure Time", `GPSLatitude` → "GPS Latitude"), set `writable: false` for the static set of File-system intrinsic keys (`FileSize`, `ImageWidth`, `ImageHeight`, `FileType`, `FileTypeExtension`, `MIMEType`, `ExifToolVersion`, `FileName`, `Directory`, `FileModifyDate`, `FileAccessDate`, `FileInodeChangeDate`, `FilePermissions`, `EncodingProcess`, `BitsPerSample`, `ColorComponents`, `YCbCrSubSampling`) AND for the `Identifier` key (system-written DB id), return sorted array (by `group` then `key`)

- [x] T006 Implement `writePhotoFileMetadata(slug, fileName, sheltersRoot, tags: Record<string, string>): Promise<void>` in `src/main/fs/photos.ts`: resolve file path via `photoFilePath`, call `exiftool.write(filePath, tags)`, log success, throw and log on error

- [x] T007 Wire new IPC handlers in `src/main/ipc/photos.ts`: register `PHOTOS_READ_FILE_METADATA` → `readPhotoFileMetadata(slug, fileName, sheltersRoot)` and `PHOTOS_WRITE_FILE_METADATA` → `writePhotoFileMetadata(slug, fileName, sheltersRoot, tags)`; import both functions from `'../fs/photos'`

- [x] T008 Replace preload stubs: update `src/main/preload.ts` to wire `photos.readFileMetadata` → `ipcRenderer.invoke(CHANNELS.PHOTOS_READ_FILE_METADATA, { slug, fileName, sheltersRoot })` and `photos.writeFileMetadata` → `ipcRenderer.invoke(CHANNELS.PHOTOS_WRITE_FILE_METADATA, { slug, fileName, sheltersRoot, tags })`

**Checkpoint**: Main process functions implemented and tested. IPC channels wired. TypeScript compiles cleanly.

---

## Phase 3: User Story 1 — View Photo File Metadata (Priority: P1) 🎯 MVP

**Goal**: Dialog opens, fires async IPC to read all file tags, shows spinner while loading, renders complete tag list grouped by metadata standard, shows error + Retry on failure.

**Independent Test**: Select a photo, click the metadata icon button. After the spinner resolves (mock IPC), the dialog shows all tags with group headers and field labels. Dismiss and verify photo state unchanged.

### Tests for User Story 1 ⚠️

- [x] T009 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` (replace existing file): mock `window.api.photos.readFileMetadata = jest.fn()` in `beforeEach`; test: (a) dialog renders with `role="dialog"`, (b) loading spinner shown while IPC is in flight (mock returns a never-resolving promise), (c) after IPC resolves with `FileMetadataTag[]`, tag rows are rendered with label and value, (d) tags are visually grouped by `tag.group` (group header element contains the group name), (e) empty values (`null`) show "—", (f) on IPC rejection, an error message and a "Retry" button are rendered, (g) clicking "Retry" calls `readFileMetadata` a second time

- [x] T010 [P] [US1] Write failing tests in `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx` (add to existing describe blocks): (a) metadata icon button (`aria-label="View photo metadata"`) is present in `photo-detail-head` when a photo is selected, (b) button is absent when no photo is selected, (c) clicking the button opens a dialog (`role="dialog"`), (d) dialog receives `slug` prop matching the shelter slug

### Implementation for User Story 1

- [x] T011 [US1] Rewrite `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx` for the File Layer: update props interface to `{ photo: Photo; shelterId: number; slug: string; sheltersRoot: string; onClose: () => void }` (remove `useDispatch`); on mount call `window.api.photos.readFileMetadata(slug, photo.file_name, sheltersRoot)` and store result in `[tags, setTags]` state; show a centered spinner (`Loading…`) while in flight (`loading` state); on success render tags grouped by `tag.group` — each group rendered as a labelled section, each row showing `tag.label` and `tag.value ?? '—'`; on error render inline error message + Retry button that re-triggers the IPC call; retain `role="dialog" aria-modal="true"` overlay structure, `data-overlay="true"` on outer div, `data-field={tag.key}` on each row, close button (`aria-label="Close"`) and Escape handler; **do NOT render `include_in_post`** — it has no file-layer counterpart; **do NOT import or dispatch `updatePhotoLocal`** — the old Redux dependency must be removed entirely

- [x] T012 [US1] Update `src/renderer/components/MainPane/tabs/PhotosTab.tsx`: add `slug={s.slug}` and `sheltersRoot={sheltersRoot}` props to the `<PhotoMetadataDialog>` render at lines 851–855 (both values are already in scope)

- [x] T013 [P] [US1] Relabel "Import from File" → "Sync from File" in `src/renderer/components/MainPane/tabs/PhotosTab.tsx` (lines ~828–834): update button text, update `title` attribute to `"Copy file metadata values into the editorial record"`

- [x] T014 [P] [US1] Update `src/renderer/components/MainPane/tabs/PhotosTab.test.tsx` to assert: (a) "Sync from File" button is present with its tooltip text, (b) "Import from File" label is absent

**Checkpoint**: US1 independently verifiable — metadata dialog opens, shows spinner, displays all file tags grouped, shows error+retry on failure, "Sync from File" button correctly labelled.

---

## Phase 4: User Story 2 — Copy Metadata Field to Clipboard (Priority: P1)

**Goal**: Every tag row has a copy icon button. Clicking it writes the value to the clipboard and shows a 1.5-second checkmark confirmation.

**Independent Test**: Open the dialog (mocked IPC), click the copy icon next to a tag row with a value. `navigator.clipboard.writeText` called with that value. Icon changes to checkmark, reverts after 1.5 s.

### Tests for User Story 2 ⚠️

- [x] T015 [P] [US2] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` (new `describe` block): mock `navigator.clipboard.writeText = jest.fn().mockResolvedValue(undefined)`; test: (a) each rendered tag row has a button with `title="Copy"`, (b) clicking a copy button calls `navigator.clipboard.writeText` with `tag.value`, (c) after click the button shows `title="Copied"`, (d) after ~1.5 s (use `jest.useFakeTimers`) the button reverts to `title="Copy"`, (e) clicking a copy button for a tag with `value: null` calls `writeText('')`

### Implementation for User Story 2

- [x] T016 [US2] Add copy buttons to each tag row in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: `[copiedKey, setCopiedKey]` state (tag key string or null); `handleCopy(key, value)` calls `navigator.clipboard.writeText(value ?? '').then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 1500); }).catch(() => {})`; each row renders a `<button title={copiedKey === tag.key ? 'Copied' : 'Copy'}>` with checkmark SVG when copied, copy SVG otherwise

**Checkpoint**: US1 + US2 independently verifiable.

---

## Phase 5: User Story 3 — Edit Metadata Fields and Save to File (Priority: P1)

**Goal**: Edit button switches writable tags to inputs. Save calls `writeFileMetadata` IPC with only the changed tags. Non-writable tags stay as plain text. No Redux dispatch. No `photos.update` call.

**Independent Test**: Open dialog, click Edit, change a writable tag value, click Save. Verify `writeFileMetadata` IPC called with the changed key/value pair, dialog closes, `updatePhotoLocal` NOT dispatched.

### Tests for User Story 3 ⚠️

- [x] T017 [P] [US3] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` (new `describe` block): mock `window.api.photos.writeFileMetadata = jest.fn().mockResolvedValue(undefined)`; test: (a) "Edit" button present in view mode after tags load, (b) clicking Edit shows "Save" and "Cancel" buttons and replaces read-only values with `<input>` or `<textarea>` for `writable: true` tags, (c) `writable: false` tags remain as `<span>` plain text in edit mode, (d) clicking Save calls `writeFileMetadata(slug, fileName, sheltersRoot, changedTagsMap)` with only the tags whose values changed (a tag is "changed" only when its draft value differs from the loaded value), (e) Save closes dialog (`onClose` called), (f) no `updatePhotoLocal` action dispatched during Save, (g) no `window.api.photos.update` called during Save, (h) if `writeFileMetadata` rejects, an inline error is shown and `onClose` is NOT called, (i) clicking Cancel closes dialog without calling `writeFileMetadata`

### Implementation for User Story 3

- [x] T018 [US3] Add edit mode to `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: `[editMode, setEditMode]` state; `[draft, setDraft]` state initialised from loaded `tags` (map of `key → value`); Edit button sets `editMode: true`; in edit mode, `writable: true` tags render as `<input type="text">`; Save handler diffs `draft` against original loaded tag values (string equality), calls `window.api.photos.writeFileMetadata(slug, photo.file_name, sheltersRoot, changedEntries)` with only the diffed entries, on success calls `onClose()`, on rejection sets `writeError` state and shows inline error; Cancel calls `onClose()` directly

**Checkpoint**: US1 + US2 + US3 independently verifiable.

---

## Phase 6: User Story 4 — Cancel / Dismiss Without Editing (Priority: P2)

**Goal**: Escape, click-outside, and close button all dismiss the dialog with no file write. Focus is trapped while open.

**Independent Test**: Open the dialog in view mode. Press Escape. Dialog is gone. `writeFileMetadata` not called.

### Tests for User Story 4 ⚠️

- [x] T019 [P] [US4] Write failing tests in `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.test.tsx` (new `describe` block): test: (a) pressing Escape calls `onClose`, (b) clicking the overlay backdrop (element with `data-overlay`) calls `onClose`, (c) clicking the close button (`aria-label="Close"`) calls `onClose`, (d) clicking inside the dialog body (`role="dialog"`) does NOT call `onClose`, (e) pressing Escape in edit mode calls `onClose` without calling `writeFileMetadata`, (f) Tab key traps focus within the dialog (no error thrown, dialog remains mounted), (g) Shift+Tab traps focus backward within the dialog

### Implementation for User Story 4

- [x] T020 [US4] Add dismissal and focus trap to `src/renderer/components/MainPane/tabs/PhotoMetadataDialog.tsx`: `useEffect` registering `keydown` listener on `document` for Escape → `onClose()`; overlay `onClick` that calls `onClose()` only when `e.target === e.currentTarget`; `aria-label="Close"` close button (✕) in dialog header; Tab trap via `onKeyDown` on the dialog `div`: query `FOCUSABLE_SEL` elements, wrap Tab to first on last element, wrap Shift+Tab to last on first element, call `e.preventDefault()` in both cases

**Checkpoint**: All 4 user stories independently verifiable.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T021 [P] Run renderer test suite and confirm all tests pass: `npx jest --testPathPattern="PhotoMetadataDialog|PhotosTab" --no-coverage`

- [x] T022 [P] Run main process test suite and confirm all tests pass: `npx jest --testPathPattern="photos" --no-coverage --selectProjects main`

- [x] T023 Verify `aria-label="View photo metadata"` on the metadata icon button in `src/renderer/components/MainPane/tabs/PhotosTab.tsx` and that no stale `updatePhotoLocal` import remains in `PhotoMetadataDialog.tsx`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on T001. T002/T003/T004 [P] can be written in parallel (different files). T005/T006 must follow their respective failing tests. T007 depends on T005+T006. T008 depends on T007.
- **US1 (Phase 3)**: T009/T010/T013/T014 [P] can be written once T001 is done (renderer tests mock `window.api`). T011 depends on T009. T012 depends on T011. T013/T014 are independent of T011 (PhotosTab only).
- **US2 (Phase 4)**: T015 can be written in parallel with T011 (same file, separate describe block). T016 depends on T015.
- **US3 (Phase 5)**: T017 can be written after T011 scaffolds the dialog. T018 depends on T017.
- **US4 (Phase 6)**: T019 can be written after T011 scaffolds the dialog. T020 depends on T019.
- **Polish (Phase 7)**: Depends on all user stories complete.

### User Story Dependencies

- US2, US3, US4 all extend `PhotoMetadataDialog.tsx`; they must be worked sequentially on that file.
- `PhotosTab.tsx` changes (T012, T013, T014) are isolated and can land any time after T001.
- Main process work (Phase 2) is independent of renderer work; both can proceed after T001.

### Within Each User Story

- Tests MUST be written and confirmed failing before implementation begins.
- US3 `draft` state must be initialised from the loaded `tags` array (not from the Redux `photo` prop) so edits are sandboxed until Save.

### Parallel Opportunities

- T002, T003, T004 can be written in parallel (different test describe blocks and files).
- T009, T010, T013, T014 can be written in parallel with T005–T008 (renderer tests mock IPC).
- T015 can be written in parallel with T011 implementation.
- T017 and T019 can be written in parallel (different describe blocks, both depend on T011 dialog scaffold).
- T021 and T022 can run in parallel (different test projects).

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete T001 (types).
2. Write T002/T003/T004 (main process failing tests) in parallel.
3. Implement T005/T006/T007/T008 (main process impl + IPC wiring).
4. Write T009/T010/T013/T014 (renderer failing tests) in parallel.
5. Implement T011/T012/T013/T014 (dialog rewrite + PhotosTab updates).
6. Verify all US1 tests pass.

### Incremental Delivery

1. Setup + Foundational (T001–T008)
2. US1 (T009–T012) — view file metadata with loading/error states
3. US2 (T013–T014) — clipboard copy
4. US3 (T015–T016) — edit and save to file
5. US4 (T017–T018) — full dismissal and focus trap
6. Polish (T019–T023)

### Parallel Team Strategy

One contributor can work the main process (Phase 2) while another writes renderer tests (T009/T010) and then implements the dialog shell (T011), since Phase 2 and the renderer tests both start from T001 with no further dependency.

---

## Notes

- `[P]` tasks = different files or isolated concerns, safe to parallelize.
- `PhotoMetadataDialog.tsx` is completely rewritten — the old `updatePhotoLocal` dispatch and Redux dependency are removed.
- No IPC call from the old implementation (`readMetadata` for "Sync from File") is changed; only new channels are added.
- The `include_in_post` field is NOT shown in this dialog — it has no file-layer counterpart.
- Total tasks: **23** across 7 phases.
- Setup (1) + Foundational (7) + US1 (6) + US2 (2) + US3 (2) + US4 (2) + Polish (3).
