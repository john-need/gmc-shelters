-- Migration: 004-5nf-normalisation.sql
-- Implements all decisions from the 5NF grilling session (2026-05-18).
-- See ADRs 0001, 0002, 0003 and CONTEXT.md for rationale.
--
-- SQLite does not support DROP COLUMN or ADD CONSTRAINT on existing tables,
-- so tables that need structural changes are rebuilt via CREATE + INSERT + DROP + RENAME.

PRAGMA foreign_keys = OFF;
BEGIN;

-- ============================================================
-- 1. Add `builders` lookup table
-- ============================================================
CREATE TABLE IF NOT EXISTS builders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'organization' CHECK (type IN ('individual','organization')),
  notes       TEXT NOT NULL DEFAULT '',
  created     TEXT NOT NULL DEFAULT (date('now')),
  updated     TEXT NOT NULL DEFAULT (date('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS builders_name_uindex ON builders (name);

-- ============================================================
-- 2. Rebuild `shelters`
--    - Drop:  latitude, longitude, architecture (TEXT), category (TEXT), built_by (TEXT)
--    - Add:   architecture_id FK, category_id FK, builder_id FK
-- ============================================================

-- Seed builders from existing built_by values (skips blanks and placeholder)
INSERT OR IGNORE INTO builders (name)
SELECT DISTINCT built_by
FROM shelters
WHERE built_by IS NOT NULL
  AND built_by != ''
  AND built_by != '1234567890';

CREATE TABLE shelters_new (
  id               INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  name             TEXT,
  start_year       INTEGER,
  end_year         INTEGER,
  description      TEXT,
  slug             TEXT NOT NULL,
  default_photo_id INTEGER,
  is_gmc           INTEGER,
  architecture_id  INTEGER REFERENCES architectures(id),
  builder_id       INTEGER REFERENCES builders(id),
  notes            TEXT,
  created          TEXT,
  updated          TEXT,
  is_extant        INTEGER,
  category_id      INTEGER REFERENCES categories(id),
  show_on_web      INTEGER DEFAULT 1
);

-- Copy data, resolving TEXT → FK for architecture and category.
-- architecture: match on name (case-insensitive, trimmed).
-- category: match on category_name.
-- built_by: match on builder name.
-- Unmatched values (no row in lookup) become NULL; review afterwards.
INSERT INTO shelters_new
  (id, name, start_year, end_year, description, slug, default_photo_id,
   is_gmc, architecture_id, builder_id, notes, created, updated, is_extant,
   category_id, show_on_web)
SELECT
  s.id,
  s.name,
  s.start_year,
  s.end_year,
  s.description,
  s.slug,
  s.default_photo_id,
  s.is_gmc,
  (SELECT a.id FROM architectures a
   WHERE TRIM(LOWER(a.name)) = TRIM(LOWER(s.architecture))
   LIMIT 1),
  (SELECT b.id FROM builders b
   WHERE b.name = s.built_by
   LIMIT 1),
  s.notes,
  s.created,
  s.updated,
  s.is_extant,
  (SELECT c.id FROM categories c
   WHERE TRIM(LOWER(c.category_name)) = TRIM(LOWER(s.category))
   LIMIT 1),
  s.show_on_web
FROM shelters s;

DROP TABLE shelters;
ALTER TABLE shelters_new RENAME TO shelters;

CREATE INDEX IF NOT EXISTS shelters_name_index ON shelters (name);
CREATE UNIQUE INDEX IF NOT EXISTS shelters_slug_uindex ON shelters (slug);

-- ============================================================
-- 3. Rebuild `map_markers`
--    - Drop:  slug (derived from shelters.slug)
--    - Add:   CHECK on change_type
--    - Keep:  latitude, longitude, start_year, end_year, name,
--             change_type, is_extant, notes, photo_id, shelter_id
-- ============================================================
CREATE TABLE map_markers_new (
  id          INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  shelter_id  INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  latitude    REAL    NOT NULL,
  longitude   REAL    NOT NULL,
  name        TEXT    NOT NULL DEFAULT '',
  start_year  INTEGER NOT NULL,
  end_year    INTEGER,
  change_type TEXT    NOT NULL DEFAULT 'Original'
                      CHECK (change_type IN ('Original','Moved','Renamed','Moved & Renamed')),
  is_extant   INTEGER NOT NULL DEFAULT 0,
  notes       TEXT    NOT NULL DEFAULT '',
  photo_id    INTEGER REFERENCES photos(id),
  created     TEXT    NOT NULL DEFAULT (date('now')),
  updated     TEXT    NOT NULL DEFAULT (date('now'))
);

INSERT INTO map_markers_new
  (id, shelter_id, latitude, longitude, name, start_year, end_year,
   change_type, is_extant, notes, photo_id)
SELECT
  id, shelter_id, latitude, longitude, name, start_year, end_year,
  change_type, is_extant, notes, photo_id
FROM map_markers;

DROP TABLE map_markers;
ALTER TABLE map_markers_new RENAME TO map_markers;

CREATE INDEX IF NOT EXISTS idx_map_markers_shelter ON map_markers (shelter_id);

-- ============================================================
-- 4. Migrate `timelines` → `map_markers`, then drop `timelines`
--    timelines columns: id, name, latitude, longitude, notes, shelter_id, year
--    Maps to: name, latitude, longitude, notes, shelter_id, start_year=year,
--             end_year=NULL (unknown — mark for review), change_type='Original'
-- ============================================================
INSERT INTO map_markers
  (shelter_id, latitude, longitude, name, start_year, end_year,
   change_type, is_extant, notes)
SELECT
  t.shelter_id,
  t.latitude,
  t.longitude,
  t.name,
  t.year,           -- start_year
  NULL,             -- end_year unknown; review after migration
  'Original',       -- default change_type
  0,                -- is_extant unknown; review after migration
  t.notes
FROM timelines t
WHERE t.shelter_id IS NOT NULL
  AND t.latitude  IS NOT NULL
  AND t.longitude IS NOT NULL;

DROP TABLE timelines;

-- ============================================================
-- 5. Normalise `sources` — remove shelter_id, move annotation/notes
--    to `shelter_sources` join table
-- ============================================================
CREATE TABLE shelter_sources (
  shelter_id  INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  source_id   INTEGER NOT NULL REFERENCES sources(id)  ON DELETE CASCADE,
  annotation  TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (shelter_id, source_id)
);

-- Migrate existing shelter_id + annotation + notes from sources rows
-- (sources is currently empty, but the migration is idempotent if rows exist)
INSERT OR IGNORE INTO shelter_sources (shelter_id, source_id, annotation, notes)
SELECT shelter_id, id, annotation, notes
FROM sources
WHERE shelter_id IS NOT NULL;

-- Rebuild sources without shelter_id, annotation, notes
CREATE TABLE sources_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
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
  created          TEXT NOT NULL DEFAULT (date('now')),
  updated          TEXT NOT NULL DEFAULT (date('now'))
);

INSERT INTO sources_new
  (id, type, author, title, container_title, editor, edition, volume, issue,
   pages, publisher, place, year, date, url, access_date, archive,
   archive_location, created, updated)
SELECT
  id, type, author, title, container_title, editor, edition, volume, issue,
  pages, publisher, place, year, date, url, access_date, archive,
  archive_location, created, updated
FROM sources;

DROP TABLE sources;
ALTER TABLE sources_new RENAME TO sources;

CREATE INDEX IF NOT EXISTS idx_sources_title ON sources (title);

COMMIT;
PRAGMA foreign_keys = ON;

-- ============================================================
-- Post-migration review queries (run manually to inspect gaps)
-- ============================================================
-- Shelters with unresolved architecture (architecture_id IS NULL but had a text value):
--   SELECT id, name FROM shelters WHERE architecture_id IS NULL;
--
-- map_markers imported from timelines (end_year IS NULL — need review):
--   SELECT * FROM map_markers WHERE end_year IS NULL AND is_extant = 0;

