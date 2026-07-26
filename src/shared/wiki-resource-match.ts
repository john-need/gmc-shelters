/** One document-level row from wiki/search.db (page rows collapse to DISTINCT docs). */
export interface WikiDocRow {
  title: string;
  publication_date: string;
  volume: string;
  /** The issue's printed volume number, when the index's volume field holds the year. */
  printed_volume?: string;
  edition: string;
  resource: string;
}

/** What a parsed citation knows about the document it cites — see parseHistorySourcesSection. */
export interface WikiResourceCriteria {
  /** The cited collection/publication name (container_title, or title for books). */
  title: string;
  /** 'YYYY-MM' or 'Season YYYY', when the citation carried one. */
  date?: string;
  year?: number | null;
  /** Ordinal edition as cited, e.g. '21st'. */
  edition?: string;
  volume?: string;
}

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "1963-08" -> "august"; "Spring 1995" -> "spring"; else null. */
function issueToken(date: string | undefined): string | null {
  if (!date) return null;
  const monthMatch = date.match(/^\d{4}-(\d{2})$/);
  if (monthMatch) return MONTH_NAMES[Number(monthMatch[1]) - 1] ?? null;
  const seasonMatch = date.match(/^(Spring|Summer|Fall|Winter)\s+\d{4}$/i);
  return seasonMatch ? seasonMatch[1].toLowerCase() : null;
}

/** Doc edition holds month/season names for newsletters ("August", "Fall/Winter"). */
function editionHasToken(docEdition: string, token: string): boolean {
  return docEdition.toLowerCase().split('/').map((s) => s.trim()).includes(token);
}

function matchesYear(doc: WikiDocRow, year: number): boolean {
  const y = String(year);
  if (doc.publication_date.startsWith(y)) return true;
  if (doc.volume === y) return true;
  // A doc with no year signal at all (e.g. volume-numbered periodicals) can't contradict the year.
  return !doc.publication_date && !/^\d{4}$/.test(doc.volume);
}

/**
 * Picks the collection document a citation refers to, or null. Works down a
 * specificity ladder — issue-level tokens (month/season, ordinal edition, volume
 * number) before bare year — and links only when exactly one document survives
 * the most specific applicable level: a wrong primary-source link silently
 * misattributes the citation, so ambiguity means no link.
 */
export function pickWikiResource(docs: WikiDocRow[], criteria: WikiResourceCriteria): string | null {
  const wanted = normalizeTitle(criteria.title);
  if (!wanted) return null;
  const titled = docs.filter((doc) => normalizeTitle(doc.title) === wanted);
  if (titled.length === 0) return null;

  const token = issueToken(criteria.date);
  const editionNum = criteria.edition?.match(/^(\d+)(?:st|nd|rd|th)$/i)?.[1] ?? null;
  const hasIssueLevel = Boolean(token || editionNum || criteria.volume);

  if (hasIssueLevel) {
    const issueMatches = titled.filter((doc) =>
      (!token || editionHasToken(doc.edition, token)) &&
      (!editionNum || doc.edition === editionNum) &&
      (!criteria.volume || doc.volume === criteria.volume || doc.printed_volume === criteria.volume) &&
      (!criteria.year || matchesYear(doc, criteria.year)));
    if (issueMatches.length === 1) return issueMatches[0].resource;
    if (issueMatches.length > 1) return null;
  }

  if (criteria.year) {
    const y = String(criteria.year);
    const yearMatches = titled.filter((doc) => doc.publication_date.startsWith(y) || doc.volume === y);
    if (yearMatches.length === 1) return yearMatches[0].resource;
  }

  return null;
}
