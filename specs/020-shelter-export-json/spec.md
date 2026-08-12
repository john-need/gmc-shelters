# Feature Specification: Shelter Export as Normalized JSON

**Feature Branch**: `020-shelter-export-json`
**Created**: 2026-07-30
**Status**: Draft
**Input**: User description: "Let's refactor export function, the button is in the header, Export should 1) create a JSON file, shelters.json, that takes all shelters and runs them through the src/factories/shelter.ts, makeShelter function, in addition, all photos should be included in the export, photos should be sorted into folders named for the shelter. The json should include shelters, architectures, shelterCategories, and builders."

## Clarifications

### Session 2026-07-30

- Q: Does the exported package keep the existing dated `.zip` archive format, or become loose files written directly to the destination? → A: Keep zipping — `shelters.json` and the per-shelter photo folders are bundled into one dated `.zip` file, same as today.
- Q: Does the export still copy each shelter's `.md` history file into the package, or does `shelters.json`'s `history` field (a raw path string) become the only trace of it? → A: Keep copying the `.md` file into that shelter's photo folder, same as today.
- Q: What does a shelter entry's `architecture`/`builder`/`category` field hold when nothing is assigned? → A: `null` — these nested relation fields are nullable, not placeholder objects.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export a Normalized Data Package (Priority: P1)

An operator clicks the **Export** button in the app header. The app assembles every shelter's
data (built through the shared shelter normalization logic) together with the reference lists of
architectures, shelter categories, and builders, writes it all to a single `shelters.json` file,
copies every shelter's photos into a folder named for that shelter, bundles everything into a
single dated `.zip` archive, and saves that archive to a destination the operator chooses.

**Why this priority**: This is the entire purpose of the Export button — producing a complete,
self-contained data package is the one thing this feature must do correctly.

**Independent Test**: Trigger an export, choose a destination folder, and verify a dated `.zip`
archive is written there containing a `shelters.json` file (with `shelters`, `architectures`,
`shelterCategories`, and `builders` arrays) alongside one photo folder per shelter (named for that
shelter) containing that shelter's photo files.

**Acceptance Scenarios**:

1. **Given** the app is open, **When** the operator clicks Export, **Then** the button enters a
   disabled/loading state and a progress toast appears.
2. **Given** the export completes, **When** the package is written, **Then** the operator is
   prompted to choose a save destination.
3. **Given** the operator picks a destination, **When** it is confirmed, **Then** a dated `.zip`
   archive containing `shelters.json` and one photo folder per shelter is written there, and a
   success toast confirms the save.
4. **Given** the operator dismisses the destination picker without choosing one, **When**
   cancelled, **Then** nothing is written and the button returns to its normal state with no error.

---

### User Story 2 - Every Shelter Built the Same Way (Priority: P1)

Each shelter entry in `shelters.json` is produced by the same normalization step, so every
shelter's record has the same shape and the same field names — including its nested architecture,
builder, category, photos, sources, and map markers.

**Why this priority**: A downstream consumer of `shelters.json` should never encounter a shelter
whose shape differs from the rest. Sharing one normalization step across all shelters is what
guarantees that.

**Independent Test**: Export shelters that have different combinations of missing data (no
architecture assigned, no builder, no photos, no sources) and confirm every shelter entry still
has the full, consistently-shaped set of fields — with empty/absent relations represented
consistently rather than the field being missing entirely.

**Acceptance Scenarios**:

1. **Given** a shelter with no assigned builder, **When** it is exported, **Then** its entry still
   includes a `builder` field, whose value is `null` — the same representation every unassigned
   builder/architecture/category uses, never a placeholder object.
2. **Given** a shelter with no photos, **When** it is exported, **Then** its `photos` field is an
   empty list rather than absent.

---

### User Story 3 - Export Failure Feedback (Priority: P2)

The export fails partway through (e.g. a photo file is missing from disk, or the destination
folder can't be written to). The operator sees a clear error message and the Export button
returns to its normal state so they can retry.

**Why this priority**: Silent failures leave the operator without a way to know the export is
incomplete or stale.

**Independent Test**: Simulate a missing photo file on disk and confirm the export still
completes, reporting how many photos were skipped, without crashing.

**Acceptance Scenarios**:

1. **Given** a photo record whose file is missing from disk, **When** the export runs, **Then**
   that photo is skipped, the rest of the export proceeds, and the completion message reports the
   number of skipped photos.
2. **Given** the destination can't be written to, **When** the failure is caught, **Then** an
   error toast describes the failure and the Export button re-enables.

---

### Edge Cases

- What happens when two shelters would resolve to the same photo folder name? This cannot occur:
  slug uniqueness is enforced by the existing `shelters_slug_uindex` database constraint.
- How does the export handle a shelter with no category or no architecture assigned?
- How does the export handle a shelter with no history markdown file on disk — its folder simply
  contains no `.md` file, with no error raised?
- How is a rerun handled — does exporting twice in a row simply overwrite the previous package at
  the chosen destination, with no merge or duplicate-detection step?

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: the `shelters`, `photos`, `sources`, `map_markers`, `architectures`,
  `categories`, and `builders` SQLite tables, plus the photo files and per-shelter `.md` history
  files stored under the shelters root on disk.
- **Derived Outputs**: a single dated `.zip` archive, containing `shelters.json` (with `shelters`,
  `architectures`, `shelterCategories`, and `builders` arrays) and one photo folder per shelter
  with that shelter's photo files and its `.md` history file (when one exists). The archive is the
  exported package saved at the operator-chosen destination.
- **Out-of-Repo Consumers**: `shelters.json` replaces `shelter-manifest.json` as the Export
  button's sole output. The WordPress deployment script (spec 008-export-dist-zip's consumer,
  out of this repo) will need updating to read the new shape before the next publish; that update
  is out of scope for this feature.

