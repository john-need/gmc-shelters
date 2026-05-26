-- Migration: 006-move-quote-to-shelter-sources.sql
-- Moves verbatim quote from sources.quote (source-level) to shelter_sources.quote
-- (per-citation). See ADR 0002 and CONTEXT.md for rationale.
--
-- A source shared by multiple shelters gets the same quote value propagated to
-- every shelter_sources row for that source — the correct starting point for
-- per-citation editing.

PRAGMA foreign_keys = OFF;
BEGIN;

-- Copy quote values from sources into every matching shelter_sources row.
UPDATE shelter_sources
SET quote = COALESCE(
  (SELECT s.quote FROM sources s WHERE s.id = shelter_sources.source_id),
  ''
);

-- Rebuild sources without the quote column.
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
