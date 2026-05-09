# Tasks: Shelter Photo Carousel and Bulk Upload

**Input**: Design documents from `/specs/001-shelter-photo-carousel/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md
**Tests**: TDD remains required; write every listed test first, confirm it fails, then implement the corresponding change.
**Organization**: Tasks are grouped by user story so each story remains independently implementable and testable.

## Path Conventions

- Repository automation lives in `scripts/` and shared Python helpers live in `scripts/lib/`
- SQLite schema assets live in `database/` and migrations live in `database/migrations/`
- Automated coverage lives in `tests/unit/`, `tests/integration/`, and `tests/contract/`
- Feature contracts and operator guidance stay under `specs/001-shelter-photo-carousel/`
- Do not assume unavailable WordPress theme code exists in this repository; validate external shelter post/carousel consumers through repo-owned contracts, fixtures, and validation helpers

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Python test harness and shared fixtures needed for schema, gallery, consumer-validation, and import work.

- [X] T001 Create pytest bootstrap and shared test fixtures in `/Users/johnneed/Projects/gmc-shelters/tests/conftest.py`
- [X] T002 [P] Add pytest and supporting dev dependencies in `/Users/johnneed/Projects/gmc-shelters/requirements-dev.txt`
- [X] T003 [P] Create reusable SQLite and source-image fixture data in `/Users/johnneed/Projects/gmc-shelters/tests/fixtures/photo_import_fixture.sql`
- [X] T004 [P] Create reference shelter carousel consumer cases for contract validation in `/Users/johnneed/Projects/gmc-shelters/tests/fixtures/shelter_gallery_consumer_cases.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the shared SQLite schema and repository layer required by every user story.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [X] T005 Write failing migration coverage for managed assets, photo links, and upload audit tables in `/Users/johnneed/Projects/gmc-shelters/tests/integration/test_photo_import_schema.py`
- [X] T006 [P] Write failing repository tests for shelter-scoped photo selection, displayable-asset filtering, and default-photo fallback lookup in `/Users/johnneed/Projects/gmc-shelters/tests/unit/test_photo_repository.py`
- [X] T007 Create the managed asset, photo link, and upload audit migration in `/Users/johnneed/Projects/gmc-shelters/database/migrations/001_photo_managed_assets.sql`
- [X] T008 Implement shared SQLite connection and migration helpers in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_db.py`
- [X] T009 [P] Define shared dataclasses for gallery slides, managed assets, photo links, and upload runs in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_models.py`
- [X] T010 Implement shelter/photo repository queries and fallback lookup helpers in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_repository.py`

**Checkpoint**: Foundation ready for gallery rendering, external consumer validation, and bulk import work.

---

## Phase 3: User Story 1 - View shelter photos in a gallery (Priority: P1) 🎯 MVP

**Goal**: Build a shelter-scoped gallery view model and consumer-validation workflow that lets the shelter post carousel render only valid shelter photos, omit unavailable slides, and honor fallback precedence.

**Independent Test**: Generate gallery data for shelters with multiple valid photos, one valid photo, mixed valid/unavailable photos, and zero valid photos; validate the result against the repo-owned shelter post/carousel consumer contract and confirm usable shelter defaults win before the site-wide placeholder.

### Tests for User Story 1 ⚠️

- [X] T011 [P] [US1] Write contract tests that validate gallery output, caption/credit propagation, and navigation rules against the reference shelter post carousel consumer in `/Users/johnneed/Projects/gmc-shelters/tests/contract/test_shelter_post_template_consumer.py`
- [X] T012 [P] [US1] Write integration tests for shelter-only multi-slide, single-slide, and mixed valid/unavailable gallery derivation in `/Users/johnneed/Projects/gmc-shelters/tests/integration/test_shelter_gallery_builder.py`
- [X] T013 [P] [US1] Write fallback precedence regression tests for usable shelter default images before the runtime-loaded repository-declared site-wide placeholder in `/Users/johnneed/Projects/gmc-shelters/tests/unit/test_shelter_gallery_fallbacks.py`

### Implementation for User Story 1

- [X] T014 [P] [US1] Implement gallery slide derivation, runtime placeholder-manifest loading, caption/credit propagation, and FR-013 unavailable-photo omission rules in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/shelter_gallery.py`
- [X] T015 [P] [US1] Implement shelter post carousel consumer validation helpers in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/shelter_gallery_consumer_validator.py`
- [X] T016 [US1] Implement the shelter gallery service for consumer-ready carousel payloads in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/shelter_gallery_service.py`
- [X] T017 [US1] Add gallery export and consumer-validation commands for shelter slugs in `/Users/johnneed/Projects/gmc-shelters/scripts/export_shelter_gallery_view.py`
- [X] T018 [US1] Update the gallery contract with caption/credit examples, mixed availability, fallback precedence, and consumer validation rules in `/Users/johnneed/Projects/gmc-shelters/specs/001-shelter-photo-carousel/contracts/shelter-gallery-view-model.md`
- [X] T019 [US1] Update operator validation steps for actual shelter carousel consumers, including placeholder-manifest checks, in `/Users/johnneed/Projects/gmc-shelters/specs/001-shelter-photo-carousel/quickstart.md`

