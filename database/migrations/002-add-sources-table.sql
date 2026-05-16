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
