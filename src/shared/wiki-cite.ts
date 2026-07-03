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

function citationType(r: WikiSearchResult): SourceType {
  // citation_type is authored per-collection in the OKF header (single source
  // of truth); okf_type guessing is only a fallback for docs converted before
  // that field existed.
  if (VALID_SOURCE_TYPES.has(r.citation_type)) return r.citation_type as SourceType;
  return OKF_TO_SOURCE[r.okf_type] ?? 'other';
}

function stripMarks(html: string): string {
  return html.replace(/<\/?mark>/g, '').replace(/…/g, '...');
}

/**
 * Map a wiki search hit to a Chicago Notes-Bibliography source.
 * Printed volume/issue numbers win over the derived year/edition (the spec's
 * "citations prefer printed numbers"); the PDF page number fills `pages`.
 */
export function wikiResultToSource(r: WikiSearchResult): Partial<Source> {
  const year = parseInt(r.volume, 10);
  return {
    type: citationType(r),
    container_title: r.title,
    publisher: r.publisher,
    volume: r.printed_volume || r.volume,
    issue: r.printed_issue,
    pages: r.page ? String(r.page) : '',
    year: Number.isFinite(year) ? year : null,
    date: [r.edition, r.volume].filter(Boolean).join(' '),
    archive_location: r.resource,
    quote: stripMarks(r.snippet),
  };
}
