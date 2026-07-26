import type { Source, SourceType, WikiSearchResult } from './ipc-types';

const OKF_TO_SOURCE: Record<string, SourceType> = {
  Newsletter: 'magazine',
  Book: 'book',
  Guidebook: 'book',
  'Annual Report': 'report',
  Map: 'map',
  Article: 'magazine',
  Periodical: 'magazine',
};

const VALID_SOURCE_TYPES = new Set<string>([
  'book', 'chapter', 'journal', 'newspaper', 'magazine', 'website',
  'archive', 'manuscript', 'interview', 'map', 'report', 'other',
]);

// citeChicago's fmtBook (shared by these three types) cites the document's own
// title/author directly and never reads container_title — unlike periodical
// types, where container_title is the (correct) periodical/collection name.
export const DOCUMENT_TITLED_TYPES = new Set<SourceType>(['book', 'chapter', 'report']);

function citationType(r: WikiSearchResult): SourceType {
  // citation_type is authored per-collection in the OKF header (single source
  // of truth); okf_type guessing is only a fallback for docs converted before
  // that field existed.
  if (VALID_SOURCE_TYPES.has(r.citation_type)) return r.citation_type as SourceType;
  return OKF_TO_SOURCE[r.okf_type] ?? 'other';
}

export function stripMarks(html: string): string {
  return html.replace(/<\/?mark>/g, '').replace(/…/g, '...');
}

/** First 4-digit run in a publication_date ("1999-09-29" / "1922-12" / "Spring 1917" / "1917"). */
function parseYear(dateStr: string): number | null {
  const m = /\d{4}/.exec(dateStr);
  return m ? Number(m[0]) : null;
}

/**
 * Map a wiki search hit to a Chicago Notes-Bibliography source.
 * Printed volume/issue numbers win over the derived year/edition (the spec's
 * "citations prefer printed numbers"); the PDF page number fills `pages`.
 */
export function wikiResultToSource(r: WikiSearchResult): Partial<Source> {
  const type = citationType(r);
  const year = parseYear(r.publication_date) ?? parseYear(r.volume);
  return {
    type,
    author: r.author,
    ...(DOCUMENT_TITLED_TYPES.has(type)
      ? { title: r.title, container_title: '' }
      : { container_title: r.title }),
    publisher: r.publisher,
    edition: r.edition,
    volume: r.printed_volume || r.volume,
    issue: r.printed_issue,
    pages: r.page ? String(r.page) : '',
    year,
    // volume only, not edition — edition is already surfaced on its own in the
    // research-tab line ("ed. {edition}"); folding it into date too would repeat it.
    date: r.publication_date || r.volume,
    archive_location: r.resource,
    quote: stripMarks(r.snippet),
  };
}
