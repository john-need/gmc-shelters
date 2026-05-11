# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

**Language/Version**: [e.g., Python 3.11, Node.js 20, SQLite 3.x or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., requests, BeautifulSoup, sqlite3, Node built-ins or NEEDS CLARIFICATION]  
**Storage**: [e.g., SQLite in `database/gmc_shelters.sqlite`, markdown under `shelters/`, local assets or N/A]  
**Testing**: [e.g., pytest for unit/integration/contract coverage or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., macOS/Linux CLI environment, WordPress REST consumer, static content repo]  
**Project Type**: [repository automation/content workflow]  
**Performance Goals**: [domain-specific, e.g., complete batch import within operator-acceptable runtime or NEEDS CLARIFICATION]  
**Constraints**: [idempotent reruns, auditable side effects, no assumptions about missing theme code, or NEEDS CLARIFICATION]  
**Scale/Scope**: [e.g., shelter count, photo count, folders touched, external consumers]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [ ] Source of truth identified: repository data, SQLite tables, markdown, and local assets are named explicitly; remote systems are described only as consumers or sync targets.
- [ ] Test-first scope identified: failing tests are planned first for every new automation path, migration, contract change, and regression fix.
- [ ] External contract coverage identified: each out-of-repo consumer, API, CLI, export, or template payload has a documented contract and operator-documentation deliverable.
- [ ] Idempotency and auditability identified: import/sync side effects, dry-run behavior, duplicate detection, and run reporting are defined.
- [ ] Minimal-change fit identified: planned files stay within `scripts/`, `scripts/lib/`, `database/`, `tests/`, and `specs/`, or the complexity section explains why not.
- [ ] WordPress/theme boundary respected: the plan does not assume unavailable theme or server code lives in this repository.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)

```text
scripts/
├── [feature script].py|js
└── lib/
    └── [shared helpers]

database/
├── gmc_shelters.sqlite
└── migrations/
    └── [migration files if needed]

tests/
├── contract/
├── integration/
└── unit/

shelters/
histories/
specs/[###-feature]/
```

**Structure Decision**: [Document the exact repo paths this feature will touch and justify any path outside the default structure above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., new top-level directory] | [current need] | [why `scripts/`/`database/`/`tests/` was insufficient] |
| [e.g., external service dependency] | [specific problem] | [why a repo-local workflow was insufficient] |
