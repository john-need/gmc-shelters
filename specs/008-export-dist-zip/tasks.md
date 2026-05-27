# Tasks: Export Dist Zip

**Input**: Design documents from `specs/008-export-dist-zip/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/zip-layout.md ✅
**Tests**: TDD — write failing tests and confirm they fail BEFORE implementation in each phase.
**Organization**: Tasks grouped by user story; tests precede implementation within every phase.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on in-progress tasks)
- **[Story]**: User story this task belongs to (US1, US2, US3)
- Exact file paths in every description

## Path Conventions

- New TypeScript modules: `src/main/export/`
- New IPC handler: `src/main/ipc/export.ts`
- Shared types: `src/shared/ipc-types.ts`
- Tests follow existing pattern: `jest.mock('./connection')` + in-memory SQLite (see `src/main/db/shelters.test.ts`)
- Electron mock already at `src/main/__mocks__/electron.ts`

---

## Phase 1: Setup

**Purpose**: Install dependency, create scaffolding, wire `.gitignore`.

- [x] T001 Install `archiver` and `@types/archiver` — run `npm install archiver` and `npm install --save-dev @types/archiver` from repo root; verify entries appear in `package.json`
- [x] T002 [P] Add `.export-tmp/` line to `.gitignore`
- [x] T003 [P] Create empty stub files: `src/main/export/builder.ts`, `src/main/export/builder.test.ts`, `src/main/export/zipper.ts`, `src/main/export/zipper.test.ts`, `src/main/export/index.ts`, `src/main/export/index.test.ts`
- [x] T004 [P] Create empty stub files: `src/main/ipc/export.ts`, `src/main/ipc/export.test.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared IPC type definitions required by all phases.

**⚠️ CRITICAL**: All user story implementation depends on these types being defined first.

- [x] T005 Add `EXPORT_BUILD: 'export:build'` to the `CHANNELS` const in `src/shared/ipc-types.ts`
- [x] T006 [P] Add `ExportResult` interface to `src/shared/ipc-types.ts`:
  `{ cancelled: boolean; savedTo: string | null; shelterCount: number; photoCount: number; skippedPhotos: number }`
- [x] T007 [P] Add `export: { build: () => Promise<ExportResult> }` to the `ElectronAPI` interface in `src/shared/ipc-types.ts`

**Checkpoint**: Types defined; all downstream compilation targets can now reference them.

---

## Phase 3: User Story 3 — Export Package Contents (Priority: P1)

**Goal**: `buildManifest()` assembles a structurally correct manifest from the DB, adds
`historyFile` / `historyUpdated` per shelter, preserves `photo.updated`, filters shelters by
`show_on_web`, filters photos by `include_in_post` + file-exists, strips markdown for `content`.
`createZip()` archives the temp directory into a valid zip.

**Independent Test**: Given a seeded in-memory DB with one shelter, two photos (one with
`include_in_post=1`, one without), and a temp `{slug}.md` on disk: `buildManifest()` returns
exactly one shelter entry with `historyFile = "{slug}/{slug}.md"`, `historyUpdated` non-null,
one photo entry with `updated` set, and `content` as plain text. `createZip()` produces a zip
containing `shelter-manifest.json` at root and the photo file under `{slug}/`.

### Tests for User Story 3 ⚠️

- [x] T008 [US3] Write failing tests for `stripMarkdown()` in `src/main/export/builder.test.ts` — cover: heading removal (`### Title` → `Title` or empty), bold/italic stripping (`**bold**` → `bold`), bullet list stripping (`- item` → `item`), link text extraction (`[text](url)` → `text`), inline citation removal (`[GB 9th Edition]` → empty), plain text passthrough
- [x] T009 [P] [US3] Write failing tests for `buildManifest()` in `src/main/export/builder.test.ts` using `jest.mock('../db/connection')` + in-memory SQLite (follow pattern in `src/main/db/shelters.test.ts`):
  - Shelter with `show_on_web=0` is excluded from output
  - Shelter with `show_on_web=1` appears in output with camelCase fields
  - Photo with `include_in_post=1` and file on disk → included in `photos[]` with `updated` field
  - Photo with `include_in_post=0` → excluded even if file exists
  - Photo with `include_in_post=1` but file absent → skipped, `skippedPhotos` count incremented
  - History file present → `historyFile = "{slug}/{slug}.md"`, `historyUpdated` = ISO 8601 string
  - History file absent → `historyFile = null`, `historyUpdated = null`
  - `photo.updated` field is present and equals the DB `updated` value
  - `shelter.updated` field is present and equals the DB `updated` value
  - Map markers sourced from `map_markers` table (not `timelines`)
  - Manifest top-level has `created` ISO 8601 timestamp
- [x] T010 [P] [US3] Write failing tests for `createZip()` in `src/main/export/zipper.test.ts` — use real `os.tmpdir()` directories:
  - Zip file is created at the specified destination path
  - Zip contains `shelter-manifest.json` at archive root
  - Zip contains a file under `{slug}/` when a per-slug directory exists in source
  - Resolves promise on success; rejects on unreadable source