**Checkpoint**: User Story 1 delivers a consumer-validated gallery contract and fallback behavior independently of bulk upload execution.

---

## Phase 4: User Story 2 - Bulk upload referenced shelter images (Priority: P2)

**Goal**: Provide a CLI that uploads missing shelter images to WordPress, records outcomes in SQLite, and reports uploaded, skipped, and failed totals for every processed photo row.

**Independent Test**: Run the CLI against fixture photo rows containing uploadable files and unreadable files; confirm apply mode uploads the valid items, records audit rows, reports every outcome, and leaves enough state for gallery consumers to use the uploaded assets.

### Tests for User Story 2 ⚠️

- [X] T020 [P] [US2] Write contract tests for CLI flags, JSON summaries, exit codes, and per-item outcomes in `/Users/johnneed/Projects/gmc-shelters/tests/contract/test_bulk_photo_upload_cli.py`
- [X] T021 [P] [US2] Write integration tests for apply-mode uploads, unreadable-file failures, and run-audit persistence in `/Users/johnneed/Projects/gmc-shelters/tests/integration/test_import_shelter_photos_apply.py`

### Implementation for User Story 2

- [X] T022 [P] [US2] Implement the WordPress media client for upload and metadata updates in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/wordpress_media.py`
- [X] T023 [P] [US2] Implement import item and summary serializers for human and JSON output in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_import_results.py`
- [X] T024 [US2] Implement bulk upload orchestration, dry-run branching, and audit-row writes in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_importer.py`
- [X] T025 [US2] Implement CLI argument parsing, authentication checks, and command execution in `/Users/johnneed/Projects/gmc-shelters/scripts/import_shelter_photos.py`
- [X] T026 [US2] Update the bulk upload CLI contract with apply and dry-run validation guidance in `/Users/johnneed/Projects/gmc-shelters/specs/001-shelter-photo-carousel/contracts/bulk-photo-upload-cli.md`

**Checkpoint**: User Story 2 delivers a working bulk upload CLI with durable run reporting.

---

## Phase 5: User Story 3 - Re-run imports without duplicates (Priority: P3)

**Goal**: Make reruns duplicate-safe by reusing managed assets for the same source-image identity, upserting canonical photo-to-asset links, and reporting same-run plus later-run skips clearly.

**Independent Test**: Run the same import twice against overlapping fixture rows, including rows that share the same image content; confirm the second run uploads only still-missing items, reuses existing managed assets by `source_sha256`, preserves canonical source-path traceability, and creates no duplicate WordPress attachments or duplicate `photo_id` links.

### Tests for User Story 3 ⚠️

- [X] T027 [P] [US3] Write integration tests for same-run duplicate identities, rerun skips, and duplicate-safe photo-link upserts in `/Users/johnneed/Projects/gmc-shelters/tests/integration/test_import_shelter_photos_reruns.py`
- [X] T028 [P] [US3] Write unit tests for source-image identity normalization, `source_sha256` reuse, and canonical source-path traceability in `/Users/johnneed/Projects/gmc-shelters/tests/unit/test_managed_asset_registry.py`

### Implementation for User Story 3

- [X] T029 [P] [US3] Implement source-image identity normalization and managed asset lookup helpers in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/managed_asset_registry.py`
- [X] T030 [P] [US3] Extend SQLite persistence for photo-link upserts, verification timestamps, and duplicate-skip reasons in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_db.py`
- [X] T031 [US3] Update bulk import orchestration to reuse managed assets by `source_sha256` while preserving canonical source-path traceability in `/Users/johnneed/Projects/gmc-shelters/scripts/lib/photo_importer.py`
- [X] T032 [US3] Refresh rerun and idempotency contract rules for source-image identity and association reuse in `/Users/johnneed/Projects/gmc-shelters/specs/001-shelter-photo-carousel/contracts/bulk-photo-upload-cli.md`
- [X] T033 [US3] Refresh rerun validation steps for same-run duplicates and safe second runs in `/Users/johnneed/Projects/gmc-shelters/specs/001-shelter-photo-carousel/quickstart.md`

**Checkpoint**: User Story 3 makes the import process safe to re-run without duplicate media creation or duplicate shelter-photo associations.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize shared documentation and fixture guidance across gallery and import stories.

- [X] T034 [P] Add fixture maintenance guidance for gallery consumer and duplicate-identity scenarios in `/Users/johnneed/Projects/gmc-shelters/tests/fixtures/README.md`
- [X] T035 [P] Update implementation notes and handoff guidance for external shelter carousel consumers in `/Users/johnneed/Projects/gmc-shelters/scripts/README.md`
- [X] T036 Refresh the consolidated end-to-end validation checklist for gallery, upload, mixed-availability, fallback, and rerun workflows in `/Users/johnneed/Projects/gmc-shelters/specs/001-shelter-photo-carousel/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 → Phase 2**: Setup must finish before foundational schema and repository work.
- **Phase 2 → Phase 3**: User Story 1 depends on the shared schema, models, repository helpers, and fixtures.
- **Phase 2 → Phase 4**: User Story 2 depends on the shared schema, models, repository helpers, and fixtures.
- **Phase 4 → Phase 5**: User Story 3 depends on the initial bulk upload workflow from User Story 2.
- **Phase 6**: Starts only after the desired user stories are complete.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2 and remains independent from bulk upload implementation by using fixture-backed gallery and consumer validation.
- **US2 (P2)**: Starts after Phase 2 and is independent from US1 except for shared foundational helpers.
- **US3 (P3)**: Starts after US2 because rerun safety extends the bulk upload workflow and its persisted idempotency state.

