# Implementation Plan: Shelter Export as Normalized JSON

**Branch**: `020-shelter-export-json` | **Date**: 2026-07-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/020-shelter-export-json/spec.md`

## Summary

Replace the Export button's output: instead of the hand-rolled `shelter-manifest.json` (filtered
to `show_on_web`/`include_in_post` records, built by ad hoc row mapping in
`src/main/export/builder.ts`), Export now writes `shelters.json` — every shelter, built through
the shared `makeShelter` factory (`src/factories/shelter.ts`) so every entry has an identical,
fully-nested shape (architecture/builder/category objects, photo/source/map-marker lists) — plus
top-level `architectures`, `shelterCategories`, and `builders` reference arrays. Photos and each
shelter's history markdown file are still copied into a folder named for that shelter, and the
whole package is still bundled into the existing dated `.zip` archive via the existing dialog/save
flow. No new data, no schema change — this is a rebuild of the export payload's shape and scope
using code (`src/factories/`, `src/types/`) written earlier this session, plus filling the two
gaps that surfaced doing so (nullable relations, a missing `builders` read function).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js (Electron main process, `main` Jest project)
**Primary Dependencies**: `better-sqlite3` (direct SQL, no ORM), `archiver` (existing `zipper.ts`),
Electron `dialog`/`ipcMain`, Jest + `ts-jest`
**Storage**: SQLite at `database/gmc_shelters.sqlite` (`shelters`, `photos`, `sources`,
`map_markers`, `architectures`, `categories`, `builders` tables); shelter photo files and
per-shelter `.md` history files under the shelters root on disk
**Testing**: Jest (`main` project, `testEnvironment: node`), colocated `*.test.ts`, in-memory
`better-sqlite3` fixtures — the existing pattern in `src/main/export/builder.test.ts` and
`src/factories/factories.test.ts`
**Target Platform**: Electron desktop app (macOS dev machine); output consumed later by an
out-of-repo WordPress deployment script (contract only, no code here)
**Project Type**: Single Electron app (`src/main` / `src/renderer` / `src/shared` / `src/types` /
`src/factories`) — not the generic scripts/tests-unit layout in the plan template; see Structure
Decision below
**Performance Goals**: N/A — local, operator-triggered, one-shot export; no throughput target
**Constraints**: MUST reuse the existing Export button, loading state, toast feedback, and
destination-picker dialog unchanged (spec Assumptions); MUST NOT filter by `show_on_web` /
`include_in_post` (FR-006); MUST keep the `.zip` packaging (Clarification Q1) and history-file
copy (Clarification Q2)
**Scale/Scope**: All shelters/photos/sources/map markers in the database (currently ~dozens of
shelters, low hundreds of photos) — small enough that no batching/streaming is needed

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] Source of truth identified: `shelters`, `photos`, `sources`, `map_markers`, `architectures`,
      `categories`, `builders` SQLite tables plus on-disk photo/`.md` files (spec's Canonical
      Inputs). No remote system is a data source; WordPress is named only as the downstream
      consumer of the archive.
- [x] Test-first scope identified: the rewritten export builder, the new `getAllBuilders()` read,
      and the `src/types/shelter.ts` nullability fix are all logic changes — failing tests go in
      colocated `*.test.ts` files first (this repo's equivalent of `tests/unit/`/`tests/integration/`
      — see Structure Decision), matching the existing `builder.test.ts`/`factories.test.ts` pattern.
- [x] External contract coverage identified: `shelters.json`'s shape is documented in
      `contracts/shelters-json-schema.md` before implementation; `quickstart.md` documents the
      operator-facing package layout. The WordPress-side reader is out of this repo and out of
      scope, per spec.
- [x] Idempotency and auditability identified: export has no external side effects to
      duplicate-guard (it writes one local file the operator explicitly names/overwrites); the
      existing skipped-photo count in the completion toast is the audit signal, extended to cover
      the same requirement for the new shape (FR-007, SC-004). N/A for dry-run — there's no remote
      write to preview.
- [x] Minimal-change fit identified: every touched path already exists in this repo's established
      structure (`src/main/export/`, `src/main/db/`, `src/factories/`, `src/types/`) — no new
      top-level directory, no new dependency, no SQLite migration (no schema change).
- [x] WordPress/theme boundary respected: plan stops at a documented `shelters.json` contract; no
      WordPress-side code is assumed or written here.

## Project Structure

### Documentation (this feature)

```text
specs/020-shelter-export-json/
├── plan.md              # this file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── shelters-json-schema.md
└── tasks.md              # /speckit-tasks output (not yet generated)
```

### Source Code (repository root)

This repo is a TypeScript Electron app, not a Python scripts/data-workflow repo — the generic
`scripts/`+`tests/unit|integration|contract` layout in the plan template doesn't apply. The
established, pre-existing structure (used by all 19 prior specs) is `src/main` (Electron main
process + SQLite access), `src/renderer` (React UI), `src/shared` (cross-process types), plus the
`src/types`/`src/factories` pair added earlier this session. Tests are colocated `*.test.ts` files
run by Jest, not a separate `tests/` tree.

```text
src/
├── main/
│   ├── db/
│   │   ├── builders.ts          # NEW — getAllBuilders(), matching architectures.ts/categories.ts
│   │   └── builders.test.ts     # NEW
│   ├── export/
│   │   ├── builder.ts           # REWRITTEN — builds shelters.json via factories, not ad hoc rows
│   │   ├── builder.test.ts      # REWRITTEN — asserts new shape/scope
│   │   ├── index.ts             # unchanged (dialog/zip/save flow already generic)
│   │   └── zipper.ts            # unchanged (reused as-is)
│   └── ipc/export.ts             # unchanged (no IPC contract change — ExportResult is a summary,
│                                  # not the manifest content)
├── factories/
│   └── shelter.ts                # unchanged signature; consumer for the rewritten builder
├── types/
│   └── shelter.ts                # FIXED — architecture/builder/category made nullable
│                                  # (Clarification Q3) and architecture's import corrected to
│                                  # `./architecture` for consistency with builder/category
└── renderer/components/AppShell/AppHeader.tsx  # unchanged — button, loading state, toasts as-is
```

**Structure Decision**: All work stays inside the existing `src/main/export/`, `src/main/db/`,
`src/factories/`, and `src/types/` folders already established in this repo. No new directories.
The only new file is `src/main/db/builders.ts` (a read function that mirrors
`architectures.ts`/`categories.ts`, which is missing today), plus its test.

## Complexity Tracking

*No Constitution Check violations — this section is not needed.*
