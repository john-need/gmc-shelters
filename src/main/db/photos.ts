import { getDb } from './connection';
import type { Photo, PhotoUpdateInput } from '../../shared/ipc-types';

interface PhotoRow {
  id: number;
  photographer: string | null;
  file_name: string;
  caption: string | null;
  date_taken: string | null;
  notes: string | null;
  created: string;
  updated: string;
  shelter_id: number;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  include_in_post: number;
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    photographer: row.photographer ?? '',
    file_name: row.file_name,
    caption: row.caption ?? '',
    date_taken: row.date_taken ?? '',
    notes: row.notes ?? '',
    created: row.created,
    updated: row.updated,
    shelter_id: row.shelter_id,
    alt_text: row.alt_text ?? '',
    title: row.title ?? '',
    description: row.description ?? '',
    include_in_post: Boolean(row.include_in_post),
  };
}

export function getPhotosByShelter(shelterId: number): Photo[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM photos WHERE shelter_id = ? ORDER BY created')
    .all(shelterId) as PhotoRow[];
  return rows.map(rowToPhoto);
}

export function updatePhoto(input: PhotoUpdateInput & { id: number; shelter_id: number }): Photo {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  db.prepare(
    `UPDATE photos SET
       title = ?, photographer = ?, caption = ?, date_taken = ?, notes = ?,
       alt_text = ?, description = ?, include_in_post = ?, updated = ?
     WHERE id = ?`,
  ).run(
    input.title ?? '',
    input.photographer ?? '',
    input.caption ?? '',
    input.date_taken ?? null,
    input.notes ?? '',
    input.alt_text ?? '',
    input.description ?? '',
    input.include_in_post ? 1 : 0,
    today,
    input.id,
  );

  return rowToPhoto(
    db.prepare('SELECT * FROM photos WHERE id = ?').get(input.id) as PhotoRow,
  );
}

export function deletePhoto(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM photos WHERE id = ?').run(id);
}

export function setDefaultPhoto(shelterId: number, photoId: number): void {
  const db = getDb();
  db.prepare('UPDATE shelters SET default_photo_id = ? WHERE id = ?').run(photoId, shelterId);
}

export function clearDefaultPhoto(shelterId: number, photoId: number): void {
  const db = getDb();
  db.prepare('UPDATE shelters SET default_photo_id = NULL WHERE id = ? AND default_photo_id = ?').run(shelterId, photoId);
}

export function insertPhoto(
  shelterId: number,
  fileName: string,
  title?: string,
): Photo {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare(
      `INSERT INTO photos
         (shelter_id, file_name, title, photographer, caption, date_taken, notes,
          alt_text, description, include_in_post, created, updated)
       VALUES (?, ?, ?, '', '', null, '', '', '', 0, ?, ?)`,
    )
    .run(shelterId, fileName, title ?? fileName, today, today);

  return rowToPhoto(
    db.prepare('SELECT * FROM photos WHERE id = ?').get(result.lastInsertRowid) as PhotoRow,
  );
}
