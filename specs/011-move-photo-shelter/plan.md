# Implementation Plan: Move Photo To Another Shelter

**Branch**: `011-move-photo-shelter` | **Date**: 2026-06-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/011-move-photo-shelter/spec.md`

## Summary

Add a "Move to shelter" icon button to the Photos tab's photo detail header. Clicking it opens a two-step picker (choose target shelter, then explicit "Confirm move"). Confirming relocates the photo file on disk into the target shelter's `photos/` folder, updates `photos.shelter_id` in SQLite, clears any `shelters.default_photo_id` / `map_markers.photo_id` reference that pointed at the moved photo on the source shelter, and renames the file on a target-folder name collision. The shared, filename-keyed thumbnail cache requires no change beyond a stale-entry purge if the filename changes. User explicitly requested **TDD**: every new/changed unit (db, fs, ipc, renderer) gets a failing test written first, per existing per-module `*.test.ts`/`*.test.tsx` pairing in this repo.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/renderer/preload), Node.js runtime bundled with Electron
**Primary Dependencies**: better-sqlite3 (DB), Node `fs/promises` (file move), existing `src/main/fs/thumbnails.ts` cache (no new dependency), React 18 + Redux Toolkit (renderer), MUI icon button styling already used in `PhotoDetailPane`
**Storage**: SQLite at `database/gmc_shelters.sqlite` — `photos.shelter_id` column (no schema migration needed, value-only update), `shelters.default_photo_id`, `map_markers.photo_id`
**Testing**: Jest, two projects per `jest.config.cjs` — `src/main/**/*.test.ts` (node env, mocks `electron`/`fs/promises`) and `src/renderer/**/*.test.tsx` (jsdom). TDD: write failing tests first for `src/main/db/photos.ts`, `src/main/fs/photos.ts`, `src/main/ipc/photos.ts`, and the new renderer dialog/PhotosTab wiring.
**Target Platform**: Electron desktop app (macOS primary), local file system + local SQLite, no network/external consumer
**Project Type**: Single Electron app (main process + renderer), not the script/database-migration repo layout described generically in the project constitution template
**Performance Goals**: Move completes (file relocation + DB update) in under 5 seconds for typical photo file sizes (SC-001); matches existing single-file `fs.copyFile`/`fs.unlink` latency used by delete/upload
**Constraints**: DB and filesystem must stay consistent if the move fails partway (FR-011); no per-shelter thumbnail storage introduced (Clarifications); single-photo move only (Assumptions); must reuse the existing delete-confirmation UX pattern (`ConfirmDialog`-style two-step flow)
**Scale/Scope**: One new IPC channel, one new db function, one new fs function, one new renderer dialog component, edits to `PhotoDetailPane` header and `PhotosTab` orchestration. No new directories, no new external dependency, no schema migration.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This repo's constitution (`.specify/memory/constitution.md`) is written in terms of a script/database-sync workflow (`scripts/`, `database/migrations/`, WordPress consumers). This feature is local-only Electron app UI/IPC/DB work with no external consumer, so several gates are satisfied by explicit N/A rather than by the literal `scripts/`/`tests/` paths. Mapped against the actual principles:

- [x] **Source of truth identified** (Principle I): `database/gmc_shelters.sqlite` (`photos.shelter_id`, `shelters.default_photo_id`, `map_markers.photo_id`) and the per-shelter `shelters/<slug>/photos/` folders are the canonical inputs/outputs. No remote system is involved.
- [x] **Test-first scope identified** (Principle II): Failing tests planned first in `src/main/db/photos.test.ts`, `src/main/fs/photos.test.ts`, `src/main/ipc/photos.test.ts`, and new renderer component/`PhotosTab.test.tsx` tests, mirroring this repo's existing `tests/unit`/`tests/integration`/`tests/contract` intent via its actual Jest project structure (`src/main` = integration-level DB+FS+IPC, `src/renderer` = unit-level UI).
- [x] **External contract coverage** (Principle III): N/A — no out-of-repo consumer. Internal IPC contract is documented in `contracts/move-photo-ipc.md` instead of a WordPress/export contract.
- [x] **Idempotency and auditability** (Principle IV): N/A in the import/sync sense — this is a single, synchronous, non-rerunning user action. Re-clicking "Move" after a successful move is a no-op risk mitigated structurally: the target-shelter list excludes the photo's current shelter, so a completed move cannot be re-issued against the same target without first navigating back.
- [x] **Minimal-change fit** (Principle V): All changes stay within the existing `src/main/db/`, `src/main/fs/`, `src/main/ipc/`, `src/shared/`, and `src/renderer/components/MainPane/tabs/` files already used by the sibling delete/upload/set-default features. No new top-level directory, no new dependency, no schema migration.
- [x] **WordPress/theme boundary** (Principle V/III): N/A — feature has no theme or WordPress surface.

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/011-move-photo-shelter/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── move-photo-ipc.md
└── tasks.md
```

### Source Code (repository root)

```text
src/shared/
└── ipc-types.ts                          # add PHOTOS_MOVE channel + PhotoMoveInput type

src/main/db/
├── photos.ts                             # add movePhotoToShelter(photoId, targetShelterId)
└── photos.test.ts                        # TDD: failing tests first

src/main/fs/
├── photos.ts                             # add movePhotoFile(slug→slug rename/copy+unlink, collision-safe)
└── photos.test.ts                        # TDD: failing tests first

src/main/ipc/
├── photos.ts                             # add CHANNELS.PHOTOS_MOVE handler (db update + fs move + thumbnail purge)
└── photos.test.ts                        # TDD: failing tests first

src/main/preload.ts                       # expose window.api.photos.move(...)

src/renderer/components/MainPane/tabs/
├── PhotoDetailPane.tsx                   # add "Move to shelter" icon button + onMove prop
├── PhotoDetailPane.test.tsx              # TDD: failing test first
├── MovePhotoDialog.tsx                   # new: shelter picker + explicit Confirm move (mirrors ConfirmDialog two-step pattern)
├── MovePhotoDialog.test.tsx              # TDD: failing test first
└── PhotosTab.tsx                         # wire pendingMove state, handleMovePhoto, dispatch removePhotoLocal-equivalent
    PhotosTab.test.tsx                    # TDD: failing test first
```

**Structure Decision**: This is an Electron app, not the generic script/database-migration repo the constitution template paths describe. The feature stays entirely within the app's existing `src/main` (DB + filesystem + IPC) and `src/renderer` (UI) trees, following the exact file-pairing already used by the sibling delete/upload/set-default photo features. No `scripts/`, `database/migrations/`, or `tests/` (Python) paths are touched — those belong to the unrelated data-import/sync side of this repo.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
