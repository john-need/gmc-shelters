import { getDb } from './connection';
import type { Shelter, ShelterCreateInput } from '../../shared/ipc-types';

interface ShelterRow {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  description: string | null;
  slug: string;
  longitude: number | null;
  latitude: number | null;
  default_photo_id: number | null;
  is_gmc: number;
  architecture: string | null;
  built_by: string | null;
  notes: string | null;
  created: string;
  updated: string;
  is_extant: number;
  category: string | null;
  show_on_web: number;
  photo_count: number;
}

function rowToShelter(row: ShelterRow): Shelter {
  return {
    id: row.id,
    name: row.name,
    start_year: row.start_year,
    end_year: row.end_year,
    description: row.description ?? '',
    slug: row.slug,
    longitude: row.longitude,
    latitude: row.latitude,
    default_photo_id: row.default_photo_id,
    is_gmc: Boolean(row.is_gmc),
    architecture: row.architecture ?? '',
    built_by: row.built_by ?? '',
    notes: row.notes ?? '',
    created: row.created,
    updated: row.updated,
    is_extant: Boolean(row.is_extant),
    category: row.category ?? '',
    show_on_web: Boolean(row.show_on_web),
    photo_count: row.photo_count ?? 0,
  };
}

export function getAllShelters(): Shelter[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*, COUNT(p.id) as photo_count
       FROM shelters s
       LEFT JOIN photos p ON p.shelter_id = s.id
       GROUP BY s.id
       ORDER BY s.name`,
    )
    .all() as ShelterRow[];
  return rows.map(rowToShelter);
}

export function getShelterById(id: number): Shelter | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT s.*, COUNT(p.id) as photo_count
       FROM shelters s
       LEFT JOIN photos p ON p.shelter_id = s.id
       WHERE s.id = ?
       GROUP BY s.id`,
    )
    .get(id) as ShelterRow | undefined;
  return row ? rowToShelter(row) : null;
}

export function createShelter(input: ShelterCreateInput): Shelter {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const result = db
    .prepare(
      `INSERT INTO shelters
         (name, slug, start_year, category, is_gmc, is_extant, show_on_web,
          architecture, built_by, description, notes, latitude, longitude, created, updated)
       VALUES
         (?, ?, ?, ?, ?, 1, 0, '', '', '', '', 44.0, -72.8, ?, ?)`,
    )
    .run(input.name, slug, input.start_year, input.category, input.is_gmc ? 1 : 0, today, today);

  return getShelterById(result.lastInsertRowid as number) as Shelter;
}

export function updateShelter(shelter: Shelter): Shelter {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  db.prepare(
    `UPDATE shelters SET
       name = ?, slug = ?, start_year = ?, end_year = ?, description = ?,
       longitude = ?, latitude = ?, default_photo_id = ?, is_gmc = ?,
       architecture = ?, built_by = ?, notes = ?, is_extant = ?,
       category = ?, show_on_web = ?, updated = ?
     WHERE id = ?`,
  ).run(
    shelter.name,
    shelter.slug,
    shelter.start_year,
    shelter.end_year ?? null,
    shelter.description,
    shelter.longitude ?? null,
    shelter.latitude ?? null,
    shelter.default_photo_id ?? null,
    shelter.is_gmc ? 1 : 0,
    shelter.architecture,
    shelter.built_by,
    shelter.notes,
    shelter.is_extant ? 1 : 0,
    shelter.category,
    shelter.show_on_web ? 1 : 0,
    today,
    shelter.id,
  );

  return getShelterById(shelter.id) as Shelter;
}

export function deleteShelter(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM shelters WHERE id = ?').run(id);
}
