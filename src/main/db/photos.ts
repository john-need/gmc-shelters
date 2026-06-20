import { getDb } from './connection';
import type { Photo, PhotoUpdateInput } from '../../shared/ipc-types';
import { normalizePhotoDateTaken } from '@shared/photo-date';

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
    .prepare('SELECT * FROM photos WHERE shelter_id = ? ORDER BY sort_order, created, id')
    .all(shelterId) as PhotoRow[];
  return rows.map(rowToPhoto);
}

export function reorderPhotos(shelterId: number, orderedPhotoIds: number[]): void {
  const db = getDb();
  const existingIds = db
    .prepare('SELECT id FROM photos WHERE shelter_id = ? ORDER BY sort_order, created, id')
    .all(shelterId) as Array<{ id: number }>;

  if (existingIds.length !== orderedPhotoIds.length) {
    throw new Error(`Photo reorder for shelter ${shelterId} must include every photo exactly once`);
  }

  const existingIdSet = new Set(existingIds.map((row) => row.id));
  const orderedIdSet = new Set(orderedPhotoIds);
  if (orderedIdSet.size !== orderedPhotoIds.length || orderedPhotoIds.some((id) => !existingIdSet.has(id))) {
    throw new Error(`Photo reorder for shelter ${shelterId} contains unknown or duplicate photo ids`);
  }

  const updateOrder = db.prepare('UPDATE photos SET sort_order = ?, updated = ? WHERE id = ? AND shelter_id = ?');
  const today = new Date().toISOString().slice(0, 10);
  const txn = db.transaction((photoIds: number[]) => {
    photoIds.forEach((photoId, index) => {
      updateOrder.run(index + 1, today, photoId, shelterId);
    });
  });

  txn(orderedPhotoIds);
}

export function updatePhoto(input: PhotoUpdateInput & { id: number; shelter_id: number }): Photo {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const normalizedDateTaken = normalizePhotoDateTaken(input.date_taken);

  db.prepare(
    `UPDATE photos SET
       title = ?, photographer = ?, caption = ?, date_taken = ?, notes = ?,
       alt_text = ?, description = ?, include_in_post = ?, updated = ?
     WHERE id = ?`,
  ).run(
    input.title ?? '',
    input.photographer ?? '',
    input.caption ?? '',
    normalizedDateTaken || null,
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
  const nextSortOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM photos WHERE shelter_id = ?')
     .get(shelterId) as { next_sort_order: number }
  ).next_sort_order;
  const result = db
    .prepare(
     `INSERT INTO photos
         (shelter_id, file_name, title, photographer, caption, date_taken, notes,
          alt_text, description, include_in_post, sort_order, created, updated)
      VALUES (?, ?, ?, '', '', null, '', '', '', 0, ?, ?, ?)`,
    )
    .run(shelterId, fileName, title ?? fileName, nextSortOrder, today, today);

  return rowToPhoto(
    db.prepare('SELECT * FROM photos WHERE id = ?').get(result.lastInsertRowid) as PhotoRow,
  );
}
