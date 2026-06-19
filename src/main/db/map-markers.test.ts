import Database from 'better-sqlite3';
import {
  getMarkersByShelter,
  insertMapMarker,
  updateMapMarker,
  deleteMapMarker,
  recomputeEndYears,
} from './map-markers';

jest.mock('./connection');
import { getDb } from './connection';

const SCHEMA = `
  CREATE TABLE shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL DEFAULT '',
    slug TEXT NOT NULL DEFAULT '',
    is_extant INTEGER NOT NULL DEFAULT 1,
    default_photo_id INTEGER,
    start_year INTEGER NOT NULL DEFAULT 2000,
    end_year INTEGER,
    created TEXT NOT NULL DEFAULT '2020-01-01',
    updated TEXT NOT NULL DEFAULT '2020-01-01'
  );
  CREATE TABLE map_markers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    shelter_id  INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    latitude    REAL    NOT NULL,
    longitude   REAL    NOT NULL,
    name        TEXT    NOT NULL DEFAULT '',
    start_year  INTEGER NOT NULL,
    end_year    INTEGER,
    change_type TEXT    NOT NULL DEFAULT 'Original',
    notes       TEXT    NOT NULL DEFAULT '',
    is_extant   INTEGER NOT NULL DEFAULT 0,
    photo_id    INTEGER,
    created     TEXT    NOT NULL DEFAULT (date('now')),
    updated     TEXT    NOT NULL DEFAULT (date('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_map_markers_shelter ON map_markers(shelter_id);
`;

function makeShelter(db: Database.Database, overrides: Record<string, unknown> = {}) {
  const o = { slug: 'test-shelter', is_extant: 1, default_photo_id: null, start_year: 1960, end_year: 1990, ...overrides };
  db.exec(`INSERT INTO shelters (name, slug, is_extant, default_photo_id, start_year, end_year, created, updated)
    VALUES ('Test', '${o.slug}', ${o.is_extant}, ${o.default_photo_id ?? 'NULL'}, ${o.start_year}, ${o.end_year ?? 'NULL'}, '2020-01-01', '2020-01-01')`);
  return db.prepare('SELECT id, is_extant, default_photo_id, start_year, end_year FROM shelters ORDER BY id DESC LIMIT 1').get() as
    { id: number; is_extant: number; default_photo_id: number | null; start_year: number; end_year: number | null };
}

function insertAndGet(db: Database.Database, shelter: ReturnType<typeof makeShelter>, overrides: Record<string, unknown> = {}) {
  const input = {
    shelter_id: shelter.id,
    latitude: 44.0,
    longitude: -71.0,
    name: 'X',
    start_year: 1960,
    change_type: 'Original' as const,
    notes: '',
    ...overrides,
  };
  insertMapMarker(db, input, shelter);
  const markers = getMarkersByShelter(shelter.id);
  return markers[markers.length - 1];
}

