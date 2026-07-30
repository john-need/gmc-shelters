# Phase 0 Research: Shelter Export as Normalized JSON

No `NEEDS CLARIFICATION` markers remain in Technical Context — every open question was resolved
during `/speckit-clarify` (packaging format, history-file handling, nullable relations). This
document instead records the concrete technical decisions needed to turn the spec into a plan,
made by reading the existing code rather than guessing.

## Decision: Rewrite `buildManifest` in-place, not a parallel implementation

**Rationale**: `src/main/export/builder.ts`'s `buildManifest()` is the only place that queries
shelters/photos/markers for export and writes the manifest JSON. `src/main/export/index.ts`
(dialog, zip, save, cleanup) and `src/main/ipc/export.ts` (IPC registration) don't know or care
about the manifest's internal shape — they just call `buildManifest()` and read
`{shelterCount, photoCount, skippedPhotos}` off the result. So the rewrite is contained entirely
to `builder.ts`; nothing else needs to change.
**Alternatives considered**: Add a second `buildShelterExport()` alongside the old one and switch
the caller — rejected, since Clarification Q1 already confirmed `shelters.json` *replaces*
`shelter-manifest.json`; keeping the old function around dead would just be clutter.

## Decision: Assemble relation lookups once, reuse per shelter

**Rationale**: `makeShelter(row, relations)` needs an already-normalized `Architecture | null`,
`Builder | null`, `ShelterCategory | null` per shelter. Querying `architectures`/`categories`
once, running each through `makeArchitecture`/`makeShelterCategory`, and building `Map<id, T>`
lookups is O(1) per shelter and matches the top-level `architectures`/`shelterCategories` arrays
FR-004 already requires — no separate query per shelter, no duplicated normalization logic.
**Alternatives considered**: Per-shelter `SELECT ... WHERE id = ?` lookups — rejected as
unnecessary N+1 queries when the full lookup table is already being fetched anyway for the
top-level array.

## Decision: Add `src/main/db/builders.ts` with `getAllBuilders()`

**Rationale**: `getAllArchitectures()` and `getAllCategories()` already exist
(`src/main/db/architectures.ts`, `categories.ts`); the equivalent for builders does not — the only
existing builders query is a by-name lookup buried in `shelters.ts`'s upsert helper. FR-004 needs
every builder, independent of shelter references, which nothing currently provides.
**Alternatives considered**: Query `SELECT * FROM builders` inline inside the export builder —
rejected; every other reference table (architectures, categories) already has a dedicated,
tested `db/` module, and builders should follow the same repository-fit pattern rather than being
the one exception.

## Decision: Fix two pre-existing issues in `src/types/shelter.ts` as part of this feature

Two things in the current `Shelter` type block `FR-003`'s null-relations requirement and are worth
fixing now rather than carrying forward:

1. `architecture: Architecture` is imported from `@shared/ipc-types`, while `builder`/`category`
   import their sibling raw types from `./builder`/`./shelter-category`. This is inconsistent —
   `Architecture` should come from `./architecture` like its siblings.
2. `architecture`, `builder`, and `category` are typed as required (non-null) objects. Per
   Clarification Q3, they must become `Architecture | null`, `Builder | null`,
   `ShelterCategory | null`.

**Rationale**: `makeShelter`'s `ShelterRelations` interface (in `src/factories/shelter.ts`) already
assumes non-null relations, so passing `null` for an unassigned architecture/builder/category
would fail to typecheck without this fix — it's a hard prerequisite for FR-003, not optional
cleanup.
**Alternatives considered**: Work around it in the builder with `as unknown as Architecture` casts
— rejected; that would hide the exact bug this feature depends on fixing, and reintroduces the
"lie about the type" problem this session's `src/types`/`src/factories` work was meant to end.

## Decision: Keep `.zip` packaging and history-file copy exactly as implemented today

**Rationale**: Confirmed by Clarifications Q1/Q2. `zipper.ts`'s `createZip()` and
`builder.ts`'s existing `buildHistoryEntry()` (copies the shelter's `.md` file into its tmp
directory) both already do exactly what's needed — they operate on a `tmpDir`/`slug` folder
structure that the rewritten `buildManifest` will still produce, just with different JSON contents
inside it.
**Alternatives considered**: None — this was a closed clarification question, not an open design
choice.

## Decision: Drop the `show_on_web`/`include_in_post` `WHERE` filters

**Rationale**: FR-006, confirmed by Clarification Q2 (of the specify session) / the spec's
resolved scope. The rewritten queries select every shelter and every photo unconditionally.
**Alternatives considered**: Keep the filters and add a separate "export everything" mode —
rejected; the spec is explicit that this export *is* the everything-mode now, with no toggle
requested.
