# Implementation Plan: Safe Shelter Slug Renames

**Branch**: `012-shelter-slug-rename` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-shelter-slug-rename/spec.md`

## Summary

Make the `Slug` field in `ShelterTab.tsx` safe to edit. Today `SHELTERS_UPDATE` only writes the DB row; it never sanitizes the slug, never checks for collisions beyond a raw SQLite UNIQUE constraint, and never touches the filesystem — so a rename orphans the shelter's folder/photos and breaks history/photo display. This feature: (1) extracts the existing inline slugify regex into a shared `src/shared/slug.ts` helper used by both `createShelter` and the renderer's offline fallback; (2) has `updateShelter` sanitize the incoming slug server-side, detect a rename, and reject duplicates (including an empty-after-sanitizing result) before touching anything; (3) extends the `SHELTERS_UPDATE` IPC handler to do a DB-then-disk rename — patch `photos.file_name`/`shelters.history` prefixes inside the same DB transaction as the slug update, then rename the shelter's folder on disk, rolling back the DB change and surfacing a clear error if the disk rename fails; (4) plumbs `sheltersRoot` through `update` (preload + thunk) the same way `delete` already does; (5) surfaces save rejections to the user via the existing `showToast` mechanism. User explicitly requested **TDD**: every new/changed unit (`src/shared/slug.ts`, `src/main/db/shelters.ts`, `src/main/fs/photos.ts`, `src/main/ipc/shelters.ts`, renderer slice/tab wiring) gets a failing test written first, per this repo's existing per-module `*.test.ts`/`*.test.tsx` pairing.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/renderer/preload), Node.js runtime bundled with Electron
**Primary Dependencies**: better-sqlite3 (DB transactions), Node `fs/promises` (`fs.rename`, `fs.access`) for the folder move, existing `src/main/fs/photos.ts` helpers (`ensureShelterDir`/`deleteShelterDir` pattern) — no new dependency. React + Redux Toolkit (renderer), existing `showToast` (uiSlice) for error surfacing.
**Storage**: SQLite at `database/gmc_shelters.sqlite` — `shelters.slug` (UNIQUE), `shelters.history`, `photos.file_name`; the on-disk `{sheltersRoot}/{slug}/` folder (with `photos/` subfolder) is the filesystem counterpart that must stay in sync.
**Testing**: Jest, two projects per `jest.config.cjs` — `src/main/**/*.test.ts` (node env, mocks `electron`/`fs/promises`/`./connection`) and `src/renderer/**/*.test.tsx` (jsdom). TDD: write failing tests first for `src/shared/slug.test.ts`, `src/main/db/shelters.test.ts` (rename branch), `src/main/fs/photos.test.ts` (`renameShelterDir`), `src/main/ipc/shelters.test.ts` (DB-then-disk orchestration + rollback), and renderer coverage for the rejected-save toast in `ShelterTab.test.tsx`.
**Target Platform**: Electron desktop app (macOS primary), local filesystem + local SQLite, no network/external consumer.
**Project Type**: Single Electron app (main process + renderer), not the script/database-migration repo layout described generically in the project constitution template.
**Performance Goals**: A rename (DB transaction + single folder `fs.rename`) completes in well under 1 second for typical shelter photo counts — this is a metadata-only directory move, not a per-file copy, so it does not scale with photo count or file size.
**Constraints**: DB and filesystem must never diverge if the disk rename fails partway (FR-007/SC-003) — handled by rolling back the DB transaction on disk-rename failure. Sanitization must happen server-side only — the renderer-entered value is never trusted for filesystem paths (FR-002). Duplicate/empty-slug checks must happen before any mutation (FR-002a/FR-003). No new directories, dependencies, or schema migration.
**Scale/Scope**: One new shared util (`src/shared/slug.ts`), edits to `createShelter`/`updateShelter` in `src/main/db/shelters.ts`, one new fs function (`renameShelterDir`) in `src/main/fs/photos.ts`, edits to the `SHELTERS_UPDATE` IPC handler/preload signature, one renderer thunk/UI edit to plumb `sheltersRoot` and surface errors.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This repo's constitution (`.specify/memory/constitution.md`) is written in terms of a script/database-sync workflow (`scripts/`, `database/migrations/`, WordPress consumers). This feature is local-only Electron app DB/FS/IPC/UI work with no external consumer, so several gates are satisfied by explicit N/A rather than the literal `scripts/`/`tests/` paths, following the same mapping used in `specs/011-move-photo-shelter/plan.md`:

- [x] **Source of truth identified** (Principle I): `database/gmc_shelters.sqlite` (`shelters.slug`, `shelters.history`, `photos.file_name`) and the per-shelter `{sheltersRoot}/<slug>/` folder are the canonical inputs/outputs. No remote system is involved.
- [x] **Test-first scope identified** (Principle II): Failing tests planned first in `src/shared/slug.test.ts`, `src/main/db/shelters.test.ts`, `src/main/fs/photos.test.ts`, `src/main/ipc/shelters.test.ts`, and `src/renderer/components/MainPane/tabs/ShelterTab.test.tsx` — mirroring this repo's actual Jest project structure (`src/main` = integration-level DB+FS+IPC, `src/renderer` = unit-level UI). User explicitly requested TDD for this feature.
- [x] **External contract coverage** (Principle III): N/A — no out-of-repo consumer. The internal IPC contract change (adding `sheltersRoot` to the `SHELTERS_UPDATE` payload) is documented in `contracts/shelters-update-ipc.md`.
- [x] **Idempotency and auditability** (Principle IV): N/A in the import/sync sense — this is a single, synchronous, user-initiated save action, not a batch/rerunning workflow. Saving again with an unchanged slug is already a structural no-op (FR-006: no rename logic runs when the slug didn't change).
- [x] **Minimal-change fit** (Principle V): All changes stay within the existing `src/shared/`, `src/main/db/`, `src/main/fs/`, `src/main/ipc/`, `src/main/preload.ts`, and `src/renderer/store/`/`src/renderer/components/MainPane/tabs/` files already used by the sibling delete/create-shelter features. No new top-level directory, no new dependency, no schema migration.
- [x] **WordPress/theme boundary** (Principle V/III): N/A — feature has no theme or WordPress surface. (Already-published exports referencing an old slug are explicitly out of scope per the spec's Assumptions.)

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/012-shelter-slug-rename/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── shelters-update-ipc.md
└── tasks.md
```

