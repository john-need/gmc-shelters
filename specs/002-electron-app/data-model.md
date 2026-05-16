# Data Model: GMC Shelters Electron App

**Feature**: 002-electron-app | **Date**: 2026-05-15

---

## Entities

### Shelter

Source of truth: `shelters` table in `database/gmc_shelters.sqlite`. **No schema changes** — the app reads and writes the existing table.

```typescript
interface Shelter {
  id: number;                  // PK, auto-increment
  name: string;                // required
  start_year: number;          // required
  end_year: number | null;     // null = extant
  description: string;
  slug: string;                // URL-safe, unique, used for filesystem path
  longitude: number | null;
  latitude: number | null;
  default_photo_id: number | null;  // FK → photos.id
  is_gmc: boolean;
  architecture: string;
  built_by: string;
  notes: string;               // internal only, not published
  created: string;             // ISO date
  updated: string;             // ISO date, updated on every write
  is_extant: boolean;
  category: string;            // enum: Lodge | Cabin | Shelter | Lean-to | Camp | Privy | Other
  show_on_web: boolean;
  // derived (computed, not stored):
  photo_count?: number;        // COUNT(*) from photos JOIN
}
```

**Derived fields**: `photo_count` is computed by the query layer (`db/shelters.ts`) using a LEFT JOIN — not stored in the shelters table.

**Validation rules**:
- `name` must be non-empty
- `start_year` must be a 4-digit year ≥ 1800
- `end_year` must be > `start_year` if present
- `slug` must match `/^[a-z0-9-]+$/`; auto-generated from `name` on new shelter creation (spaces → hyphens, lowercase, strip special chars)
- `latitude` must be in [42.0, 45.5] (Vermont bounding box) or null
- `longitude` must be in [-73.5, -71.5] (Vermont bounding box) or null

**Filesystem side effects on create**: `shelters/<slug>/`, `shelters/<slug>/photos/`, and `shelters/<slug>/history.md` are created by the main process when a new shelter record is INSERTed.

---

### Photo

Source of truth: `photos` table in `database/gmc_shelters.sqlite`. **No schema changes**.

```typescript
interface Photo {
  id: number;
  photographer: string;
  file_name: string;           // base name only, e.g. "birch-glen-001.jpg"
  caption: string;             // public
  date_taken: string;          // ISO date or empty
  notes: string;               // internal
  created: string;
  updated: string;
  shelter_id: number;          // FK → shelters.id
  alt_text: string;
  title: string;
  description: string;
  include_in_post: boolean;
  // derived (not stored):
  file_path?: string;          // resolved at query time: shelters/<slug>/photos/<file_name>
}
```

**Filesystem path**: `shelters/<shelter.slug>/photos/<photo.file_name>` relative to repo root.

**Upload behavior**: File copied to the above path; if a file of the same name already exists, a numeric suffix is appended (`_2`, `_3`, …) before copying and the stored `file_name` reflects the final name.

**Delete behavior**: DB row deleted first; file deleted from disk after successful DB delete. If file delete fails, error is logged but the DB delete is not rolled back (file orphan is acceptable; DB orphan is not).

**Set-as-default**: Updates `shelters.default_photo_id = photo.id` for the parent shelter record.

---

### Source (new entity)

Source of truth: **new** `sources` table, added via `database/migrations/002-add-sources-table.sql`.

```typescript
type SourceType =
  | 'book' | 'chapter' | 'journal' | 'newspaper' | 'magazine'
  | 'website' | 'archive' | 'manuscript' | 'interview' | 'map'
  | 'report' | 'other';

interface Source {
  id: number;
  shelter_id: number;          // FK → shelters.id
  type: SourceType;
  author: string;
  title: string;
  container_title: string;     // journal name, newspaper, website name, collection
  editor: string;
  edition: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  place: string;
  year: number | null;
  date: string;                // ISO date (for newspapers/magazines/websites)
  url: string;
  access_date: string;         // ISO date, for websites
  archive: string;
  archive_location: string;    // box, folder, call number
  annotation: string;          // visible in expanded card
  notes: string;               // internal
  created: string;
  updated: string;
}
```

**Chicago NB formatter**: Implemented as a pure TypeScript function in `src/shared/cite-chicago.ts`. Input is a `Source` object; output is an HTML string with `<em>` for italics and `<a>` for URLs. Ported from `data.js` `citeChicago()`.