### Within Each User Story

- Tests must be written and observed failing before implementation tasks start.
- Shared helper changes should land before orchestration or CLI wiring.
- Contract and quickstart updates must land before the story is considered complete.

### Parallel Opportunities

- `T002`, `T003`, and `T004` can run in parallel after `T001`.
- `T006` and `T009` can run in parallel with other Phase 2 work once schema expectations are fixed.
- `T011`, `T012`, and `T013` can run in parallel for US1; `T014` and `T015` can run in parallel before `T016`.
- `T020` and `T021` can run in parallel for US2; `T022` and `T023` can run in parallel before `T024`.
- `T027` and `T028` can run in parallel for US3; `T029` and `T030` can run in parallel before `T031`.
- After Phase 2, US1 and US2 can be staffed in parallel if separate contributors are available.

---

## Parallel Example: User Story 1

```bash
Task: "T011 [US1] Write contract tests that validate gallery output against the reference shelter post carousel consumer in tests/contract/test_shelter_post_template_consumer.py"
Task: "T012 [US1] Write integration tests for shelter-only multi-slide, single-slide, and mixed valid/unavailable gallery derivation in tests/integration/test_shelter_gallery_builder.py"
Task: "T013 [US1] Write fallback precedence regression tests for usable shelter default images before the site-wide placeholder in tests/unit/test_shelter_gallery_fallbacks.py"

Task: "T014 [US1] Implement gallery slide derivation and FR-013 unavailable-photo omission rules in scripts/lib/shelter_gallery.py"
Task: "T015 [US1] Implement shelter post carousel consumer validation helpers in scripts/lib/shelter_gallery_consumer_validator.py"
```

## Parallel Example: User Story 2

```bash
Task: "T020 [US2] Write contract tests for CLI flags, JSON summaries, exit codes, and per-item outcomes in tests/contract/test_bulk_photo_upload_cli.py"
Task: "T021 [US2] Write integration tests for apply-mode uploads, unreadable-file failures, and run-audit persistence in tests/integration/test_import_shelter_photos_apply.py"

Task: "T022 [US2] Implement the WordPress media client for upload and metadata updates in scripts/lib/wordpress_media.py"
Task: "T023 [US2] Implement import item and summary serializers for human and JSON output in scripts/lib/photo_import_results.py"
```

## Parallel Example: User Story 3

```bash
Task: "T027 [US3] Write integration tests for same-run duplicate identities, rerun skips, and duplicate-safe photo-link upserts in tests/integration/test_import_shelter_photos_reruns.py"
Task: "T028 [US3] Write unit tests for source-image identity normalization, source_sha256 reuse, and canonical source-path traceability in tests/unit/test_managed_asset_registry.py"

Task: "T029 [US3] Implement source-image identity normalization and managed asset lookup helpers in scripts/lib/managed_asset_registry.py"
Task: "T030 [US3] Extend SQLite persistence for photo-link upserts, verification timestamps, and duplicate-skip reasons in scripts/lib/photo_db.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 and Phase 2.
2. Complete Phase 3 for the gallery view model and external consumer validation.
3. Validate mixed valid/unavailable handling and fallback precedence before expanding scope.
4. Stop after US1 if only the MVP is needed.

### Incremental Delivery

1. Finish Setup and Foundational work.
2. Deliver US1 and validate the shelter post/carousel consumer contract.
3. Deliver US2 and validate bulk upload plus audit reporting.
4. Deliver US3 and validate duplicate-safe reruns and source-image identity reuse.
5. Finish polish tasks for shared docs and fixtures.

### Parallel Team Strategy

1. One contributor finishes setup and schema groundwork.
2. After Phase 2, one contributor can build US1 while another builds US2.
3. After US2 lands, a contributor can focus on US3 rerun safety while another handles polish and consumer handoff docs.

---

## Notes

- Every task follows the required checklist format with an ID and exact file path.
- `[P]` tasks target different files and can be handled in parallel.
- User story labels map directly to spec priorities for traceability.
- TDD remains explicit for schema coverage, shelter carousel consumer validation, FR-013 mixed-valid/unavailable behavior, fallback precedence, bulk upload CLI behavior, and duplicate-safe rerun regressions.
