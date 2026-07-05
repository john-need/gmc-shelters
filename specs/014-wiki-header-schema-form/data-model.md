# Data Model: Schema-Driven Wiki Header Editor

## Entities

### Header Schema

A static, per-`SourceType` table of property definitions. Each property has:

- **key**: the frontmatter field name (`title`, `publisher`, `volume`, …)
- **control**: `text` | `multiline` | `number` | `select` | `readonly`
- **applicability**, per citation type: `required` | `optional` | `n/a`

Governs which fields `CollectionsManagementPage.tsx`'s header form renders and what `wiki-header-schema.ts`'s `validateHeader(citationType, values)` accepts.

### Citation Type

The existing `SourceType` union (`src/shared/ipc-types.ts`): `book | chapter | journal | newspaper | magazine | website | archive | manuscript | interview | map | report | other`. No new type is introduced by this feature.

### Collection Citation Type Setting

A single `citation_type` string stored as a top-level key in `collections/<name>/metadata.yaml`, read by `load_collection_meta()` and used by `okf_header()` as the default for newly converted files from that collection (existing behavior — this feature adds the write path and UI control).

### Wiki File Header

The property values stored in one wiki file's frontmatter, edited through the schema-driven form. Always includes the read-only, non-schema-governed properties `resource`, `timestamp`, `pages`, and the legacy `type` field (preserved verbatim per the spec's clarification — FR-011).

## Header Schema Table

Properties not listed for a type are `n/a` (hidden). `citation_type` itself is always `required` and is not repeated below.

| Property | Control | book | chapter | journal | newspaper | magazine | website | archive | manuscript | interview | map | report | other |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `title` | text | required | required | required | required | required | required | required | required | required | required | required | required |
| `description` | multiline | required | required | required | required | required | required | required | required | required | required | required | required |
| `language` | text | required | required | required | required | required | required | required | required | required | required | required | required |
| `author` | text | required | optional | optional | optional | optional | optional | optional | required | required | optional | optional | optional |
| `publisher` | text | optional | optional | required | required | required | optional | optional | n/a | n/a | optional | required | optional |
| `edition` | text | optional | optional | optional | optional | optional | n/a | n/a | n/a | n/a | n/a | optional | optional |
| `volume` | text | n/a | n/a | optional | optional | optional | n/a | n/a | n/a | n/a | n/a | optional | n/a |
| `printed_volume` | number | n/a | n/a | optional | optional | optional | n/a | n/a | n/a | n/a | n/a | optional | n/a |
| `printed_issue` | number | n/a | n/a | optional | optional | optional | n/a | n/a | n/a | n/a | n/a | optional | n/a |

`language` uses a plain text control rather than `select`: no language enum exists anywhere in this codebase today (every existing header is hardcoded `"en"`), so a dropdown would need an invented option list this feature has no basis for. `citationType` itself remains a `select`, drawn from the existing `SourceType` union.

Always read-only, all types: `resource` (file path), `timestamp` (conversion time), `pages` (PDF page count), `type` (legacy label, preserved verbatim — not governed by this schema at all, per FR-011).

This table reflects the field set already produced by `okf_header()` in `scripts/lib/wiki_convert.py`; it does not add any new frontmatter property. It's a plain constant in `wiki-header-schema.ts` — adjusting an individual type's row (e.g., if a real "map" header turns out to need `edition`) is a one-line code change, not a migration.

## Validation Rules

- A save is rejected if any property marked `required` for the header's current `citation_type` is empty.
- A save is rejected if a `number`-control property (`printed_volume`, `printed_issue`) holds a non-numeric value.
- A property marked `n/a` for the current citation type is never written to the saved header, even if a stale value exists from a prior citation type.
- `citation_type` itself must be one of the 12 known `SourceType` values; an unrecognized on-disk value is surfaced distinctly in the form (FR-010) and blocks save until corrected.
- `resource`, `timestamp`, `pages`, and `type` are never included in the editable/validated field set — they pass through unchanged from the file's existing header (system-derived or explicitly preserved).

## State / Lifecycle

1. Operator opens the header editor → `WIKI_GET_HEADER` returns `{ citationType, fields: Record<string,string>, preserved: { type, resource, timestamp, pages } }`.
2. Operator edits fields and/or changes `citationType` → form re-renders visible fields per the Header Schema Table; values for fields shared between old and new type are retained, others dropped from the in-memory draft.
3. Operator saves → renderer sends `{ citationType, fields }` via `WIKI_SAVE_HEADER`; main process validates against `wiki-header-schema.ts`, and on success serializes `preserved` properties plus the schema-selected fields into frontmatter text, writes the file, and returns `{ ok: true }`. On failure, returns `{ ok: false, errors: [...] }` and the file is untouched.

No multi-step or asynchronous state machine — each open/edit/save is a single request/response pair, matching the existing `wiki:getHeader`/`wiki:saveHeader` shape.
