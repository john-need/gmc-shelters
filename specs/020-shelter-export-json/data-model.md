# Data Model: Shelter Export as Normalized JSON

All shapes below are the *output* (normalized, camelCase) types in `src/types/`, produced from raw
SQLite rows by the matching factory in `src/factories/`. Nothing here is a new entity — this
documents how the existing `shelters`/`photos`/`sources`/`map_markers`/`architectures`/
`categories`/`builders` tables map onto the export payload.

## ShelterExportPackage (the `.zip` archive)

The root of the exported package. Not a TypeScript type — the physical archive layout.

```text
gmc-shelters-export-YYYYMMDD.zip
├── shelters.json
├── {slug-1}/
│   ├── {slug-1}.md          (when a history file exists)
│   └── {photo files...}
├── {slug-2}/
│   └── {photo files...}
└── ...
```

- One folder per shelter, named for the shelter's `slug` (Assumption: slug, not display name —
  URL-safe, DB-enforced unique via `shelters_slug_uindex`).
- A shelter with no history file or no photos simply has a smaller (or absent) folder — no error.

## `shelters.json` (top level)

```ts
{
  shelters: Shelter[];             // src/types/shelter.ts — every shelter, no filtering
  architectures: Architecture[];   // src/types/architecture.ts — every architectures row
  shelterCategories: ShelterCategory[]; // src/types/shelter-category.ts — every categories row
  builders: Builder[];             // src/types/builder.ts — every builders row
}
```

`architectures`/`shelterCategories`/`builders` are complete lookup tables (FR-004) — independent
of which shelters reference them. The same objects (by value, not reference — this is JSON) are
embedded again inside each shelter entry that uses them.

## Shelter (`src/types/shelter.ts`, built by `makeShelter`)

| Field | Type | Notes |
|---|---|---|
| `id` | `number` | |
| `name` | `string` | |
| `startYear` | `number` | |
| `endYear` | `number \| null` | |
| `description` | `string \| null` | |
| `slug` | `string` | Also the export folder name |
| `defaultPhotoId` | `number \| null` | |
| `isGMC` | `boolean` | |
| `architecture` | `Architecture \| null` | **Changed by this feature**: was required, now nullable (Clarification Q3). Import corrected to `./architecture`. |
| `builder` | `Builder \| null` | **Changed by this feature**: was required, now nullable (Clarification Q3) |
| `category` | `ShelterCategory \| null` | **Changed by this feature**: was required, now nullable (Clarification Q3) |
| `notes` | `string \| null` | |
| `created` / `updated` | `string` | |
| `showOnWeb` | `boolean` | Present but **no longer used to filter** the export (FR-006) |
| `history` | `string \| null` | Raw path string (e.g. `slug/slug.md`); the actual file is copied into the shelter's export folder (FR-011), not inlined here |
| `photos` | `Photo[]` | Every photo row for this shelter — `include_in_post` no longer filters (FR-006) |
| `sources` | `Source[]` | Every source linked via `shelter_sources` |
| `mapMarkers` | `MapMarker[]` | Every map marker row for this shelter |

## Architecture / ShelterCategory / Builder

Plain reference records — `src/types/architecture.ts`, `shelter-category.ts`, `builder.ts`
(already built this session, unchanged by this feature). Each has `id`, a name field
(`name` / `categoryName` / `name`), and audit fields (`created`/`updated`); `Architecture`/
`ShelterCategory` also have a nullable `description`.

## Photo / Source / MapMarker

Unchanged from `src/types/photo.ts`, `source.ts`, `map-marker.ts` (already built this session).
Nested inside each `Shelter` entry via `makePhoto`/`makeSource`/`makeMapMarker`; not filtered by
`includeInPost` (photos) or any equivalent flag (sources, map markers have none).

## Relationships

- `Shelter.architecture` ← `shelters.architecture_id` → `architectures.id` (nullable FK)
- `Shelter.builder` ← `shelters.builder_id` → `builders.id` (nullable FK)
- `Shelter.category` ← `shelters.category_id` → `categories.id` (nullable FK)
- `Shelter.photos` ← `photos.shelter_id` → `shelters.id` (one-to-many)
- `Shelter.sources` ← `shelter_sources` join → `sources.id` (many-to-many, denormalized to a flat
  per-shelter list — no `shelter_sources`-only fields like `annotation`/`quote` are part of
  `src/types/source.ts`; those remain a known gap noted in ADR 0011, out of scope here)
- `Shelter.mapMarkers` ← `map_markers.shelter_id` → `shelters.id` (one-to-many)

No state transitions or lifecycle rules apply — this is a read-only export of current data.