### Implementation for User Story 3

- [x] T011 [US3] Implement `stripMarkdown(md: string): string` in `src/main/export/builder.ts` — regex patterns per research.md Decision 2; confirm T008 tests pass
- [x] T012 [US3] Implement `buildManifest(repoRoot: string, tmpDir: string): Promise<BuildResult>` in `src/main/export/builder.ts`:
  - `BuildResult = { manifest: ManifestJson; shelterCount: number; photoCount: number; skippedPhotos: number }`
  - DB queries from `data-model.md` (shelters JOIN architectures/categories/builders; photos WHERE include_in_post=1; map_markers)
  - `fs.stat()` for `historyFile` / `historyUpdated`; null if ENOENT
  - `fs.existsSync()` for each photo; skip and count if absent
  - Denormalise `slug` and `defaultPhotoId` from the parent shelter row into each assembled `MapMarkerEntry`
  - Copy present photos and `{slug}.md` files into `tmpDir/{slug}/`
  - Write `shelter-manifest.json` to `tmpDir/`
  - Confirm T009 tests pass
- [x] T013 [P] [US3] Implement `createZip(srcDir: string, destPath: string): Promise<void>` in `src/main/export/zipper.ts` using `archiver` (streaming, `archiver.create('zip')`, pipe to `fs.createWriteStream`); confirm T010 tests pass

**Checkpoint**: `builder.test.ts` and `zipper.test.ts` all green. Manifest content is structurally correct per contract.

---

## Phase 4: User Story 1 — Export Shelter Data Package (Priority: P1) 🎯 MVP

**Goal**: Clicking Export builds the package, zips it, prompts for a folder, saves the dated zip,
shows a success toast with the filename, and re-enables the button.

**Independent Test**: Click Export in the running app; a folder picker appears after the build
completes; selecting a folder results in `gmc-shelters-export-YYYYMMDD.zip` written there; the
success toast names the file and path; the button is re-enabled.

### Tests for User Story 1 ⚠️

- [x] T014 [US1] Write failing tests for `runExport()` in `src/main/export/index.test.ts` — mock `builder`, `zipper`, `dialog.showOpenDialog`, `fs.copyFile`:
  - Success path: builder called → zipper called → dialog called → zip copied to `{destFolder}/{filename}` → `ExportResult` with `cancelled=false` and `savedTo` set
  - Cancel path: dialog returns `cancelled=true` → `ExportResult` with `cancelled=true`, `savedTo=null`, no file written
  - Filename includes today's UTC date in `YYYYMMDD` format
  - Temp dir cleaned up after success
- [x] T015 [P] [US1] Write failing test for `registerExportHandlers()` in `src/main/ipc/export.test.ts` — confirm `ipcMain.handle` registered for `CHANNELS.EXPORT_BUILD`; mock `runExport` and verify it is called

### Implementation for User Story 1

- [x] T016 [US1] Implement `runExport(repoRoot: string, senderWindow: BrowserWindow): Promise<ExportResult>` in `src/main/export/index.ts`:
  - Clean and create `.export-tmp/`
  - Call `buildManifest(repoRoot, tmpDir)` from `builder.ts`
  - Call `createZip(tmpDir, zipTempPath)` from `zipper.ts`
  - Call `dialog.showOpenDialog(senderWindow, { properties: ['openDirectory'] })`
  - If cancelled: cleanup and return `{ cancelled: true, savedTo: null, ... }`
  - Derive filename `gmc-shelters-export-YYYYMMDD.zip` using UTC date
  - Copy zip to `{pickedFolder}/{filename}`
  - Cleanup `.export-tmp/` and temp zip
  - Return `ExportResult`; confirm T014 tests pass
- [x] T017 [US1] Implement `registerExportHandlers()` in `src/main/ipc/export.ts` — `ipcMain.handle(CHANNELS.EXPORT_BUILD, (event) => runExport(app.getAppPath(), getSenderWindow(event.sender)))`; confirm T015 test passes
- [x] T018 [P] [US1] Add `export: { build: () => ipcRenderer.invoke(CHANNELS.EXPORT_BUILD) }` to the `api` object in `src/main/preload.ts`
- [x] T019 [US1] Import and call `registerExportHandlers()` in `src/main/index.ts` alongside the other `register*Handlers()` calls
- [x] T020 [US1] Wire Export button in `src/renderer/components/AppShell/AppHeader.tsx`:
  - Add `const [exporting, setExporting] = useState(false)`
  - Replace stub `handleExport` with async handler: `setExporting(true)` → `showToast('Building export…')` → `const result = await window.api.export.build()` → on `result.cancelled`: clear toast; on success: `showToast(\`Saved \${result.savedTo} (\${result.skippedPhotos} photos skipped)\`)` → `setExporting(false)`
  - Set `disabled={exporting}` on the Export button

