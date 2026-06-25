# Data Model: Safe Shelter Slug Renames

No schema migration. This feature changes *how* two existing columns are kept consistent during an update, not their shape.

## Shelter (`shelters` table)

| Field | Type | Notes |
|---|---|---|
| `id` | INTEGER PK | Unchanged. |
| `slug` | TEXT, UNIQUE | Currently free-text from the renderer. After this feature: always passed through `slugify()` server-side before any write; uniqueness checked explicitly (`SELECT id FROM shelters WHERE slug = ? AND id != ?`) before the UNIQUE constraint would otherwise throw, so the app can surface a clear message instead of a raw constraint error. |
| `history` | TEXT, nullable | Stores a relative path of the form `{slug}/{slug}.md`. When `slug` changes, any `history` value whose prefix exactly matches the *old* slug (`{oldSlug}/...`) is rewritten to use the new slug, in the same DB transaction as the slug update. |

**Rename validity rule**: A rename is valid only if `slugify(input.slug)` is non-empty (FR-002a) and no *other* shelter (`id != this.id`) already has that sanitized value as its `slug` (FR-003).

**Invariant (FR-007)**: After any update — successful or rolled back — `shelters.slug` must equal the actual folder name for that shelter's files on disk. The DB transaction and the disk rename are treated as one unit: if the disk rename fails after the DB transaction committed, the DB transaction's slug-related changes are reversed (re-run with old/new swapped) before the error is surfaced.

## Photo (`photos` table)

| Field | Type | Notes |
|---|---|---|
| `file_name` | TEXT | Stores a path of the form `{slug}/photos/{filename}`. When the owning shelter's `slug` changes, every row where `shelter_id = ?` and `file_name LIKE oldSlug || '/%'` has its slug prefix rewritten to the new slug, in the same transaction as the `shelters` update. |

No new entities, no new columns, no new tables.

## On-disk folder (not a DB entity, but part of this feature's consistency contract)

`{sheltersRoot}/{slug}/` — renamed via a single `fs.rename` call when a shelter's slug changes successfully at the DB layer. Contains `{slug}/{slug}.md` (history) and `{slug}/photos/*` (photo files); these are not renamed individually — the parent directory rename carries them along, since their *paths* (not their on-disk filenames) reference the slug.

**Pre-condition checked before rename**: the target directory (`{sheltersRoot}/{newSlug}/`) must not already exist. If it does (e.g., a stray untracked folder), the rename is rejected with a clear error rather than overwriting/merging (FR-005).
