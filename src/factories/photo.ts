import type { Photo } from '../types/photo';

/** Raw `photos` row shape, as returned by `SELECT * FROM photos`. */
export interface PhotoRow {
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
  sort_order: number | null;
}

export function makePhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    photographer: row.photographer,
    fileName: row.file_name,
    caption: row.caption,
    dateTaken: row.date_taken,
    notes: row.notes,
    created: row.created,
    updated: row.updated,
    shelterId: row.shelter_id,
    altText: row.alt_text,
    title: row.title,
    description: row.description,
    includeInPost: Boolean(row.include_in_post),
    sortOrder: row.sort_order,
  };
}
