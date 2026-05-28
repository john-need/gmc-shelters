# Tasks: Publish to Google Drive

**Input**: Design documents from `specs/009-publish-gdrive/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓  
**Tests**: TDD — all tests written and confirmed failing BEFORE implementation begins.  
**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the `googleapis` dependency, extend shared types, create the publish module skeleton, and wire stubs so TypeScript compiles before any logic is written.

- [X] T001 Install `googleapis` npm package: `npm install googleapis` (updates package.json and package-lock.json)
- [X] T002 Add `PUBLISH_TO_WEB = 'publish:toWeb'` and `PUBLISH_TEST_CONNECTION = 'publish:testConnection'` to `CHANNELS` in `src/shared/ipc-types.ts`
- [X] T003 Add `PublishToWebInput`, `PublishResult`, and `ConnectionTestResult` interfaces to `src/shared/ipc-types.ts` (shapes defined in data-model.md); add `publish` namespace to `ElectronAPI` interface with `toWeb` and `testConnection` methods
- [X] T004 Add `driveFileId?: string | null` field to `PhotoEntry` interface in `src/main/export/builder.ts` and initialize it to `null` in the `photoEntries.push({...})` call in `buildManifest()`
- [X] T005 [P] Create empty skeleton files `src/main/publish/gdrive.ts` and `src/main/publish/index.ts` with placeholder exports so TypeScript does not error on imports
- [X] T006 [P] Add `publish: { toWeb: noop, testConnection: noop }` to `noopApi` in `src/renderer/hooks/useIpc.ts`
- [X] T007 [P] Add `publish: { toWeb: jest.fn().mockResolvedValue(null), testConnection: jest.fn().mockResolvedValue(null) }` to `mockApi` in `src/renderer/setupTests.ts`
- [X] T008 [P] Add `publish.toWeb` and `publish.testConnection` to `src/main/preload.ts` invoking the new IPC channels

**Checkpoint**: `npx tsc --noEmit` passes (or error count does not increase). All existing tests still pass.

---

## Phase 2: Foundational (Google Drive Client)

**Purpose**: Implement the `GDriveClient` — auth, file listing, upload, in-place update, JSON download, and folder creation. This is a blocking prerequisite for all three user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for GDriveClient ⚠️

- [X] T009 Write failing unit tests for `GDriveClient` in `src/main/publish/gdrive.test.ts` covering: `authenticate()` returns an `OAuth2Client`; `listFolder(folderId)` returns `Map<string,string>`; `downloadJson(fileId)` returns parsed object; `uploadFile(...)` calls `drive.files.create` and returns a Drive file ID; `updateFile(fileId, ...)` calls `drive.files.update` with the existing fileId; `createFolder(slug, parentId)` calls `drive.files.create` with folder mimeType; `testConnection(rootFolderId)` returns `{ ok: true, message }` on success and `{ ok: false, message }` on error. Mock `googleapis` with `jest.mock('googleapis')`.
- [X] T010 [P] Write failing unit tests for token load/save in `src/main/publish/gdrive.test.ts`: cached token file exists → no browser flow triggered; no token file → `shell.openExternal` called with auth URL; expired token → `oauth2Client.refreshAccessToken` called without browser.

### Implementation for GDriveClient

- [X] T011 Implement `GDriveClient` class in `src/main/publish/gdrive.ts` with: `constructor(credentialsPath, tokenPath, scopes)`; `authenticate(): Promise<OAuth2Client>` (load credentials.json, load/refresh/acquire token via loopback `http.createServer` + `shell.openExternal`); private `_buildDriveService(auth)` returning a Drive v3 instance
- [X] T012 Implement `GDriveClient.listFolder(folderId): Promise<Map<string,string>>` in `src/main/publish/gdrive.ts` using `drive.files.list({ q: "'folderId' in parents and trashed=false", fields: 'files(id,name)', pageSize: 1000 })`
- [X] T013 [P] Implement `GDriveClient.downloadJson(fileId): Promise<unknown>` in `src/main/publish/gdrive.ts` using `drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })` then `JSON.parse`
- [X] T014 [P] Implement `GDriveClient.uploadFile(localPath, name, folderId, mimeType): Promise<string>` in `src/main/publish/gdrive.ts` using `drive.files.create` with `fs.createReadStream`; returns new Drive file ID
- [X] T015 [P] Implement `GDriveClient.updateFile(fileId, localPath, mimeType): Promise<void>` in `src/main/publish/gdrive.ts` using `drive.files.update({ fileId, requestBody: {}, media: { mimeType, body: fs.createReadStream(localPath) } })` — preserves fileId and share link
- [X] T016 [P] Implement `GDriveClient.createFolder(name, parentId): Promise<string>` and `GDriveClient.testConnection(rootFolderId): Promise<ConnectionTestResult>` in `src/main/publish/gdrive.ts`
- [X] T017 Create `src/main/ipc/publish.ts` with `registerPublishHandlers()` skeleton (empty handlers, no logic yet) and register it in `src/main/index.ts`

**Checkpoint**: All `gdrive.test.ts` tests pass. TypeScript compiles cleanly.

---

## Phase 3: User Story 1 — One-Click Publish: Build and Deploy (Priority: P1) 🎯 MVP

**Goal**: Clicking "Publish to web" builds the dist package, fetches the prior Drive manifest as a baseline, uploads or in-place-updates only photos whose `updated` timestamp is newer (or absent in prior), carries forward `driveFileId` for unchanged photos, and writes the updated manifest to Drive in-place.

**Independent Test**: With googleapis mocked, call `runPublish(config, repoRoot)` and assert: `buildManifest` is called once; photos with newer `updated` call `drive.files.update` or `drive.files.create`; photos with same `updated` call neither; the final manifest passed to Drive contains correct `driveFileId` values; `PublishResult` counts are correct.

### Tests for User Story 1 ⚠️

- [X] T018 [US1] Write failing unit tests for `runPublish()` in `src/main/publish/index.test.ts`: mock `buildManifest` (returns fixture manifest) and `GDriveClient`; test the full photo diff loop — newer `updated` with existing `driveFileId` calls `updateFile`; newer `updated` without `driveFileId` calls `uploadFile`; same `updated` calls neither and carries forward `driveFileId`; missing prior manifest triggers full upload for all photos; missing local photo file increments `photosMissing` and does not call Drive
- [X] T019 [P] [US1] Write failing unit tests for the `PUBLISH_TO_WEB` IPC handler in `src/main/ipc/publish.test.ts`: second invocation while first is running returns `{ error: 'ALREADY_RUNNING' }`; blank `rootFolderId` returns `{ error: 'CONFIG_INVALID' }` before any build starts; missing credentials file returns `{ error: 'NO_CREDENTIALS' }` before build; success path returns a `PublishResult`
- [X] T020 [P] [US1] Write failing tests for the manifest in-place write in `src/main/publish/index.test.ts`: existing Drive manifest found → `updateFile` called with manifest fileId; no existing Drive manifest → `uploadFile` called for manifest

### Implementation for User Story 1

- [X] T021 [US1] Implement `runPublish(config: PublishToWebInput, repoRoot: string): Promise<PublishResult>` in `src/main/publish/index.ts`: (1) build to `.publish-tmp/` via `buildManifest(repoRoot, tmpDir)`; (2) instantiate `GDriveClient` and authenticate; (3) attempt to fetch prior Drive manifest via `listFolder(rootFolderId)` + `downloadJson`; (4) for each photo in manifest apply upload-decision logic from data-model.md state machine; (5) write updated manifest locally then upload/update to Drive; (6) clean up `.publish-tmp/`; (7) return `PublishResult`
- [X] T022 [US1] Implement `PUBLISH_TO_WEB` handler in `src/main/ipc/publish.ts`: concurrency guard (`isPublishing` flag); config validation (blank `rootFolderId` → `CONFIG_INVALID`; missing credentials file → `NO_CREDENTIALS`); calls `runPublish`; clears `isPublishing` in finally block
- [X] T023 [US1] Update `src/renderer/components/AppShell/AppHeader.tsx`: `handlePublish` calls `window.api.publish.toWeb({ rootFolderId, manifestName, scopes })` reading from `loadStoredPublishing()` (analogous to `loadStoredPaths()`); button disabled while publishing; result summary shown via `showToast` or inline result panel; handle `ALREADY_RUNNING` and `CONFIG_INVALID` error codes

**Checkpoint**: With googleapis mocked, all `index.test.ts` and `publish.test.ts` US1 tests pass. Manually: clicking "Publish to web" triggers build and shows a result summary (Drive calls mocked or real).

---

## Phase 4: User Story 2 — Google Drive Authentication Setup (Priority: P2)

**Goal**: "Test connection" in Settings › Publishing performs a live Drive API call and displays a success or failure status. First-time auth opens a browser consent flow; subsequent calls use the cached token silently.

**Independent Test**: With googleapis mocked, call the `PUBLISH_TEST_CONNECTION` handler with a valid `rootFolderId` and assert `ConnectionTestResult.ok === true` with a message containing the folder name. Call with an invalid ID and assert `ok === false` with a descriptive message. Call with missing credentials and assert `ok === false` with a "credentials not found" message.

### Tests for User Story 2 ⚠️

- [X] T024 [US2] Write failing unit tests for `PUBLISH_TEST_CONNECTION` in `src/main/ipc/publish.test.ts`: valid config + reachable folder → `{ ok: true, message: 'Connected — folder: ...' }`; unreachable folder → `{ ok: false, message: '...' }`; missing credentials.json → `{ ok: false, message: 'credentials.json not found at ...' }`; expired token silently refreshed → `ok: true`

### Implementation for User Story 2

- [X] T025 [US2] Implement `PUBLISH_TEST_CONNECTION` handler in `src/main/ipc/publish.ts`: instantiate `GDriveClient`; call `testConnection(rootFolderId)`; return `ConnectionTestResult`; handle missing credentials.json before instantiation
- [X] T026 [P] [US2] Update `src/renderer/components/Settings/PublishingPage.tsx` "Test connection" button: call `window.api.publish.testConnection({ rootFolderId, scopes })`; show persistent inline status (`✓ Connected — folder: ...` or `✗ error message`) below the button; button shows loading state while request is in flight

**Checkpoint**: All `publish.test.ts` US2 tests pass. In the app: "Test connection" button shows a live status line; first run opens browser consent (real Drive) or returns mocked result.

---

## Phase 5: User Story 3 — Publishing Config Wired to Deploy (Priority: P3)

**Goal**: The deploy operation reads ROOT_FOLDER_ID, MANIFEST_NAME, and SCOPES exclusively from Publishing settings. Blank ROOT_FOLDER_ID or blank DIST_PATH blocks publish with a clear config error before any build starts.

**Independent Test**: Change ROOT_FOLDER_ID in PublishingPage, save, click Publish — assert IPC payload contains the new ROOT_FOLDER_ID. Submit a Publish with blank ROOT_FOLDER_ID and assert `CONFIG_INVALID` error is shown before build runs.

### Tests for User Story 3 ⚠️

- [X] T027 [US3] Write failing unit tests for config-validation edge cases in `src/main/ipc/publish.test.ts`: blank `rootFolderId` in payload → `CONFIG_INVALID` returned before `buildManifest` is called; blank `manifestName` → defaults to `'shelter-manifest.json'` (no error); `scopes` array empty → `CONFIG_INVALID`

### Implementation for User Story 3

- [X] T028 [US3] Add `loadStoredPublishing()` helper to `src/renderer/pathSettings.ts` (or a new `src/renderer/publishSettings.ts`) that reads `gmc.publishing` from localStorage and returns `{ rootFolderId, manifestName, scopes }`
- [X] T029 [US3] Update `src/renderer/components/AppShell/AppHeader.tsx` to read Publishing config via `loadStoredPublishing()` and pass it as the `PublishToWebInput` payload; show inline "Publishing not configured — open Settings › Publishing" message when ROOT_FOLDER_ID is blank, without hitting IPC

**Checkpoint**: All US3 tests pass. Config changes in settings take effect on next publish click without app restart.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contract test, cleanup, and operator verification.

- [X] T030 [P] Write a contract test in `src/main/export/builder.test.ts` (or a new `tests/contract/` file) that asserts the manifest output conforms to the JSON Schema in `specs/009-publish-gdrive/contracts/manifest-schema.json` — validate that `driveFileId` field is present (nullable) on each photo entry
- [X] T031 [P] Run full Jest test suite (`npm test`) and resolve any TypeScript errors introduced by the new `publish` namespace additions to `ElectronAPI`
- [X] T032 Update `specs/009-publish-gdrive/checklists/requirements.md` to mark all items complete and confirm operator quickstart steps are accurate against the implemented code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; start immediately.
- **Foundational (Phase 2)**: Depends on Phase 1 (types must exist before gdrive.ts can import them). Blocks all user stories.
- **US1 (Phase 3)**: Depends on Phase 2 (`GDriveClient` must be implemented). This is the MVP.
- **US2 (Phase 4)**: Depends on Phase 2 (`GDriveClient.testConnection` must exist). Independent of US1.
- **US3 (Phase 5)**: Depends on Phase 3 (publish handler must exist to test config validation). Refines US1's behaviour.
- **Polish (Phase 6)**: Depends on all user stories being complete.

### User Story Dependencies

- US1 and US2 can be developed in parallel after Phase 2 — they touch different files (`publish/index.ts` vs `ipc/publish.ts` PUBLISH_TEST_CONNECTION + `PublishingPage.tsx`).
- US3 refines US1's IPC handler and renderer; complete US1 first.

### Within Each User Story

- Tests MUST be written and observed failing before implementation begins.
- `GDriveClient` methods must precede `runPublish` orchestration.
- Preload and renderer wiring must follow IPC handler implementation.

### Parallel Opportunities

- T005, T006, T007, T008 (Phase 1): all target different files — fully parallel.
- T009, T010 (Phase 2 tests): different test concerns in the same file — write sequentially.
- T013, T014, T015, T016 (Phase 2 impl): each a different `GDriveClient` method — parallel.
- T019, T020 (Phase 3 tests): different test files — parallel.
- T025, T026 (Phase 4 impl): different files (main vs renderer) — parallel after T024.
- T030, T031 (Phase 6): different concerns — parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (GDriveClient + tests).
3. Complete Phase 3 (US1: full publish flow + tests + AppHeader wiring).
4. Validate US1 independently — publish a real archive to Drive, verify result summary and Drive state.

### Incremental Delivery

1. Phase 1 + 2: Foundation and Drive client.
2. Phase 3 (US1): Full publish flow — core value delivered.
3. Phase 4 (US2): Test connection UX — operator confidence.
4. Phase 5 (US3): Config validation — error prevention.
5. Phase 6: Contract test, cleanup.

### Parallel Opportunities After Phase 2

- US1 (Phase 3) and US2 (Phase 4) can be developed simultaneously by different contributors.
- US3 (Phase 5) should follow US1 since it refines the same IPC handler.

---

## Notes

- `[P]` tasks target different files and have no intra-phase dependencies.
- `googleapis` is pure JavaScript — no `electron-rebuild` needed.
- Token and credentials paths use `app.getPath('userData')` — never `app.getAppPath()`.
- The manifest is always written in-place on Drive (`files.update` with existing fileId) to preserve share links; only first publish uses `files.create`.
- `driveFileId` in `PhotoEntry` is nullable — null until first publish, same value after any in-place update.
