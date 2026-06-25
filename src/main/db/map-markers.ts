import type Database from 'better-sqlite3';
import { getDb } from './connection';
import type { MapMarker, MapMarkerCreateInput } from '../../shared/ipc-types';

interface MapMarkerRow {
  id: number;
  shelter_id: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  end_year: number | null;
  change_type: string;
  notes: string;
  is_extant: number;
  photo_id: number | null;
  created: string;
  updated: string;
}

function rowToMapMarker(row: MapMarkerRow): MapMarker {
  return {
    id: row.id,
    shelter_id: row.shelter_id,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    start_year: row.start_year,
    end_year: row.end_year,
    change_type: row.change_type as MapMarker['change_type'],
    notes: row.notes,
    is_extant: Boolean(row.is_extant),
    photo_id: row.photo_id,
    created: row.created,
    updated: row.updated,
  };
}

export function getMarkerById(id: number): MapMarker | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM map_markers WHERE id = ?').get(id) as MapMarkerRow | undefined;
  return row ? rowToMapMarker(row) : null;
}

export function getMarkersByShelter(shelterId: number): MapMarker[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM map_markers WHERE shelter_id = ? ORDER BY start_year ASC')
    .all(shelterId) as MapMarkerRow[];
  return rows.map(rowToMapMarker);
}

export function insertMapMarker(
  db: Database.Database,
  input: MapMarkerCreateInput,
  shelter: { is_extant: number | boolean; default_photo_id: number | null },
): void {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO map_markers
       (shelter_id, latitude, longitude, name, start_year, end_year, change_type, notes,
        is_extant, photo_id, created, updated)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.shelter_id,
    input.latitude,
    input.longitude,
    input.name,
    input.start_year,
    input.end_year,
    input.change_type,
    input.notes,
    shelter.is_extant ? 1 : 0,
    shelter.default_photo_id ?? null,
    today,
    today,
  );
}

export function updateMapMarker(
  db: Database.Database,
  id: number,
  input: { latitude: number; longitude: number; name: string; start_year: number; end_year: number | null; change_type: string; notes: string },
): MapMarker {
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE map_markers SET
       latitude = ?, longitude = ?, name = ?, start_year = ?, end_year = ?,
       change_type = ?, notes = ?, updated = ?
     WHERE id = ?`,
  ).run(
    input.latitude,
    input.longitude,
    input.name,
    input.start_year,
    input.end_year,
    input.change_type,
    input.notes,
    today,
    id,
  );
  return rowToMapMarker(
    db.prepare('SELECT * FROM map_markers WHERE id = ?').get(id) as MapMarkerRow,
  );
}

export function deleteMapMarker(db: Database.Database, id: number): void {
  db.prepare('DELETE FROM map_markers WHERE id = ?').run(id);
}

export function syncMarkersFromShelter(shelter: {
  id: number;
  is_extant: boolean;
  default_photo_id: number | null;
}): void {
  const db = getDb();
  db.prepare(
    'UPDATE map_markers SET is_extant = ?, photo_id = ? WHERE shelter_id = ?',
  ).run(shelter.is_extant ? 1 : 0, shelter.default_photo_id ?? null, shelter.id);
}
