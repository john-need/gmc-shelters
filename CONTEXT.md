# GMC Shelters — Domain Glossary

This file is a **glossary only**. No implementation details, no specs. Terms are added as they are resolved in grilling sessions.

---

## Shelter

A structure along the Long Trail (or historically associated with it) that provides overnight or day accommodation to hikers. A Shelter has a single canonical **Architecture** and a single **Category**. A Shelter's lifespan is expressed as `start_year` and optionally `end_year` (absent when the shelter is extant).

## Shelter Lifespan

The period from `start_year` to `end_year` (or open-ended when `is_extant = true`) during which a Shelter is considered to exist. This is an **authoritative constraint**, not a value derived from Map Markers.

## Map Marker

A geographic position (latitude/longitude) at which a Shelter was located during a specific time window (`start_year`→`end_year`). A Shelter always has at least one Map Marker. Map Marker time windows must be contiguous, must not precede the Shelter's `start_year`, and must not extend beyond its `end_year`. The last marker of an extant Shelter has no `end_year`.

## Change Type

The reason a new Map Marker was created for a Shelter. One of: `Original`, `Moved`, `Renamed`, `Moved & Renamed`. Enforced as a database CHECK constraint.

## Architecture

The structural/construction style of a Shelter (e.g., Adirondack, Log Cabin, Post and Beam). A Shelter has exactly one Architecture. Architecture is a controlled lookup — new styles require an entry in the `architectures` table.

## Category

The functional type of a Shelter (e.g., Lean To, Lodge, Camp, Inn). A Shelter belongs to exactly one Category. Category is a controlled lookup.

## Builder

The primary individual or organization responsible for constructing a Shelter. A Shelter has at most one Builder. The same Builder may be credited on many Shelters.

## Source

A bibliographic reference (book, article, website, archive, etc.) that documents facts about one or more Shelters. A Source's bibliographic metadata (title, publisher, year, author, etc.) is stored once; its association to specific Shelters is tracked via the `shelter_sources` join.

## Source–Shelter Association

The relationship between a Source and a Shelter, carried by the `shelter_sources` join table. Per-citation `annotation`, `notes`, and `quote` live on this association, not on the Source itself. `quote` is a verbatim extract from the source relevant to the specific shelter being cited.

## Photo

An image associated with exactly one Shelter. A Shelter designates one Photo as its `default_photo`. A Map Marker may reference a Photo to show representative imagery for that historical location.

## Shelter History

A freeform Markdown document associated with exactly one Shelter, stored at `{SHELTERS_ROOT}/{slug}/{slug}.md`. It is authored by the user and rendered in the History tab. A Shelter History may be absent (no file on disk), in which case the editor is replaced by a prompt to create it.

## History Entry

The manifest representation of a Shelter History file. Stored as `history` on a `ShelterEntry`; `null` when no history file exists on disk. Shape: `{ filePath: string, updated: string, driveFileId: string | null }`. `filePath` is the relative path used to locate the file (e.g. `slug/slug.md`). `updated` is the filesystem mtime at manifest-build time (ISO 8601). `driveFileId` is null before first publish; set and carried forward across publishes the same way as `PhotoEntry.driveFileId`.

## Photo Metadata

Attributes associated with a Photo. Metadata exists in two independent layers that are intentionally not kept in sync automatically.

## File Layer

The metadata embedded directly in the photo file (EXIF, IPTC, XMP packets). The authoritative source for camera/capture data (exposure, focal length, GPS) and user-supplied annotations stored at the file level (title, creator, description, etc.). The File Layer is modified only by explicit user action from the Metadata Dialog's save path.

## Editorial Layer

Metadata stored in the SQLite `photos` table. The authoritative source for application logic, publishing flags (`include_in_post`), and operator-curated values surfaced in the right column. The Editorial Layer is modified by the right-column editor and by the "Sync from File" action.

## Sync from File

The explicit user action (button in the right column, formerly labelled "Import from File") that copies editorial field values from the File Layer into the Editorial Layer. The only mechanism for propagating file-level metadata changes into the database. It does not affect camera/exposure tags that have no Editorial Layer counterpart.

## Publish Pre-flight

The phase that begins when the operator clicks "Publish to web" and ends when the Publish Diff modal is ready to show. Consists of two operations run before any Drive upload: (1) building the local manifest via `buildManifest()` into `.publish-tmp/`, and (2) fetching the prior Drive manifest. The pre-flight result is held in main-process memory until the operator confirms or cancels.

## Publish Diff

The categorised comparison between the new local manifest and the prior Drive manifest. Four buckets: **new** (photos in local manifest with no prior Drive entry), **updated** (photos whose `updated` timestamp is newer than the prior manifest entry), **deleted** (photos in the prior manifest whose `fileName` is absent from the new local manifest — i.e. removed from `include_in_post`), and **unchanged** (skipped — no Drive call). The diff also carries the total shelter count and total map marker count from the new local manifest. History files (`.md`) are uploaded only when `history.updated` is newer than the prior manifest's `history.updated` (or no prior entry exists); the diff carries `historyToUploadCount` and `historyUnchangedCount` separately. History files are not shown as per-item diff entries. All photo operations are unconditional: every photo in each bucket is processed automatically on Publish with no per-item override.

## Publish Diff Modal

The backdrop-locked modal that displays a summary of the Publish Diff before any Drive upload occurs. Shows counts only: N new · N updated · N to delete · N unchanged · N shelters · N map markers · N history files (when > 0). The operator confirms or aborts — there are no per-item checkboxes. Two exit paths: **Cancel** (aborts, cleans up `.publish-tmp/`) and **Publish** (executes all operations unconditionally). Cancel is available throughout — including during an active upload — but Drive files already written before Cancel are left as-is. The modal owns the full publish lifecycle: loading state, summary review, upload progress, and completion or error.

