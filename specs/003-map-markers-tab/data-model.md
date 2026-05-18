# Data Model: Map Markers Tab

**Branch**: `003-map-markers-tab` | **Date**: 2026-05-16

---

## SQL Migration

```sql
-- database/migrations/003-add-map-markers-table.sql

CREATE TABLE IF NOT EXISTS map_markers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  shelter_id  INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  latitude    REAL    NOT NULL,
  longitude   REAL    NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  start_year  INTEGER NOT NULL,
  end_year    INTEGER,
  change_type TEXT    NOT NULL DEFAULT 'Original',
  notes       TEXT    NOT NULL DEFAULT '',
  -- Denormalized copies from parent shelter (kept in sync via SHELTERS_UPDATE handler)
  slug        TEXT    NOT NULL DEFAULT '',
  is_extant   INTEGER NOT NULL DEFAULT 0,
  photo_id    INTEGER,
  created     TEXT    NOT NULL DEFAULT (date('now')),
  updated     TEXT    NOT NULL DEFAULT (date('now'))
);

CREATE INDEX IF NOT EXISTS idx_map_markers_shelter ON map_markers(shelter_id);
```

---

## TypeScript Types

```ts
// In src/shared/ipc-types.ts

export const CHANGE_TYPES = [
  'Original',
  'Relocated',
  'Rebuilt',
  'Destroyed',
  'Removed',
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number] | `Other: ${string}`;

export interface MapMarker {
  id: number;
  shelter_id: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  end_year: number | null;
  change_type: ChangeType;
  notes: string;
  // Denormalized from parent shelter — read-only on marker
  slug: string;
  is_extant: boolean;
  photo_id: number | null;
  created: string;
  updated: string;
}

// Fields the user may set when creating or editing a marker
export type MapMarkerInput = {
  shelter_id: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  end_year: number | null;
  change_type: ChangeType;
  notes: string;
};
```

---

## Field Reference

| Field         | Type            | Nullable | Editable by user | Notes |
|---------------|-----------------|----------|------------------|-------|
| `id`          | INTEGER PK      | No       | No               | Auto-assigned |
| `shelter_id`  | INTEGER FK      | No       | No               | Parent shelter; CASCADE on delete |
| `latitude`    | REAL            | No       | Yes              | Range: −90 to 90 |
| `longitude`   | REAL            | No       | Yes              | Range: −180 to 180 |
| `name`        | TEXT            | No       | Yes              | Display label for the marker |
| `start_year`  | INTEGER         | No       | Yes              | Inclusive lower bound of active period |
| `end_year`    | INTEGER         | Yes      | Yes              | Null only when shelter.is_extant = true AND this is the last marker |
| `change_type` | TEXT            | No       | Yes              | Picklist value or `"Other: <custom text>"` |
| `notes`       | TEXT            | No       | Yes              | Free-form archivist notes |
| `slug`        | TEXT            | No       | No               | Denormalized from `shelters.slug` |
| `is_extant`   | INTEGER (0/1)   | No       | No               | Denormalized from `shelters.is_extant` |
| `photo_id`    | INTEGER         | Yes      | No               | Denormalized from `shelters.default_photo_id` |
| `created`     | TEXT (ISO date) | No       | No               | Set on insert |
| `updated`     | TEXT (ISO date) | No       | No               | Set on update |

---

## Validation Rules

### Coordinate Range (FR-007)
- `latitude`: must be in `[-90, 90]`; `null` / missing is rejected
- `longitude`: must be in `[-180, 180]`; `null` / missing is rejected

### End Year Nullability (FR-009)
- `end_year` may be `null` **only when**:
  1. `shelter.is_extant = true`, **AND**
  2. this marker has the highest `start_year` among all markers for the shelter

### Year Coverage Constraint (FR-011)
After any create or update, the handler loads all markers for the shelter and checks:

1. Sort markers by `start_year` ascending.
2. No two markers may share the same `start_year` (duplicate check).
3. For each consecutive pair: `markers[i].end_year` MUST EQUAL `markers[i+1].start_year` — exact adjacency. Greater than = overlap (invalid); less than = gap (invalid).
4. The first marker's `start_year` must equal `shelter.start_year`.
5. The last marker's `end_year` must equal `shelter.end_year` — OR be `null` when `shelter.is_extant = true`.
6. If any gap, overlap, or duplicate `start_year` is found, block the save and describe the problem (e.g., `"Year range 1971–1974 is not covered"` or `"Markers 1960–1975 and 1970–1980 overlap"`).

### Change Type Format
- Standard picklist value: stored verbatim (e.g., `"Relocated"`)
- "Other" with custom text: stored as `"Other: <custom text>"` (colon-space delimiter)
- UI reconstructs both parts by splitting on the first `": "`

---

## Denormalized Field Sync (FR-012)

When `SHELTERS_UPDATE` runs, immediately follow the shelter `UPDATE` with:

```sql
UPDATE map_markers
SET slug = ?, is_extant = ?, photo_id = ?
WHERE shelter_id = ?
```

Parameters: `[shelter.slug, shelter.is_extant ? 1 : 0, shelter.default_photo_id, shelter.id]`

This runs synchronously in the same `better-sqlite3` call chain — no separate IPC round-trip.

---

## Entity Relationships

```
shelters 1 ──< map_markers N
  shelters.id         → map_markers.shelter_id (FK, CASCADE DELETE)
  shelters.slug       → map_markers.slug       (denormalized, synced on shelter save)
  shelters.is_extant  → map_markers.is_extant  (denormalized, synced on shelter save)
  shelters.default_photo_id → map_markers.photo_id (denormalized, synced on shelter save)
```

---

## IPC API Surface

```ts
// Added to ElectronAPI in src/shared/ipc-types.ts
mapMarkers: {
  getByShelter: (shelterId: number) => Promise<MapMarker[]>;
  create: (input: MapMarkerInput) => Promise<MapMarker>;
  update: (id: number, input: MapMarkerInput) => Promise<MapMarker>;
  delete: (id: number) => Promise<void>;
};
```

### New CHANNELS constants

```ts
MAP_MARKERS_GET_BY_SHELTER: 'mapMarkers:getByShelter',
MAP_MARKERS_CREATE:          'mapMarkers:create',
MAP_MARKERS_UPDATE:          'mapMarkers:update',
MAP_MARKERS_DELETE:          'mapMarkers:delete',
```