**URL handling**: `shell.openExternal(url)` called via IPC channel `shell:openExternal` when a source URL is clicked in the renderer.

---

### HistoryDocument (filesystem, not SQLite)

```typescript
interface HistoryDocument {
  shelterId: number;
  slug: string;
  path: string;            // absolute: <repoRoot>/shelters/<slug>/history.md
  content: string;         // raw markdown
  wordCount: number;       // computed on read
}
```

Not stored in SQLite. The main process reads/writes the file directly. If the file does not exist, an empty template is returned and the file is created on first save.

---

## SQLite Migration

**File**: `database/migrations/002-add-sources-table.sql`

```sql
CREATE TABLE IF NOT EXISTS sources (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  shelter_id       INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  type             TEXT NOT NULL DEFAULT 'other',
  author           TEXT NOT NULL DEFAULT '',
  title            TEXT NOT NULL DEFAULT '',
  container_title  TEXT NOT NULL DEFAULT '',
  editor           TEXT NOT NULL DEFAULT '',
  edition          TEXT NOT NULL DEFAULT '',
  volume           TEXT NOT NULL DEFAULT '',
  issue            TEXT NOT NULL DEFAULT '',
  pages            TEXT NOT NULL DEFAULT '',
  publisher        TEXT NOT NULL DEFAULT '',
  place            TEXT NOT NULL DEFAULT '',
  year             INTEGER,
  date             TEXT NOT NULL DEFAULT '',
  url              TEXT NOT NULL DEFAULT '',
  access_date      TEXT NOT NULL DEFAULT '',
  archive          TEXT NOT NULL DEFAULT '',
  archive_location TEXT NOT NULL DEFAULT '',
  annotation       TEXT NOT NULL DEFAULT '',
  notes            TEXT NOT NULL DEFAULT '',
  created          TEXT NOT NULL DEFAULT (date('now')),
  updated          TEXT NOT NULL DEFAULT (date('now'))
);

CREATE INDEX IF NOT EXISTS idx_sources_shelter ON sources(shelter_id);
```

**Migration application**: At app startup, `db/connection.ts` checks for the presence of the `sources` table via `SELECT name FROM sqlite_master WHERE type='table' AND name='sources'`. If absent, the migration SQL is executed.

---

## Redux State Shape

```typescript
// src/store/sheltersSlice.ts
interface SheltersState {
  list: Shelter[];
  selectedId: number | null;
  editBuffer: Shelter | null;  // mutable copy for the Shelter tab form
  loading: boolean;
  saving: boolean;
  dirty: boolean;              // editBuffer differs from list[selectedId]
  historyContent: string;      // current history.md content
  historyDirty: boolean;       // history editor has unsaved changes
}

// src/store/photosSlice.ts
interface PhotosState {
  byShelter: Record<number, Photo[]>;
  loading: boolean;
  uploading: boolean;
}

// src/store/sourcesSlice.ts
interface SourcesState {
  byShelter: Record<number, Source[]>;
  loading: boolean;
}

// src/store/uiSlice.ts
interface UiState {
  sidebarCollapsed: boolean;
  activeTab: 'shelter' | 'history' | 'sources' | 'photos';
  query: string;
  filter: 'all' | 'extant' | 'gone' | 'gmc';
  advancedFilters: {
    yearMin: string;
    yearMax: string;
    architecture: string;
    builtBy: string;
    category: string;
    showOnWeb: 'any' | 'yes' | 'no';
  };
  toast: { id: string; message: string } | null;
}
```

---

## Derived / Computed Values

| Value | Computed Where | How |
|---|---|---|
| `photo_count` | `db/shelters.ts` | LEFT JOIN COUNT on `photos` |
| `is_extant` display | Sidebar, RecordHeader | `end_year === null` → "Extant"; else "Lost" |
| `slug` | `db/shelters.ts` on INSERT | `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')` |
| Sidebar filter counts | `uiSlice` selector | `list.filter(...)` on each filter type |
| Chicago citation HTML | `cite-chicago.ts` | Pure function, called in SourcesTab + modal |
| Filtered shelter list | `sheltersSlice` selector | Applies query + filter + advancedFilters to `list` |
| Word/char/line count | `HistoryTab` | Computed from textarea value on each change |
