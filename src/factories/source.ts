import type { Source } from '../types/source';

/**
 * Raw `sources` row shape, as returned by `SELECT * FROM sources` — bibliographic
 * fields only, no `shelter_sources` join fields.
 */
export interface SourceRow {
  id: number;
  type: string;
  author: string;
  title: string;
  container_title: string;
  container_author: string;
  editor: string;
  edition: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  place: string;
  year: number | null;
  date: string;
  url: string;
  access_date: string;
  archive: string;
  archive_location: string;
  created: string;
  updated: string;
}

export function makeSource(row: SourceRow): Source {
  return {
    id: row.id,
    type: row.type,
    author: row.author,
    title: row.title,
    containerTitle: row.container_title,
    containerAuthor: row.container_author,
    editor: row.editor,
    edition: row.edition,
    volume: row.volume,
    issue: row.issue,
    pages: row.pages,
    publisher: row.publisher,
    place: row.place,
    year: row.year,
    date: row.date,
    url: row.url,
    accessDate: row.access_date,
    archive: row.archive,
    archiveLocation: row.archive_location,
    created: row.created,
    updated: row.updated,
  };
}
