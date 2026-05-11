<!--
Sync Impact Report
- Version change: template -> 1.0.0
- Modified principles:
  - [PRINCIPLE_1_NAME] -> I. Repository Data & Local Assets as Source of Truth
  - [PRINCIPLE_2_NAME] -> II. Test-First Changes Are Mandatory
  - [PRINCIPLE_3_NAME] -> III. Explicit External Contracts & Operator Docs
  - [PRINCIPLE_4_NAME] -> IV. Idempotent, Auditable Sync Workflows
  - [PRINCIPLE_5_NAME] -> V. Minimal Additions, Repository-Fit Design
- Added sections:
  - Repository Constraints
  - Workflow & Quality Gates
- Removed sections:
  - None
- Templates requiring updates:
  - ✅ updated: .specify/templates/plan-template.md
  - ✅ updated: .specify/templates/spec-template.md
  - ✅ updated: .specify/templates/tasks-template.md
  - ✅ updated: CLAUDE.md
- Follow-up TODOs:
  - None
-->
# GMC Shelters Constitution

## Core Principles

### I. Repository Data & Local Assets as Source of Truth
All automation, derived content, and publishing inputs MUST originate from repository-owned
sources such as `database/`, `shelters/`, `histories/`, `shelter-list.json`, and local shelter
assets staged for this repository. Remote systems, including WordPress, MUST be treated as
publication targets or external consumers, not as canonical data sources when equivalent
repository data exists. Rationale: this repository already stores the shelter records, markdown,
and local assets that automation depends on, so canon must remain versioned and reviewable here.

### II. Test-First Changes Are Mandatory
Every new automation path, SQLite migration, external contract, and regression fix MUST begin with
failing tests before implementation. Coverage MUST be added in the repo test structure that best
matches the risk: `tests/unit/` for logic, `tests/integration/` for database and workflow
behavior, and `tests/contract/` for consumer-facing payloads and CLIs. Documentation-only changes
may omit tests only when they introduce no executable behavior. Rationale: this repo is driven by
scripts and data workflows, so failures are cheapest to catch before scripts mutate data or remote
systems.

### III. Explicit External Contracts & Operator Docs
Every external integration and every consumer outside this repository MUST be defined by an
explicit contract and operator-facing documentation before rollout. WordPress APIs, export payloads,
CLI interfaces, and theme-consumer inputs MUST be documented in `specs/<feature>/contracts/` and in
operator guidance such as `quickstart.md` or `scripts/README.md`. Implementations MUST NOT assume
missing WordPress theme code exists in this repository; repo-owned work stops at documented
contracts, fixtures, and automation. Rationale: external consumers can only be changed safely when
inputs, outputs, and operator steps are unambiguous.

### IV. Idempotent, Auditable Sync Workflows
Every import, upload, or sync workflow MUST be safe to rerun without duplicate side effects.
Workflows with external side effects MUST provide a dry-run or equivalent inspection mode when
feasible, MUST detect already-processed records through stable identifiers or fingerprints, and
MUST emit per-run audit results that account for uploaded, skipped, and failed items. Partial
failures MUST preserve enough state to support diagnosis and safe retry. Rationale: shelter media
and content syncs are batch-oriented and operators need repeatable, inspectable runs.

### V. Minimal Additions, Repository-Fit Design
Changes MUST fit the existing repository layout before introducing new frameworks, services, or
directories. Prefer extending `scripts/`, `scripts/lib/`, `database/`, `tests/`, and feature docs
under `specs/`; any larger structural addition MUST be justified in the implementation plan’s
complexity tracking. Solutions MUST avoid inventing code dependencies on unavailable WordPress theme
files or server-side systems that are not stored in this repository. Rationale: the repo is a
focused data-and-automation workspace, and narrow changes are easier to review, test, and operate.

## Repository Constraints

- SQLite remains the authoritative local operational store; schema changes MUST be delivered as
  reviewed migration files under `database/migrations/` when migrations are introduced.
- Repository automation MUST live under `scripts/`, with shared Python helpers under `scripts/lib/`
  and tests under `tests/unit/`, `tests/integration/`, or `tests/contract/`.
- Derived outputs and generated content MUST identify their source inputs and destination paths in
  the relevant spec, plan, task list, or operator documentation.
- Secrets, application passwords, and remote-only configuration MUST NOT be committed to the repo.
- Features that touch out-of-repo presentation layers MUST define payload contracts and validation
  steps instead of claiming direct theme implementation unless the target code is checked in here.

## Workflow & Quality Gates

- `/speckit.specify` MUST identify the repository source-of-truth inputs, local assets involved,
  external consumers, operator touchpoints, and any idempotency or audit requirements.
- `/speckit.plan` MUST fail the Constitution Check unless it documents: source-of-truth inputs,
  failing tests to be written first, explicit contracts and operator docs, rerun-safe sync design,
  and why the change fits the existing repo structure.
- `/speckit.tasks` MUST place required test tasks before implementation tasks for new automation,
  migrations, contracts, and regressions. Tasks for external integrations MUST include contract and
  operator-documentation work. Tasks for sync workflows MUST include rerun-safety and audit work.
- `/speckit.implement` MUST keep changes scoped to the documented repo paths, preserve idempotency,
  and update docs, contracts, and fixtures in the same change set.
- Before merge or handoff, contributors MUST run the relevant test suites, validate documented
  operator steps, and confirm that external side effects remain duplicate-safe on rerun.

## Governance

This constitution overrides conflicting local habits for work performed in this repository. Every
feature review, task review, and implementation review MUST check compliance with all five core
principles.

Amendments MUST be made by updating this document together with any affected templates, workflow
artifacts, and runtime guidance files in the same change. Amendment proposals MUST explain whether
the change is a MAJOR, MINOR, or PATCH version bump.

Versioning policy follows semantic versioning for governance: MAJOR for incompatible principle or
governance changes, MINOR for new principles or materially expanded obligations, and PATCH for
clarifications that do not change required behavior.

Compliance reviews MUST verify, at minimum, that canonical data remains repository-owned, tests
were specified before implementation for covered change types, external contracts and operator docs
exist where required, sync workflows are auditable and rerunnable, and the solution avoids unjustified
structure expansion or assumptions about missing WordPress theme code.

**Version**: 1.0.0 | **Ratified**: 2026-05-05 | **Last Amended**: 2026-05-05