describe('db/map-markers', () => {
  let db: Database.Database;
  let shelter: ReturnType<typeof makeShelter>;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    (getDb as jest.Mock).mockReturnValue(db);
    shelter = makeShelter(db);
  });

  afterEach(() => db.close());

  describe('getMarkersByShelter', () => {
    it('returns empty array when no markers', () => {
      expect(getMarkersByShelter(shelter.id)).toEqual([]);
    });

    it('returns markers ordered by start_year ascending', () => {
      db.exec(`INSERT INTO map_markers (shelter_id, latitude, longitude, name, start_year, end_year, change_type, is_extant) VALUES
        (${shelter.id}, 44.0, -71.0, 'B', 1975, 1990, 'Moved', 1),
        (${shelter.id}, 44.0, -71.0, 'A', 1960, 1975, 'Original', 1)`);
      const markers = getMarkersByShelter(shelter.id);
      expect(markers[0].name).toBe('A');
      expect(markers[1].name).toBe('B');
    });

    it('converts is_extant integer to boolean', () => {
      db.exec(`INSERT INTO map_markers (shelter_id, latitude, longitude, name, start_year, end_year, change_type, is_extant) VALUES
        (${shelter.id}, 44.0, -71.0, 'X', 1960, 1990, 'Original', 1)`);
      const [marker] = getMarkersByShelter(shelter.id);
      expect(typeof marker.is_extant).toBe('boolean');
      expect(marker.is_extant).toBe(true);
    });

    it('does not return markers from other shelters', () => {
      const other = makeShelter(db, { slug: 'other' });
      db.exec(`INSERT INTO map_markers (shelter_id, latitude, longitude, name, start_year, end_year, change_type, is_extant) VALUES
        (${other.id}, 44.0, -71.0, 'Other', 1960, 1990, 'Original', 1)`);
      expect(getMarkersByShelter(shelter.id)).toEqual([]);
    });
  });

  describe('insertMapMarker', () => {
    it('inserts a marker and it appears in getMarkersByShelter', () => {
      insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.1234,
        longitude: -71.5678,
        name: 'Original Site',
        start_year: 1960,
        change_type: 'Original',
        notes: '',
      }, shelter);
      const markers = getMarkersByShelter(shelter.id);
      expect(markers).toHaveLength(1);
      expect(markers[0].shelter_id).toBe(shelter.id);
      expect(markers[0].latitude).toBe(44.1234);
      expect(markers[0].name).toBe('Original Site');
    });

    it('copies denormalized fields from shelter', () => {
      const marker = insertAndGet(db, shelter);
      expect(marker.is_extant).toBe(Boolean(shelter.is_extant));
      expect(marker.photo_id).toBe(shelter.default_photo_id);
    });

    it('returns is_extant as boolean', () => {
      const marker = insertAndGet(db, shelter);
      expect(typeof marker.is_extant).toBe('boolean');
    });
  });

  describe('updateMapMarker', () => {
    it('updates user-editable fields and returns updated marker', () => {
      const created = insertAndGet(db, shelter, { name: 'Old Name', latitude: 44.0, longitude: -71.0, change_type: 'Original' });
      const updated = updateMapMarker(db, created.id, {
        latitude: 45.0,
        longitude: -72.0,
        name: 'New Name',
        change_type: 'Moved',
        notes: 'updated',
      });
      expect(updated.name).toBe('New Name');
      expect(updated.latitude).toBe(45.0);
      expect(updated.change_type).toBe('Moved');
    });

    it('does not change start_year or end_year', () => {
      const created = insertAndGet(db, shelter, { start_year: 1960 });
      recomputeEndYears(db, shelter.id, shelter);
      const before = getMarkersByShelter(shelter.id)[0];

      updateMapMarker(db, created.id, {
        latitude: 45.0, longitude: -72.0, name: 'Updated', change_type: 'Original', notes: '',
      });
      const after = getMarkersByShelter(shelter.id)[0];
      expect(after.start_year).toBe(before.start_year);
      expect(after.end_year).toBe(before.end_year);
    });
  });

  describe('deleteMapMarker', () => {
    it('removes the marker from the database', () => {
      const marker = insertAndGet(db, shelter);
      deleteMapMarker(db, marker.id);
      expect(getMarkersByShelter(shelter.id)).toHaveLength(0);
    });
  });

  describe('recomputeEndYears', () => {
    it('sets end_year of each marker to the next marker start_year minus 1', () => {
      // Use a non-extant shelter so the last marker gets shelter.end_year (not null)
      const goneShelter = makeShelter(db, { slug: 'gone', is_extant: 0, end_year: 1990 });
      insertMapMarker(db, { shelter_id: goneShelter.id, latitude: 44, longitude: -71, name: 'A', start_year: 1960, change_type: 'Original', notes: '' }, goneShelter);
      insertMapMarker(db, { shelter_id: goneShelter.id, latitude: 44, longitude: -71, name: 'B', start_year: 1975, change_type: 'Moved', notes: '' }, goneShelter);
      recomputeEndYears(db, goneShelter.id, goneShelter);
      const markers = getMarkersByShelter(goneShelter.id);
      expect(markers[0].end_year).toBe(1974); // 1975 - 1
      expect(markers[1].end_year).toBe(goneShelter.end_year); // last marker of non-extant shelter → shelter end_year
    });

    it('sets null end_year for last marker when shelter is extant', () => {
      const extantShelter = makeShelter(db, { slug: 'extant', is_extant: 1, end_year: null });
      insertMapMarker(db, { shelter_id: extantShelter.id, latitude: 44, longitude: -71, name: 'A', start_year: 1960, change_type: 'Original', notes: '' }, extantShelter);
      recomputeEndYears(db, extantShelter.id, extantShelter);
      const markers = getMarkersByShelter(extantShelter.id);
      expect(markers[0].end_year).toBeNull();
    });
  });

  describe('cascade delete', () => {
    it('removes markers when shelter is deleted', () => {
      db.pragma('foreign_keys = ON');
      insertAndGet(db, shelter);
      db.exec(`DELETE FROM shelters WHERE id = ${shelter.id}`);
      const rows = db.prepare('SELECT * FROM map_markers WHERE shelter_id = ?').all(shelter.id);
      expect(rows).toHaveLength(0);
    });
  });
});
