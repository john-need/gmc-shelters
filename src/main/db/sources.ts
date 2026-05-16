import { getDb } from './connection';
import type { Source, SourceInput } from '../../shared/ipc-types';

export function getSourcesByShelter(shelterId: number): Source[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM sources WHERE shelter_id = ? ORDER BY author, year')
    .all(shelterId) as Source[];
}

export function createSource(input: SourceInput): Source {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare(
      `INSERT INTO sources
         (shelter_id, type, author, title, container_title, editor, edition,
          volume, issue, pages, publisher, place, year, date, url, access_date,
          archive, archive_location, annotation, notes, created, updated)
       VALUES
         (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.shelter_id,
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
      input.annotation ?? '',
      input.notes ?? '',
      today,
      today,
    );

  return db
    .prepare('SELECT * FROM sources WHERE id = ?')
    .get(result.lastInsertRowid) as Source;
}

export function updateSource(source: Source): Source {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `UPDATE sources SET
       type = ?, author = ?, title = ?, container_title = ?, editor = ?,
       edition = ?, volume = ?, issue = ?, pages = ?, publisher = ?, place = ?,
       year = ?, date = ?, url = ?, access_date = ?, archive = ?,
       archive_location = ?, annotation = ?, notes = ?, updated = ?
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
    source.annotation ?? '',
    source.notes ?? '',
    today,
    source.id,
  );
  return db.prepare('SELECT * FROM sources WHERE id = ?').get(source.id) as Source;
}

export function deleteSource(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
}
