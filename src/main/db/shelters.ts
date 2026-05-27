import { getDb } from './connection';
import type { Shelter, ShelterCreateInput } from '../../shared/ipc-types';

interface ShelterRow {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  description: string | null;
  slug: string;
  default_photo_id: number | null;
  is_gmc: number;
  architecture_id: number | null;
  builder_id: number | null;
  notes: string | null;
  created: string;
  updated: string;
  is_extant: number;
  category_id: number | null;
  show_on_web: number;
  history: string | null;
  photo_count: number;
  // JOINed resolved names
  architecture: string | null;
  category: string | null;
  built_by: string | null;
  default_photo_file_name: string | null;
}

const SELECT_SHELTERS = `
  SELECT s.*,
    a.name              AS architecture,
    c.category_name     AS category,
    b.name              AS built_by,
    COUNT(p.id)         AS photo_count,
    dp.file_name        AS default_photo_file_name
  FROM shelters s
  LEFT JOIN architectures a ON a.id = s.architecture_id
  LEFT JOIN categories    c ON c.id = s.category_id
  LEFT JOIN builders      b ON b.id = s.builder_id
  LEFT JOIN photos        p ON p.shelter_id = s.id
  LEFT JOIN photos        dp ON dp.id = s.default_photo_id
`;

function rowToShelter(row: ShelterRow): Shelter {
  return {
    id: row.id,
    name: row.name,
    start_year: row.start_year,
    end_year: row.end_year,
    description: row.description ?? '',
    slug: row.slug,
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
    history: row.history ?? null,
    photo_count: row.photo_count ?? 0,
    default_photo_file_name: row.default_photo_file_name ?? null,
  };
}

export function getAllShelters(): Shelter[] {
  const db = getDb();
  const rows = db
    .prepare(`${SELECT_SHELTERS} GROUP BY s.id ORDER BY s.name`)
    .all() as ShelterRow[];
  return rows.map(rowToShelter);
}

export function getShelterById(id: number): Shelter | null {
  const db = getDb();
  const row = db
    .prepare(`${SELECT_SHELTERS} WHERE s.id = ? GROUP BY s.id`)
    .get(id) as ShelterRow | undefined;
  return row ? rowToShelter(row) : null;
}

function resolveArchitectureId(db: ReturnType<typeof getDb>, name: string): number | null {
  if (!name) return null;
  const row = db
    .prepare('SELECT id FROM architectures WHERE name = ?')
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function resolveCategoryId(db: ReturnType<typeof getDb>, name: string): number | null {
  if (!name) return null;
  const row = db
    .prepare('SELECT id FROM categories WHERE category_name = ?')
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

function resolveBuilderIdUpsert(db: ReturnType<typeof getDb>, name: string): number | null {
  if (!name) return null;
  db.prepare('INSERT OR IGNORE INTO builders (name) VALUES (?)').run(name);
  const row = db
    .prepare('SELECT id FROM builders WHERE name = ?')
    .get(name) as { id: number } | undefined;
  return row?.id ?? null;
}

export function createShelter(input: ShelterCreateInput): Shelter {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const categoryId = resolveCategoryId(db, input.category);

  const defaultHistory = `${slug}/${slug}.md`;

  const result = db
    .prepare(
      `INSERT INTO shelters
         (name, slug, start_year, category_id, is_gmc, is_extant, show_on_web,
          architecture_id, builder_id, description, notes, history, created, updated)
       VALUES (?, ?, ?, ?, ?, 1, 0, NULL, NULL, '', '', ?, ?, ?)`,
    )
    .run(input.name, slug, input.start_year, categoryId, input.is_gmc ? 1 : 0, defaultHistory, today, today);

  return getShelterById(result.lastInsertRowid as number) as Shelter;
}

export function updateShelter(shelter: Shelter): Shelter {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const architectureId = resolveArchitectureId(db, shelter.architecture);
  const categoryId = resolveCategoryId(db, shelter.category);
  const builderId = resolveBuilderIdUpsert(db, shelter.built_by);

  db.prepare(
    `UPDATE shelters SET
       name = ?, slug = ?, start_year = ?, end_year = ?, description = ?,
       default_photo_id = ?, is_gmc = ?,
       architecture_id = ?, builder_id = ?, notes = ?, is_extant = ?,
       category_id = ?, show_on_web = ?, updated = ?
     WHERE id = ?`,
  ).run(
    shelter.name,
    shelter.slug,
    shelter.start_year,
    shelter.end_year ?? null,
    shelter.description,
    shelter.default_photo_id ?? null,
    shelter.is_gmc ? 1 : 0,
    architectureId,
    builderId,
    shelter.notes,
    shelter.is_extant ? 1 : 0,
    categoryId,
    shelter.show_on_web ? 1 : 0,
    today,
    shelter.id,
  );

  return getShelterById(shelter.id) as Shelter;
}

export function setShelterHistory(id: number, history: string): void {
  const db = getDb();
  db.prepare('UPDATE shelters SET history = ? WHERE id = ?').run(history, id);
}

export function deleteShelter(id: number): void {
  const db = getDb();

  const sourceIds = (
    db.prepare('SELECT source_id FROM shelter_sources WHERE shelter_id = ?').all(id) as { source_id: number }[]
  ).map((r) => r.source_id);

  db.transaction(() => {
    db.prepare('DELETE FROM photos WHERE shelter_id = ?').run(id);
    db.prepare('DELETE FROM shelters WHERE id = ?').run(id);
    if (sourceIds.length > 0) {
      const ph = sourceIds.map(() => '?').join(',');
      db.prepare(
        `DELETE FROM sources WHERE id IN (${ph}) AND id NOT IN (SELECT source_id FROM shelter_sources)`,
      ).run(...sourceIds);
    }
  })();
}
