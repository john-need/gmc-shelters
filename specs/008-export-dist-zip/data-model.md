# Data Model: Export Dist Zip (008)

## ShelterManifest (JSON output contract)

The manifest is a JSON file written to `shelter-manifest.json` in the export archive root.

### Top-level structure

```ts
interface Manifest {
  created: string;      // ISO 8601 UTC timestamp of build time
  shelters: ShelterEntry[];
}
```

### ShelterEntry

All field names are **camelCase** (converted from snake_case DB columns).

```ts
interface ShelterEntry {
  // DB fields (existing)
  id: number;
  name: string;
  slug: string;
  startYear: number;
  endYear: number | null;
  description: string;        // plain text (DB field, markdown-stripped)
  longitude: number | null;   // from first map marker or null
  latitude: number | null;    // from first map marker or null
  defaultPhotoId: number | null;
  isGmc: boolean;
  architecture: string;       // resolved from architectures JOIN
  builtBy: string;            // resolved from builders JOIN
  notes: string;
  created: string;
  updated: string;            // DB record last-modified date (required per FR-012)
  isExtant: boolean;
  category: string;           // resolved from categories JOIN

  // New fields (this feature)
  historyFile: string | null; // "{slug}/{slug}.md" relative path, or null if absent
  historyUpdated: string | null; // ISO 8601 mtime of {slug}.md, or null if absent

  // Nested collections
  mapMarkers: MapMarkerEntry[];
  photos: PhotoEntry[];
  content: string;            // plain text of {slug}.md (markdown-stripped), empty string if absent
}
```

### MapMarkerEntry

Sourced from the `map_markers` table (replaces deprecated `timelines` table).

```ts
interface MapMarkerEntry {
  id: number | null;
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  shelterId: number;
  startYear: number;
  endYear: number | null;
  changeType: string;         // 'Original' | 'Moved' | 'Renamed' | 'Moved & Renamed'
  isExtant: boolean;
  slug: string;               // denormalised from parent shelter for consumer convenience
  defaultPhotoId: number | null;
}
```

### PhotoEntry

Sourced from the `photos` table, filtered to `include_in_post = 1` and file-exists.
The `include_in_post` column is excluded from the manifest output.

```ts
interface PhotoEntry {
  id: number;
  photographer: string;
  fileName: string;           // relative path: "{slug}/{filename}"
  caption: string;
  dateTaken: string;
  notes: string;
  created: string;
  updated: string;            // DB record last-modified date (required per FR-012)
  shelterId: number;
  altText: string;
  title: string;
  description: string;
}
```

---

## DB Queries (TypeScript builder)

### Shelters (show_on_web only)

```sql
SELECT s.id, s.name, s.slug, s.start_year, s.end_year, s.description,
       s.default_photo_id, s.is_gmc, s.notes, s.created, s.updated,
       s.is_extant, s.show_on_web,
       a.name          AS architecture,
       c.category_name AS category,
       b.name          AS built_by
FROM shelters s
LEFT JOIN architectures a ON a.id = s.architecture_id
LEFT JOIN categories    c ON c.id = s.category_id
LEFT JOIN builders      b ON b.id = s.builder_id
WHERE s.show_on_web = 1
ORDER BY s.id
```

### Photos (include_in_post only)

```sql
SELECT id, photographer, file_name, caption, date_taken, notes,
       created, updated, shelter_id, alt_text, title, description
FROM photos
WHERE include_in_post = 1
ORDER BY id
```

### Map Markers

```sql
SELECT id, shelter_id, latitude, longitude, name, start_year, end_year,
       change_type, is_extant, notes, default_photo_id
FROM map_markers
ORDER BY shelter_id, start_year
```

Note: `map_markers` does not have a `default_photo_id` column. The `defaultPhotoId` in
`MapMarkerEntry` is denormalised from the parent shelter — set during assembly.

---

## Export Archive Layout

```
gmc-shelters-export-YYYYMMDD.zip
├── shelter-manifest.json          ← Manifest (top-level)
└── {slug}/
    ├── {slug}.md                  ← History file (if exists)
    └── {photo-filename}           ← One file per include_in_post photo (if exists on disk)
```

`historyFile` in each `ShelterEntry` is `"{slug}/{slug}.md"` — matching the path inside the
archive where the history file is stored.

---

## TypeScript module boundaries

```
src/main/export/
├── builder.ts      ← DB queries + shelter assembly + historyFile/historyUpdated
├── zipper.ts       ← Takes build dir path, produces zip at dest path using archiver
└── index.ts        ← Orchestrator: build → zip temp dir → dialog → copy to dest → cleanup
```

All three modules are pure (no IPC, no Electron APIs except `app.getAppPath()` in index.ts).
The IPC handler in `src/main/ipc/export.ts` is the only Electron-aware entry point.