### Contracts & Operations

- **Contract Artifacts**: `specs/020-shelter-export-json/contracts/shelters-json-schema.md`
  (shape of `shelters.json`, including the per-shelter nested structure).
- **Operator Documentation**: quickstart update describing the new `shelters.json` structure and
  the per-shelter photo folder layout.
- **Theme/External Code Boundary**: any WordPress-side script that reads the exported package is
  out of this repo; this feature stops at producing a documented, correct `shelters.json` and
  photo folder layout.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST produce a single `shelters.json` file per export, containing
  top-level `shelters`, `architectures`, `shelterCategories`, and `builders` arrays.
- **FR-002**: The system MUST build every entry in the `shelters` array using the same shared
  shelter-normalization step, so every shelter entry has an identical, complete field shape.
- **FR-003**: Each shelter entry MUST include its associated architecture, builder, and category
  as nested objects (not just identifiers), and its associated photos, sources, and map markers as
  nested lists. When a shelter has no architecture, builder, or category assigned, that field's
  value MUST be `null` rather than an omitted field or a placeholder object.
- **FR-004**: The `architectures`, `shelterCategories`, and `builders` top-level arrays MUST each
  list every record from their respective reference table, independent of which shelters
  reference them.
- **FR-005**: The system MUST copy every exported shelter's photo files into a folder dedicated to
  that shelter, so photos are organized on disk by shelter rather than left in a flat list.
- **FR-006**: The system MUST include every shelter and every photo record in the export,
  regardless of publish-related flags (`show_on_web`, `include_in_post`) — the export is a
  complete data package, not filtered to only web-published content.
- **FR-007**: If a photo's file is missing from disk, the system MUST skip that photo, continue
  the export, and report the number of skipped photos in the completion message, rather than
  failing the whole export.
- **FR-008**: The operator MUST be able to choose the destination folder for the exported package
  after it is assembled, and MUST be able to cancel before anything is written.
- **FR-009**: If the export fails, the system MUST show an error message describing the failure
  and return the Export button to its normal, retryable state.
- **FR-010**: The system MUST bundle `shelters.json` and every shelter's photo folder into a
  single dated `.zip` archive before the operator chooses a destination, matching the existing
  export's archive format.
- **FR-011**: When a shelter has a history markdown file on disk, the system MUST copy it into
  that shelter's folder in the archive, alongside its photos.

### Key Entities *(include if feature involves data)*

- **Shelter Entry**: One shelter's complete normalized record in `shelters.json` — its own
  attributes plus its nested architecture, builder, category, photos, sources, and map markers.
  Architecture, builder, and category are `null` when unassigned; photos, sources, and map markers
  are empty lists when none exist.
- **Architecture / Shelter Category / Builder**: Reference lookup records; each appears once in
  its own top-level array in `shelters.json`, and is also embedded (by value) inside every shelter
  entry that references it.
- **Shelter Photo Folder**: A folder in the exported package dedicated to one shelter's photo
  files, distinguishing that shelter's photos from every other shelter's.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can produce a complete export package (JSON plus photo folders) in a
  single action from the app header, with no manual file assembly.
- **SC-002**: 100% of shelter entries in a given export have an identical set of fields, with no
  entry missing a field another entry has.
- **SC-003**: An operator can locate any shelter's photos by looking for the folder named for that
  shelter, without cross-referencing the JSON file.
- **SC-004**: When a photo file is missing from disk, the export still completes and the operator
  is told exactly how many photos were skipped.

## Assumptions

- Photo folders are named using each shelter's existing URL-safe slug (the same identifier already
  used for per-shelter photo storage on disk), not the shelter's free-text display name, since
  display names may contain characters unsafe for folder names or collide between shelters. Slug
  collisions between two shelters cannot occur — `slug` is enforced unique by the existing
  `shelters_slug_uindex` database constraint.
- The `sources` and `map_markers` nested lists on each shelter entry follow the same
  normalization/shape guarantees as `photos`, `architecture`, `builder`, and `category`, even
  though the user's request called out photos specifically.
- Exporting twice in a row simply overwrites/replaces the package at the newly chosen destination;
  there is no merge, diffing, or duplicate-detection step (the existing Export flow has none
  today, and nothing in this request asks for one).
- The Export button's existing location, loading state, and toast-based feedback pattern in the
  app header are reused as-is; this feature changes what Export produces, not how it's triggered.
