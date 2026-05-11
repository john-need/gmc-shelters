# Tasks: Google Drive Photo Deploy

**Input**: Design documents from `specs/001-gdrive-photo-deploy/`  
**Approach**: TDD — write failing tests first, implement until green  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent of each other)
- **[Story]**: Which user story this task belongs to
- Tests MUST be written and verified FAILING before implementation tasks begin

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — dependencies, test scaffolding, gitignore

- [x] T001 Create `scripts/requirements-drive-deploy.txt` with `google-api-python-client>=2.0.0`, `google-auth-oauthlib>=1.0.0`, `google-auth-httplib2>=0.2.0`, and `pytest>=7.0.0`
- [x] T002 Add `credentials.json` and `token.json` to `.gitignore` (project root)
- [x] T003 Create `tests/__init__.py` (empty) and `tests/conftest.py` with a `mock_drive_service` pytest fixture that returns a `MagicMock` wired to mimic the `googleapiclient` service interface (`files().list().execute()`, `files().create().execute()`, `files().update().execute()`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core script skeleton and pure-logic helpers that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `scripts/deploy_to_drive.py` with `argparse` CLI entry point, constant `ROOT_FOLDER_ID = "1T0w8pSSIT13y4HzNOKerIPNULjDopD45"`, `DIST_PATH = Path("dist")`, and empty stubs for all functions defined in data-model.md
- [x] T005 [P] Implement `authenticate(credentials_path: Path, token_path: Path) -> Resource` in `scripts/deploy_to_drive.py` — OAuth2 Desktop flow using `google_auth_oauthlib.flow`, scope `https://www.googleapis.com/auth/drive`, cache token to `token_path`
- [x] T006 [P] Implement `normalise_filename(file_name: str) -> str` in `scripts/deploy_to_drive.py` — strips any leading path components, returns bare filename (e.g. `"shelters/slug/img.jpg"` → `"img.jpg"`)
- [x] T034 Add startup validation in `main()` in `scripts/deploy_to_drive.py` — after authenticating, call `files().get(fileId=ROOT_FOLDER_ID).execute(num_retries=5)` and exit with a clear error message (`"ERROR: Target Drive folder not found or not accessible"`) if it raises `HttpError`; addresses E2

**Checkpoint**: Script skeleton exists, auth and filename normalisation are implemented, root folder reachability verified on startup

---

## Phase 3: User Story 1 — Initial Deploy (Priority: P1) 🎯 MVP

**Goal**: Run the script for the first time; photos upload to Drive and every manifest photo entry gains `driveFileId` plus normalised `fileName`

**Independent Test**: Run against empty Drive folder; verify every photo appears in a matching subfolder and every manifest entry has a non-null `driveFileId` with no path prefix in `fileName`

### Tests for User Story 1 ⚠️ Write first — verify FAILING before implementing

> **TDD**: Run `pytest tests/test_deploy_to_drive.py -k "us1"` — all must FAIL before T011

- [x] T007 [P] [US1] Write failing test `test_upload_photo_calls_files_create` in `tests/test_deploy_to_drive.py` — mock Drive service, call `upload_photo()`, assert `service.files().create()` is called with correct `name` and `parents` metadata
- [x] T008 [P] [US1] Write failing test `test_process_shelter_sets_drive_file_id` in `tests/test_deploy_to_drive.py` — mock Drive service returning empty index, call `process_shelter()` for a shelter with one photo, assert photo entry has `driveFileId` set
- [x] T009 [P] [US1] Write failing test `test_normalise_filename_strips_path_prefix` in `tests/test_deploy_to_drive.py` — assert `normalise_filename("shelters/aeolus-view-camp/img.jpg") == "img.jpg"` and `normalise_filename("img.jpg") == "img.jpg"`
- [x] T010 [US1] Write failing test `test_update_or_create_manifest_calls_update_when_exists` in `tests/test_deploy_to_drive.py` — mock Drive service with existing manifest file in root folder index, call `update_or_create_manifest()`, assert `service.files().update()` is called (not `create()`)

### Implementation for User Story 1

- [x] T011 [P] [US1] Implement `build_drive_file_index(service, folder_id: str) -> dict[str, str]` in `scripts/deploy_to_drive.py` — calls `files().list(q="'{folder_id}' in parents and trashed=false", fields="files(id,name)").execute(num_retries=5)`, returns `{name: id}` dict
- [x] T012 [P] [US1] Implement `get_or_create_subfolder(service, parent_id: str, slug: str) -> str` in `scripts/deploy_to_drive.py` — checks root-level `build_drive_file_index()` for existing subfolder; creates via `files().create()` only if absent; returns folder ID
- [x] T013 [US1] Implement `upload_photo(service, local_path: Path, folder_id: str) -> str` in `scripts/deploy_to_drive.py` — uses `MediaFileUpload` with `mimetypes.guess_type()`, calls `files().create(body={name, parents}, media_body=...).execute(num_retries=5)`, returns new Drive file ID
- [x] T014 [US1] Implement `update_or_create_manifest(service, root_folder_id: str, manifest_path: Path) -> None` in `scripts/deploy_to_drive.py` — searches root folder for existing `shelter-manifest.json`; calls `files().update(fileId=..., media_body=...)` if found, `files().create(...)` if not; all with `num_retries=5`
- [x] T015 [US1] Implement `process_shelter(service, shelter: dict, root_folder_id: str, dist_path: Path) -> dict` in `scripts/deploy_to_drive.py` — resolves/creates subfolder, fetches file index, iterates `shelter["photos"]`, normalises `fileName`, uploads or skips each, writes `driveFileId` back to photo entry, returns stats dict `{uploaded, skipped, failed, missing_local}`; print one line per action per FR-008: `"  [UPLOAD] {bare_name}"`, `"  [SKIP] {bare_name} (already on Drive)"`, `"  [RESOLVE] {bare_name} (ID from index)"`, `"  [WARN] {bare_name} (not in dist/)"` — this satisfies FR-008's enumerated log actions
- [x] T016 [US1] Implement `main()` in `scripts/deploy_to_drive.py` — authenticate, load manifest JSON, iterate shelters calling `process_shelter()`, write updated manifest to `dist/shelter-manifest.json`, call `update_or_create_manifest()`
- [x] T017 [US1] Run `pytest tests/test_deploy_to_drive.py -k "us1" -v` — verify T007, T008, T009, T010 all pass (green)

**Checkpoint**: Full initial deploy works end-to-end; manifest is written locally and updated on Drive

---

## Phase 4: User Story 2 — Idempotent Re-deploy (Priority: P2)

**Goal**: Re-running the script skips already-uploaded photos and resolves their Drive IDs from the existing Drive index — no duplicates, no re-uploads

**Independent Test**: Run script twice against same Drive folder; second run upload count = 0; manifest `driveFileId` values unchanged

### Tests for User Story 2 ⚠️ Write first — verify FAILING before implementing

> **TDD**: Run `pytest tests/test_deploy_to_drive.py -k "us2"` — all must FAIL before T021

- [x] T018 [P] [US2] Write failing test `test_existing_photo_skipped_not_reuploaded` in `tests/test_deploy_to_drive.py` — mock Drive index already containing photo filename, call `process_shelter()`, assert `service.files().create()` is NOT called and returned stats show `skipped=1, uploaded=0`
- [x] T019 [P] [US2] Write failing test `test_existing_file_id_resolved_from_drive_index` in `tests/test_deploy_to_drive.py` — mock Drive index with `{filename: "existing-drive-id"}`, call `process_shelter()`, assert photo entry `driveFileId == "existing-drive-id"`
- [x] T020 [US2] Write failing test `test_subfolder_not_recreated_if_exists` in `tests/test_deploy_to_drive.py` — mock root index containing slug subfolder, call `get_or_create_subfolder()`, assert `service.files().create()` is NOT called

### Implementation for User Story 2

- [x] T021 [US2] Update `process_shelter()` in `scripts/deploy_to_drive.py` — before calling `upload_photo()`, check `drive_file_index` for photo's bare filename; if found, set `driveFileId` from index and increment `skipped`, skip upload entirely
- [x] T022 [US2] Update `get_or_create_subfolder()` in `scripts/deploy_to_drive.py` — accept pre-built root index as parameter instead of re-querying Drive; return existing folder ID if slug found in index
- [x] T023 [US2] Run `pytest tests/test_deploy_to_drive.py -k "us2" -v` — verify T018, T019, T020 all pass (green)

**Checkpoint**: Re-running on a fully-deployed Drive folder produces zero uploads and no errors

---

## Phase 5: User Story 3 — Error Recovery (Priority: P3)

**Goal**: Single-photo upload failures are caught and logged; the run continues; photos already on Drive are resolved by name-match regardless of prior interruption

**Independent Test**: Mock a photo that raises `HttpError` on upload; verify remaining photos still process and stats report failure count

### Tests for User Story 3 ⚠️ Write first — verify FAILING before implementing

> **TDD**: Run `pytest tests/test_deploy_to_drive.py -k "us3"` — all must FAIL before T027

- [x] T024 [P] [US3] Write failing test `test_http_error_on_upload_does_not_abort` in `tests/test_deploy_to_drive.py` — mock `files().create()` to raise `HttpError` for first photo only, call `process_shelter()` with 2-photo shelter, assert second photo is still processed and stats show `failed=1, uploaded=1`
- [x] T025 [P] [US3] Write failing test `test_missing_local_file_is_skipped_with_warning` in `tests/test_deploy_to_drive.py` — photo entry references a file not present in `dist/`, call `process_shelter()`, assert `files().create()` is NOT called and stats show `missing_local=1`
- [x] T026 [US3] Write failing test `test_partial_deploy_resumes_correctly` in `tests/test_deploy_to_drive.py` — shelter has 3 photos; Drive index already contains 2 of them; assert exactly 1 upload occurs and all 3 entries have `driveFileId` set

### Implementation for User Story 3

- [x] T027 [US3] Wrap `upload_photo()` call in `process_shelter()` in `scripts/deploy_to_drive.py` with `try/except HttpError` — on exception, print error line with shelter slug + filename + status code, increment `failed`, continue loop; **preserve any existing `driveFileId` value** (only write `None` if the entry had no prior value — do not wipe a valid ID from a previous successful deploy)
- [x] T028 [US3] Add local-file existence check in `process_shelter()` in `scripts/deploy_to_drive.py` — before upload or index lookup, check `(dist_path / slug / bare_name).exists()`; if absent, print warning, increment `missing_local`, skip (do not overwrite existing `driveFileId` if already set)
- [x] T029 [US3] Run `pytest tests/test_deploy_to_drive.py -k "us3" -v` — verify T024, T025, T026 all pass (green)

**Checkpoint**: All three user stories independently verified; full test suite green

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Observability, edge-case warnings, and developer experience

- [x] T030 [P] Add unmatched-local-file warning in `process_shelter()` in `scripts/deploy_to_drive.py` — after processing manifest photos, check if any files in `dist/{slug}/` have no matching manifest entry; print warning per unmatched file
- [x] T031 [P] Add per-shelter progress print and final summary in `main()` in `scripts/deploy_to_drive.py` — print `[slug] uploaded=N skipped=N failed=N` per shelter; print totals at end
- [x] T032 [P] Add `--help` text and usage docstring to `argparse` parser in `scripts/deploy_to_drive.py` describing OAuth credential setup steps
- [x] T033 Run full test suite `pytest tests/ -v` and confirm all tests pass; perform manual smoke test against real Drive folder with a single shelter slug before full deploy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user stories
- **User Stories (Phase 3–5)**: All depend on Phase 2; must execute in P1 → P2 → P3 order (each builds on the previous)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — core upload logic
- **US2 (P2)**: Depends on US1 — idempotency modifies `process_shelter()` and `get_or_create_subfolder()` implemented in US1
- **US3 (P3)**: Depends on US1 — error handling wraps `upload_photo()` call implemented in US1

### Within Each User Story (TDD order)

1. Write ALL tests for the story first — run them, verify FAILING
2. Implement functions in dependency order (helpers before callers)
3. Run story tests again — verify PASSING
4. Move to next story only after checkpoint confirmed

### Parallel Opportunities

- T005, T006, T034 can run in parallel once T004 exists (T034 depends on T005 for auth, but can be written alongside T006)
- T007, T008, T009 can be written in parallel (different test functions, same file — coordinate line ranges)
- T011, T012 can run in parallel (independent functions)
- T018, T019 can be written in parallel
- T024, T025 can be written in parallel
- T030, T031, T032 can run in parallel

---

## Parallel Example: User Story 1

```
# Write tests in parallel (different test functions):
Task T007: test_upload_photo_calls_files_create
Task T008: test_process_shelter_sets_drive_file_id
Task T009: test_normalise_filename_strips_path_prefix

# Then implement helpers in parallel (no shared state):
Task T011: build_drive_file_index()
Task T012: get_or_create_subfolder()
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Write US1 tests (T007–T010), verify FAILING
4. Implement US1 (T011–T016)
5. Run T017 — verify green
6. **STOP and VALIDATE**: Run script against a single shelter slug on real Drive
7. If working: proceed to US2

### Incremental Delivery

1. Setup + Foundational → skeleton ready
2. US1 → first deploy works end-to-end (MVP)
3. US2 → re-deploys are safe and quota-friendly
4. US3 → production-hardened with error recovery
5. Polish → developer-friendly output and warnings

---

## Notes

- [P] tasks = different files or independent functions; safe to run in parallel
- [Story] label maps task to user story for traceability
- TDD: tests are written in the test phase sections; each must FAIL before moving to implementation
- `num_retries=5` must be on every `.execute()` call (built-in exponential back-off)
- Do not commit `credentials.json` or `token.json` (covered in T002)
- Run smoke test against a single shelter slug before the full 257-shelter deploy
