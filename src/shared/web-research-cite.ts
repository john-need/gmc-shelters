import type { Source, WebResearchResult } from './ipc-types';

/** Maps a Claude web-research result to a Chicago Notes-Bibliography "Website" source, mirroring wikiResultToSource(). */
export function webResultToSource(r: WebResearchResult): Partial<Source> {
  return {
    type: 'website',
    container_title: r.title,
    url: r.url,
    access_date: new Date().toISOString().slice(0, 10),
    quote: r.snippet,
  };
}
