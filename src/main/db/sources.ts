import { getDb } from './connection';
import type { Source, SourceInput } from '../../shared/ipc-types';

const SELECT_SOURCE = `
  SELECT s.*,
    ss.shelter_id AS shelter_id,
    ss.annotation AS annotation,
    ss.notes      AS notes,
    ss.quote      AS quote
  FROM sources s
  JOIN shelter_sources ss ON ss.source_id = s.id
`;

export function getSourcesByShelter(shelterId: number): Source[] {
  const db = getDb();
  return db
    .prepare(`${SELECT_SOURCE} WHERE ss.shelter_id = ? ORDER BY s.author, s.year`)
    .all(shelterId) as Source[];
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
    'INSERT INTO shelter_sources (shelter_id, source_id, annotation, notes, quote) VALUES (?, ?, ?, ?, ?)',
  ).run(input.shelter_id, sourceId, input.annotation ?? '', input.notes ?? '', input.quote ?? '');

  return db
    .prepare(`${SELECT_SOURCE} WHERE s.id = ? AND ss.shelter_id = ?`)
    .get(sourceId, input.shelter_id) as Source;
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
    'UPDATE shelter_sources SET annotation = ?, notes = ?, quote = ? WHERE shelter_id = ? AND source_id = ?',
  ).run(source.annotation ?? '', source.notes ?? '', source.quote ?? '', source.shelter_id, source.id);

  return db
    .prepare(`${SELECT_SOURCE} WHERE s.id = ? AND ss.shelter_id = ?`)
    .get(source.id, source.shelter_id) as Source;
}

export function deleteSource(id: number): void {
  const db = getDb();
  // shelter_sources cascade-deletes via FK ON DELETE CASCADE on source_id
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}
