import { getDb } from './connection';
import type { Source, SourceInput, SourceRef } from '../../shared/ipc-types';

const SELECT_SOURCE = `
  SELECT s.*,
    ss.shelter_id AS shelter_id,
    ss.include_in_history AS include_in_history,
    ss.annotation AS annotation,
    ss.notes      AS notes,
    ss.quote      AS quote
  FROM sources s
  JOIN shelter_sources ss ON ss.source_id = s.id
`;

function hydrateSource(row: Source): Source {
  return {
    ...row,
    include_in_history: Boolean(row.include_in_history),
  };
}

export function getSourcesByShelter(shelterId: number): Source[] {
  const db = getDb();
  return (db
    .prepare(`${SELECT_SOURCE} WHERE ss.shelter_id = ? ORDER BY s.author, s.year`)
    .all(shelterId) as Source[]).map(hydrateSource);
}

/**
 * All bibliographic sources across every shelter (no association fields).
 * Backs the "browse existing sources" picker for fast data re-entry.
 */
export function getAllSources(): SourceRef[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, type, author, title, container_title, editor, edition,
              volume, issue, pages, publisher, place, year, date, url,
              access_date, archive, archive_location
       FROM sources
       ORDER BY author, title`,
    )
    .all() as SourceRef[];
}

export function createSource(input: SourceInput): Source {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const result = db
    .prepare(
      `INSERT INTO sources
         (type, author, title, container_title, editor, edition,
          volume, issue, pages, publisher, place, year, date, url, access_date,
          archive, archive_location, created, updated)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.type,
      input.author ?? '',
      input.title ?? '',
      input.container_title ?? '',
      input.editor ?? '',
      input.edition ?? '',
      input.volume ?? '',
      input.issue ?? '',
      input.pages ?? '',
      input.publisher ?? '',
      input.place ?? '',
      input.year ?? null,
      input.date ?? '',
      input.url ?? '',
      input.access_date ?? '',
      input.archive ?? '',
      input.archive_location ?? '',
      today,
      today,
    );

  const sourceId = result.lastInsertRowid as number;

  db.prepare(
    `INSERT INTO shelter_sources
      (shelter_id, source_id, include_in_history, annotation, notes, quote)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.shelter_id,
    sourceId,
    input.include_in_history ? 1 : 0,
    input.annotation ?? '',
    input.notes ?? '',
    input.quote ?? '',
  );

  return hydrateSource(db
    .prepare(`${SELECT_SOURCE} WHERE s.id = ? AND ss.shelter_id = ?`)
    .get(sourceId, input.shelter_id) as Source);
}

export function updateSource(source: Source): Source {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  db.prepare(
    `UPDATE sources SET
       type = ?, author = ?, title = ?, container_title = ?, editor = ?,
       edition = ?, volume = ?, issue = ?, pages = ?, publisher = ?, place = ?,
       year = ?, date = ?, url = ?, access_date = ?, archive = ?,
       archive_location = ?, updated = ?
     WHERE id = ?`,
  ).run(
    source.type,
    source.author ?? '',
    source.title ?? '',
    source.container_title ?? '',
    source.editor ?? '',
    source.edition ?? '',
    source.volume ?? '',
    source.issue ?? '',
    source.pages ?? '',
    source.publisher ?? '',
    source.place ?? '',
    source.year ?? null,
    source.date ?? '',
    source.url ?? '',
    source.access_date ?? '',
    source.archive ?? '',
    source.archive_location ?? '',
    today,
    source.id,
  );

  db.prepare(
    `UPDATE shelter_sources
      SET include_in_history = ?, annotation = ?, notes = ?, quote = ?
      WHERE shelter_id = ? AND source_id = ?`,
  ).run(
    source.include_in_history ? 1 : 0,
    source.annotation ?? '',
    source.notes ?? '',
    source.quote ?? '',
    source.shelter_id,
    source.id,
  );

  return hydrateSource(db
    .prepare(`${SELECT_SOURCE} WHERE s.id = ? AND ss.shelter_id = ?`)
    .get(source.id, source.shelter_id) as Source);
}

export function deleteSource(id: number): void {
  const db = getDb();
  // shelter_sources cascade-deletes via FK ON DELETE CASCADE on source_id
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}