**Checkpoint**: Full export flow works end-to-end in the running app. T014 and T015 tests green.

---

## Phase 5: User Story 2 — Export Failure Feedback (Priority: P2)

**Goal**: Any failure during build, zip, or save shows an error toast with the failure reason
and re-enables the Export button. No partial files remain at the destination.

**Independent Test**: With an invalid DB path configured, click Export; an error toast appears
with a meaningful message; the Export button re-enables; no files are left in `.export-tmp/`.

### Tests for User Story 2 ⚠️

- [x] T021 [US2] Add failing error-path tests to `src/main/export/index.test.ts`:
  - Builder throws → cleanup called → `runExport` rejects with error message
  - Zipper throws → cleanup called → `runExport` rejects with error message
  - `fs.copyFile` throws (e.g. read-only dest) → cleanup called → `runExport` rejects
  - `.export-tmp/` is absent after any error path (cleanup confirmed)

### Implementation for User Story 2

- [x] T022 [US2] Wrap the entire pipeline in `src/main/export/index.ts` in try/catch — on any error: call cleanup helper, rethrow; confirm T021 tests pass
- [x] T023 [US2] Update `handleExport` in `src/renderer/components/AppShell/AppHeader.tsx` to catch IPC errors: `catch (err) { dispatch(showToast({ ..., message: \`Export failed: \${err.message}\` })) }` followed by `setExporting(false)` in a `finally` block

**Checkpoint**: All three user stories independently functional. All Jest tests green.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T024 [P] Run full Jest suite (`npm test`) and confirm zero failures; fix any TypeScript type errors surfaced during compilation
- [x] T025 [P] Update `scripts/README.md` — add note that the in-app Export button supersedes `build_dist_package.py` + manual zip; reference `specs/008-export-dist-zip/quickstart.md` for operator steps
- [x] T026 [P] Add a code comment in `src/main/export/builder.ts` noting that it queries `map_markers` (not `timelines`) because the `timelines` table was removed in migration 004; cross-reference tech-debt in `scripts/build_dist_package.py`
- [ ] T027 Manual smoke test: start app (`npm start`), click Export, pick Downloads folder, unzip result, verify `shelter-manifest.json` at root; spot-check one shelter dir for history file and photos

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T002–T004 run in parallel after T001.
- **Foundational (Phase 2)**: Depends on Phase 1. T006–T007 run in parallel with T005 (same file, sequential commits).
- **US3 — Builder (Phase 3)**: Depends on Phase 2. Test tasks T008–T010 run in parallel; T011–T013 run after their respective test tasks.
- **US1 — Flow (Phase 4)**: Depends on T012 (builder) and T013 (zipper). T014–T015 can be written in parallel. T016 depends on T012+T013. T018–T019 parallel with T016. T020 depends on T018–T019.
- **US2 — Errors (Phase 5)**: T021 can be written immediately after T014 (adds to same test file). T022 depends on T016. T023 depends on T020.
- **Polish (Phase 6)**: Depends on all prior phases complete.

### User Story Dependencies

- US3 (builder correctness) is foundational to US1 and US2 — must be complete first.
- US1 (full flow) depends on US3 builder and zipper being implemented.
- US2 (error paths) adds to the orchestrator and UI established in US1.

### Parallel Opportunities

| Group | Parallel tasks |
|---|---|
| Phase 1 after T001 | T002, T003, T004 |
| Phase 3 tests | T008, T009, T010 |
| Phase 3 impl | T011 and T013 (different files, after their tests) |
| Phase 4 tests | T014, T015 |
| Phase 4 impl | T018, T019 (after T017) |
| Phase 6 | T024, T025, T026 |

---

## Implementation Strategy

### MVP First (US3 + US1 only)

1. Complete Phase 1 (Setup) and Phase 2 (Types).
2. Complete Phase 3 (US3) — builder + zipper with passing tests.
3. Complete Phase 4 (US1) — full end-to-end flow with passing tests.
4. Validate manually (T027).
5. Add error paths (US2 / Phase 5) before shipping.

### Incremental Delivery

1. Phase 1 + 2: scaffolding and types (~30 min)
2. Phase 3 TDD: builder tests red → green → zipper tests red → green (~2 h)
3. Phase 4 TDD: orchestrator tests red → green → IPC + UI wired (~1.5 h)
4. Phase 5 TDD: error path tests red → green (~30 min)
5. Phase 6: polish + smoke test (~30 min)

---

## Notes

- `[P]` tasks target different files and have no in-progress dependencies.
- TDD: observe failing test output before writing implementation code.
- `better-sqlite3` is synchronous — use it directly (no `await`) in `builder.ts` DB queries.
- `archiver` callbacks are used via `pipe` to a `WriteStream`; wrap in a `Promise` in `zipper.ts`.
- The `.export-tmp/` directory must be cleaned before build start AND after every outcome (success, cancel, error) to prevent stale state between runs.
- `timelines` table does not exist in current schema — `builder.ts` must query `map_markers`.
