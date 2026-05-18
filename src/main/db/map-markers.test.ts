import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import {
  getMarkersByShelter,
  insertMapMarker,
  updateMapMarker,
  deleteMapMarker,
} from './map-markers';

jest.mock('./connection');
import { getDb } from './connection';

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, '../../../database/migrations/003-add-map-markers-table.sql'),
  'utf8',
);

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
  ${MIGRATION_SQL}
`;

function makeShelter(db: Database.Database, overrides: Record<string, unknown> = {}): { id: number; slug: string; is_extant: number; default_photo_id: number | null; start_year: number; end_year: number | null } {
  const o = { slug: 'test-shelter', is_extant: 1, default_photo_id: null, start_year: 1960, end_year: 1990, ...overrides };
  db.exec(`INSERT INTO shelters (name, slug, is_extant, default_photo_id, start_year, end_year, created, updated)
    VALUES ('Test', '${o.slug}', ${o.is_extant}, ${o.default_photo_id ?? 'NULL'}, ${o.start_year}, ${o.end_year ?? 'NULL'}, '2020-01-01', '2020-01-01')`);
  const row = db.prepare('SELECT id, slug, is_extant, default_photo_id, start_year, end_year FROM shelters ORDER BY id DESC LIMIT 1').get() as { id: number; slug: string; is_extant: number; default_photo_id: number | null; start_year: number; end_year: number | null };
  return row;
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
      db.exec(`INSERT INTO map_markers (shelter_id, latitude, longitude, name, start_year, end_year, change_type, slug, is_extant) VALUES
        (${shelter.id}, 44.0, -71.0, 'B', 1975, 1990, 'Relocated', 'test-shelter', 1),
        (${shelter.id}, 44.0, -71.0, 'A', 1960, 1975, 'Original', 'test-shelter', 1)`);
      const markers = getMarkersByShelter(shelter.id);
      expect(markers[0].name).toBe('A');
      expect(markers[1].name).toBe('B');
    });

    it('converts is_extant integer to boolean', () => {
      db.exec(`INSERT INTO map_markers (shelter_id, latitude, longitude, name, start_year, end_year, change_type, slug, is_extant) VALUES
        (${shelter.id}, 44.0, -71.0, 'X', 1960, 1990, 'Original', 'test-shelter', 1)`);
      const [marker] = getMarkersByShelter(shelter.id);
      expect(typeof marker.is_extant).toBe('boolean');
      expect(marker.is_extant).toBe(true);
    });

    it('does not return markers from other shelters', () => {
      const other = makeShelter(db, { slug: 'other' });
      db.exec(`INSERT INTO map_markers (shelter_id, latitude, longitude, name, start_year, end_year, change_type, slug, is_extant) VALUES
        (${other.id}, 44.0, -71.0, 'Other', 1960, 1990, 'Original', 'other', 1)`);
      expect(getMarkersByShelter(shelter.id)).toEqual([]);
    });
  });

  describe('insertMapMarker', () => {
    it('inserts a marker and returns it', () => {
      const marker = insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.1234,
        longitude: -71.5678,
        name: 'Original Site',
        start_year: 1960,
        end_year: 1990,
        change_type: 'Original',
        notes: '',
      }, shelter);
      expect(marker.id).toBeGreaterThan(0);
      expect(marker.shelter_id).toBe(shelter.id);
      expect(marker.latitude).toBe(44.1234);
      expect(marker.name).toBe('Original Site');
    });

    it('copies denormalized fields from shelter', () => {
      const marker = insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.0,
        longitude: -71.0,
        name: 'X',
        start_year: 1960,
        end_year: 1990,
        change_type: 'Original',
        notes: '',
      }, shelter);
      expect(marker.slug).toBe(shelter.slug);
      expect(marker.is_extant).toBe(Boolean(shelter.is_extant));
      expect(marker.photo_id).toBe(shelter.default_photo_id);
    });

    it('returns is_extant as boolean', () => {
      const marker = insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.0,
        longitude: -71.0,
        name: 'X',
        start_year: 1960,
        end_year: 1990,
        change_type: 'Original',
        notes: '',
      }, shelter);
      expect(typeof marker.is_extant).toBe('boolean');
    });
  });

  describe('updateMapMarker', () => {
    it('updates user-editable fields and returns updated marker', () => {
      const created = insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.0,
        longitude: -71.0,
        name: 'Old Name',
        start_year: 1960,
        end_year: 1980,
        change_type: 'Original',
        notes: '',
      }, shelter);
      const updated = updateMapMarker(db, created.id, {
        shelter_id: shelter.id,
        latitude: 45.0,
        longitude: -72.0,
        name: 'New Name',
        start_year: 1960,
        end_year: 1980,
        change_type: 'Relocated',
        notes: 'updated',
      });
      expect(updated.name).toBe('New Name');
      expect(updated.latitude).toBe(45.0);
      expect(updated.change_type).toBe('Relocated');
    });
  });

  describe('deleteMapMarker', () => {
    it('removes the marker from the database', () => {
      const marker = insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.0,
        longitude: -71.0,
        name: 'X',
        start_year: 1960,
        end_year: 1990,
        change_type: 'Original',
        notes: '',
      }, shelter);
      deleteMapMarker(db, marker.id);
      expect(getMarkersByShelter(shelter.id)).toHaveLength(0);
    });
  });

  describe('cascade delete', () => {
    it('removes markers when shelter is deleted', () => {
      db.pragma('foreign_keys = ON');
      insertMapMarker(db, {
        shelter_id: shelter.id,
        latitude: 44.0,
        longitude: -71.0,
        name: 'X',
        start_year: 1960,
        end_year: 1990,
        change_type: 'Original',
        notes: '',
      }, shelter);
      db.exec(`DELETE FROM shelters WHERE id = ${shelter.id}`);
      const rows = db.prepare('SELECT * FROM map_markers WHERE shelter_id = ?').all(shelter.id);
      expect(rows).toHaveLength(0);
    });
  });
});