### Source Code (repository root)

```text
src/shared/
├── slug.ts                               # NEW: slugify(name) — shared sanitizer, single source of truth
└── slug.test.ts                          # TDD: failing tests first

src/main/db/
├── shelters.ts                           # createShelter uses slugify(); updateShelter: sanitize incoming slug,
│                                          #   detect rename, reject duplicate/empty target, patch photos.file_name
│                                          #   + shelters.history prefixes in the same db.transaction()
└── shelters.test.ts                      # TDD: failing tests first (rename branch, duplicate rejection, no-op case)

src/main/fs/
├── photos.ts                             # add renameShelterDir(oldSlug, newSlug, sheltersRoot)
└── photos.test.ts                        # TDD: failing tests first (rename, missing-source warning, target-exists guard)

src/main/ipc/
├── shelters.ts                           # SHELTERS_UPDATE handler: read oldSlug, call updateShelter (DB),
│                                          #   then renameShelterDir (disk); roll back DB on disk failure
└── shelters.test.ts                      # TDD: failing tests first (DB-then-disk order, rollback on disk failure)

src/main/preload.ts                       # update: (shelter, sheltersRoot) => invoke(SHELTERS_UPDATE, { shelter, sheltersRoot })

src/renderer/store/
├── sheltersSlice.ts                      # offline-fallback slug uses shared slugify(); saveShelter thunk passes
│                                          #   loadStoredPaths().SHELTERS_ROOT (matches loadHistory/saveHistory pattern)
└── sheltersSlice.test.ts                 # TDD: failing tests first (sheltersRoot passed through)

src/renderer/components/MainPane/tabs/
├── ShelterTab.tsx                        # handleSave: check saveShelter.rejected.match(result) → showToast(error);
│                                          #   optional: normalize slug field via slugify() on blur
└── ShelterTab.test.tsx                   # TDD: failing test first (rejected save shows toast)
```

**Structure Decision**: This is an Electron app, not the generic script/database-migration repo the constitution template paths describe. The feature stays entirely within the app's existing `src/shared` (cross-process util), `src/main` (DB + filesystem + IPC), and `src/renderer` (store + UI) trees, following the exact file-pairing already used by the sibling delete/create-shelter and move-photo features (see `specs/011-move-photo-shelter/plan.md`). No `scripts/`, `database/migrations/`, or `tests/` (Python) paths are touched — those belong to the unrelated data-import/sync side of this repo.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
