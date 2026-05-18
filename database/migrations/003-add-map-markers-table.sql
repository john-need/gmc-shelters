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
  slug        TEXT    NOT NULL DEFAULT '',
  is_extant   INTEGER NOT NULL DEFAULT 0,
  photo_id    INTEGER,
  created     TEXT    NOT NULL DEFAULT (date('now')),
  updated     TEXT    NOT NULL DEFAULT (date('now'))
);

CREATE INDEX IF NOT EXISTS idx_map_markers_shelter ON map_markers(shelter_id);
