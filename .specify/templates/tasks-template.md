---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md
**Tests**: Tests are REQUIRED for new automation, migrations, contracts, and regression fixes. Write them first and confirm they fail before implementation.
**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Repository automation lives in `scripts/`
- Shared Python helpers live in `scripts/lib/`
- SQLite database assets and migrations live in `database/`
- Test coverage lives in `tests/contract/`, `tests/integration/`, and `tests/unit/`
- Feature contracts and operator docs live under `specs/[###-feature-name]/`
- Do not assume unavailable WordPress theme code exists in this repo; represent external consumers with contracts and docs instead

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project setup and shared scaffolding required before story work.

- [ ] T001 Create or update shared repository scaffolding in the documented repo paths
- [ ] T002 [P] Add or update the test runner and shared fixtures required for failing tests
- [ ] T003 [P] Add contract and operator-documentation placeholders in `/specs/[###-feature-name]/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core repository infrastructure that MUST be complete before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Write failing migration or repository integration coverage for shared schema/data changes
- [ ] T005 [P] Write failing contract coverage for external payloads, CLI behavior, or consumer interfaces
- [ ] T006 [P] Implement shared database, filesystem, or repository helpers in `scripts/lib/` or `database/`
- [ ] T007 Define audit, rerun-safety, or duplicate-detection support needed by later stories

**Checkpoint**: Foundation ready; user story implementation can now begin.

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 ⚠️

- [ ] T010 [P] (US1) Write contract, integration, or unit tests that fail before implementation
- [ ] T011 [P] (US1) Add regression coverage for edge cases and fallback behavior where applicable

### Implementation for User Story 1

- [ ] T012 [P] (US1) Implement the smallest repo-fit code change in `scripts/`, `scripts/lib/`, `database/`, or documented data files
- [ ] T013 (US1) Connect the user-facing workflow, payload, or repository automation for this story
- [ ] T014 (US1) Update contracts and operator docs for this story in `/specs/[###-feature-name]/contracts/` or `quickstart.md`

**Checkpoint**: User Story 1 should be fully functional and independently testable.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 ⚠️

- [ ] T015 [P] (US2) Write failing tests for the new behavior and any integration boundaries
- [ ] T016 [P] (US2) Add regression or rerun-safety coverage where applicable

### Implementation for User Story 2

- [ ] T017 [P] (US2) Implement the smallest repo-fit code change for this story
- [ ] T018 (US2) Extend contracts, CLI output, or operator steps required by this story

**Checkpoint**: User Stories 1 and 2 should both work independently.

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 ⚠️

- [ ] T019 [P] (US3) Write failing tests for duplicate-safe reruns, audit trails, or remaining edge cases

### Implementation for User Story 3

- [ ] T020 [P] (US3) Implement the minimal repository change needed for this story
- [ ] T021 (US3) Finalize audit reporting, documentation, and contract updates for this story

**Checkpoint**: All user stories should now be independently functional.

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories.

- [ ] TXXX [P] Refresh operator documentation and quickstart validation steps
- [ ] TXXX Re-run required unit, integration, and contract suites
- [ ] TXXX [P] Clean up implementation while preserving existing repo structure
- [ ] TXXX Verify dry-run, rerun, and audit behavior for any workflow with side effects

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion and blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Final Phase)**: Depends on all desired user stories being complete.

### User Story Dependencies

- User stories may proceed in parallel only when they do not break independent testability.
- External contract and operator-documentation tasks must land with the story that introduces the integration.
- Import or sync stories must not close until rerun-safety and audit expectations are validated.

### Within Each User Story

- Tests MUST be written and observed failing before implementation begins.
- Shared helpers should precede orchestration or CLI wiring.
- Contracts and operator docs should be updated before the story is marked complete.

### Parallel Opportunities

- Tasks marked `[P]` can run in parallel when they target different files.
- Test tasks for one story can run in parallel with each other.
- Contract and documentation tasks can run in parallel with implementation only if the behavior is already defined and stable.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup.
2. Complete Foundational work.
3. Complete User Story 1.
4. Validate User Story 1 independently before expanding scope.

### Incremental Delivery

1. Finish Setup and Foundational work.
2. Deliver User Story 1 and validate its tests and docs.
3. Deliver User Story 2 and validate its tests and docs.
4. Deliver User Story 3 and validate rerun safety, audits, and docs.
5. Finish polish tasks.

### Parallel Team Strategy

1. Team completes Setup and Foundational work together.
2. After Phase 2, different contributors may take different user stories.
3. Shared contracts, docs, and audit expectations must stay synchronized across stories.

---

## Notes

- `[P]` tasks = different files, no dependencies.
- Every user story must remain independently completable and testable.
- Keep changes inside the existing repository structure unless the plan explicitly justifies otherwise.
- Do not represent missing theme code as an implementation task in this repository.
