/**
 * Raw row shape of the `sources` table (`SELECT * FROM sources`) — bibliographic
 * fields only. Per-shelter `annotation`/`notes`/`quote`/`include_in_history` live
 * on the `shelter_sources` join table, not here.
 */
export interface Source {
  id: number;
  type: string;
  author: string;
  title: string;
  containerTitle: string;
  containerAuthor: string;
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
  accessDate: string;
  archive: string;
  archiveLocation: string;
  created: string;
  updated: string;
}
