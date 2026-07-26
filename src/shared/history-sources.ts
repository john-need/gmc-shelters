import type { CollectionStatus, Source, SourceType } from './ipc-types';
import { citeChicagoMarkdown } from './cite-chicago';
import { DOCUMENT_TITLED_TYPES } from './wiki-cite';

const VALID_SOURCE_TYPES = new Set<string>([
  'book', 'chapter', 'journal', 'newspaper', 'magazine', 'website',
  'archive', 'manuscript', 'interview', 'map', 'report', 'other',
]);

const MONTH_NUMBERS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

function normalizeTrailingWhitespace(markdown: string): string {
  return markdown.replace(/\s+$/, '');
}

function isSourcesHeading(line: string): boolean {
  return /^#{2,3}\s+Sources\s*$/.test(line.trimEnd());
}

function isHeading(line: string): boolean {
  return /^#{1,3}\s+/.test(line.trimStart());
}

function splitAroundSourcesSection(markdown: string): { before: string; after: string; found: boolean } {
  if (!markdown) {
    return { before: '', after: '', found: false };
  }

  const lines = markdown.split('\n');
  const start = lines.findIndex(isSourcesHeading);

  if (start === -1) {
    return { before: markdown, after: '', found: false };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isHeading(lines[i])) {
      end = i;
      break;
    }
  }

  const before = lines.slice(0, start).join('\n').replace(/\n+$/, '');
  const after = lines.slice(end).join('\n').replace(/^\n+/, '');
  return { before, after, found: true };
}

function sortSources(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const authorCompare = (a.author || '').localeCompare(b.author || '');
    if (authorCompare !== 0) return authorCompare;

    const yearCompare = (a.year ?? 0) - (b.year ?? 0);
    if (yearCompare !== 0) return yearCompare;

    return (a.title || '').localeCompare(b.title || '');
  });
}

export function buildHistorySourcesSection(sources: Source[]): string {
  const included = sortSources(sources)
    .filter((source) => source.include_in_history)
    .map((source) => `- ${citeChicagoMarkdown(source)}`.trimEnd())
    .filter((line) => line !== '-');

  if (included.length === 0) {
    return '';
  }

  return `### Sources\n\n${included.join('\n')}`;
}

type KnownCollection = Pick<CollectionStatus, 'name' | 'citationType'> & Partial<Pick<CollectionStatus, 'defaults'>>;

/** The names a collection may be cited under: its folder name plus its authored
 * citation title, which often differ ("Long Trail Guide Books" folder, but every
 * citation and the metadata.yaml title say "Long Trail Guide Book"). */
function candidateNames(collection: KnownCollection): string[] {
  return [...new Set([collection.name, collection.defaults?.title].filter((n): n is string => Boolean(n)))];
}

/**
 * Matches a line that *starts* with a known collection's base name followed by a comma.
 * Citations rarely reproduce the collection's registered name exactly — "Smoke and
 * Blazes (Killington)" gets cited as "Smoke & Blazes (Killington Section)" — so the
 * match ignores the parenthetical section suffix on both sides, treats "&" and
 * "and" as equivalent, and also tries the collection's authored citation title.
 * Anchored at line start, so "Trail Talk" can't match a line citing "The Trail Talk";
 * longest candidate name wins for the reverse direction. Returns the name as written
 * in the citation (what the reader saw), not the registered name.
 */
function matchKnownCollection(line: string, knownCollections: KnownCollection[]): { collection: KnownCollection; citedName: string; rest: string } | null {
  const candidates = knownCollections
    .flatMap((collection) => candidateNames(collection).map((name) => ({ collection, name })))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { collection, name } of candidates) {
    const base = name.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const pattern = base
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+(?:and|&)\s+/gi, '\\s+(?:and|&)\\s+')
      .replace(/ /g, '\\s+');
    const m = line.match(new RegExp(`^(${pattern})(\\s*\\([^)]*\\))?\\s*,`, 'i'));
    if (m) {
      return { collection, citedName: m[1].trim(), rest: line.slice(m[0].length).trim() };
    }
  }
  return null;
}

// A pasted, non-markdown citation naming a known collection ("Long Trail News, August
// 1963, p. 4–5. "Title." Publisher.") — periodical-shaped, comma-separated, no italics/
// smart-quotes to lean on. Extracts date/pages/title/author/publisher heuristically;
// falls back to dumping the remainder in annotation if there's no quoted title to anchor on.
function parsePlainCollectionCitation(collection: KnownCollection, citedName: string, rest: string, year: number | null): Partial<Source> {
  const type: SourceType = collection.citationType && VALID_SOURCE_TYPES.has(collection.citationType)
    ? collection.citationType as SourceType
    : 'magazine';

  const monthYearMatch = rest.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
  const seasonYearMatch = rest.match(/\b(Spring|Summer|Fall|Winter)\s+(\d{4})\b/i);
  const date = monthYearMatch
    ? `${monthYearMatch[2]}-${MONTH_NUMBERS[monthYearMatch[1].toLowerCase()]}`
    : seasonYearMatch ? `${seasonYearMatch[1]} ${seasonYearMatch[2]}` : '';

  // Extracted regardless of whether a quoted title is found below — an edition/page/
  // volume marker is just as present on a bare "Collection, 21st ed. ... P. 38." or
  // "Collection, Vol. 58 (2005). ..." line as on one with an article title.
  const pagesMatch = rest.match(/\bp\.?\s*(\d+(?:\s*[–—-]\s*\d+)?)/i);
  const pages = pagesMatch ? pagesMatch[1].replace(/\s*[–—-]\s*/g, '-').trim() : '';
  const editionMatch = rest.match(/\b(\d+(?:st|nd|rd|th))\s+ed\.?/i);
  const edition = editionMatch ? editionMatch[1] : '';
  const volumeMatch = rest.match(/\bVol\.?\s*(\d+)\s*(?:\((\d{4})\))?/i);
  const volume = volumeMatch ? volumeMatch[1] : '';

  // Book/chapter/report types cite their own name as `title`, not `container_title`
  // (matching wikiResultToSource's convention) — citeChicagoMarkdown's book formatter
  // never reads container_title, so a collection name routed there would render blank.
  const isDocumentTitled = DOCUMENT_TITLED_TYPES.has(type);

  const titleMatch = rest.match(/“([^”]+)”/) ?? rest.match(/"([^"]+)"/);
  if (!titleMatch) {
    let strippedText = rest;
    if (editionMatch) strippedText = strippedText.replace(editionMatch[0], '');
    if (pagesMatch) strippedText = strippedText.replace(pagesMatch[0], '');
    if (volumeMatch) strippedText = strippedText.replace(volumeMatch[0], '');
    if (monthYearMatch) strippedText = strippedText.replace(monthYearMatch[0], '');
    if (seasonYearMatch) strippedText = strippedText.replace(seasonYearMatch[0], '');
    if (year !== null) strippedText = strippedText.replace(String(year), '');

    if (isDocumentTitled) {
      // Only the segment up to the next remaining period is trustworthy as "publisher" —
      // anything after that is unbounded trailing prose (e.g. "... section." after the
      // year) that we have no grammar for, so it's left in annotation instead of guessed at.
      const publisher = strippedText.split('.')[0].replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
      return {
        type, container_title: '', title: citedName, author: '',
        year, date, pages, edition, volume, publisher, url: '', annotation: rest,
      };
    }

    // Periodical with no quoted title: what's left splits into sentence-ish segments —
    // "Trivia item on Lula Tye Shelter. Killington Section, GMC." — where a leading
    // segment before the final one is an unquoted article title, and the last is the
    // publisher. A single remaining segment is just the publisher.
    const segments = strippedText.split('.')
      .map((s) => s.replace(/^[,\s]+|[,\s]+$/g, ''))
      .filter(Boolean);
    const title = segments.length >= 2 ? segments[0] : '';
    const publisher = segments.length >= 2 ? segments.slice(1).join('. ') : (segments[0] ?? '');

    return {
      type, container_title: citedName, title, author: '',
      year, date, pages, edition, volume, publisher, url: '',
      annotation: segments.length >= 2 ? '' : rest,
    };
  }

  const titleIdx = rest.indexOf(titleMatch[0]);
  let beforeTitle = rest.slice(0, titleIdx);
  if (monthYearMatch) beforeTitle = beforeTitle.replace(monthYearMatch[0], '');
  if (seasonYearMatch) beforeTitle = beforeTitle.replace(seasonYearMatch[0], '');
  if (pagesMatch) beforeTitle = beforeTitle.replace(pagesMatch[0], '');
  if (editionMatch) beforeTitle = beforeTitle.replace(editionMatch[0], '');
  if (volumeMatch) beforeTitle = beforeTitle.replace(volumeMatch[0], '');
  const author = beforeTitle.replace(/^[,.\s]+|[,.\s]+$/g, '').trim();

  const afterTitle = rest.slice(titleIdx + titleMatch[0].length);
  const publisher = afterTitle.replace(/^[.\s]+/, '').replace(/\.\s*$/, '').trim();

  return {
    type,
    container_title: citedName,
    author,
    title: titleMatch[1].replace(/\.$/, '').trim(),
    year,
    date,
    pages,
    edition,
    volume,
    publisher,
    annotation: '',
    url: '',
  };
}

// A pasted book citation with no known-collection anchor ("Woodward, Paul and Joanne.
// Long Trail System Shelter History, 2nd ed. Green Mountain Club, 1999.") — author-first,
// no markup at all. Only fires when the leading segment plausibly looks like a person's
// name (contains a comma, no digits, not too long) so it doesn't swallow lines like
// "GMC Shelter Database, Shelter ID 000156. ..." (a number in that first segment) or
// any line a real author's name just wouldn't contain.
function tryParseAuthorFirstBookCitation(line: string): Partial<Source> | null {
  const firstPeriod = line.indexOf('. ');
  if (firstPeriod === -1) return null;

  const author = line.slice(0, firstPeriod).trim();
  // Reject org/collection-shaped names too: an ampersand or parenthetical (as in
  // "Smoke & Blazes (Killington Section), Vol.") means the "Vol." abbreviation's period
  // was mistaken for a sentence break, not a real "Author. Title" boundary.
  if (!author.includes(',') || /\d/.test(author) || /[&()]/.test(author) || author.length > 60) return null;

  const rest = line.slice(firstPeriod + 2).trim();
  const yearMatch = rest.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;
  const editionMatch = rest.match(/,?\s*\b(\d+(?:st|nd|rd|th))\s+ed\.?/i);
  const edition = editionMatch ? editionMatch[1] : '';

  let title: string;
  let afterTitle: string;
  if (editionMatch && editionMatch.index !== undefined) {
    title = rest.slice(0, editionMatch.index).replace(/[,.\s]+$/, '').trim();
    afterTitle = rest.slice(editionMatch.index + editionMatch[0].length);
  } else {
    const periodIdx = rest.indexOf('.');
    title = (periodIdx === -1 ? rest : rest.slice(0, periodIdx)).trim();
    afterTitle = periodIdx === -1 ? '' : rest.slice(periodIdx + 1);
  }

  const publisher = (yearMatch ? afterTitle.replace(yearMatch[0], '') : afterTitle)
    .replace(/^[.,\s]+|[.,\s]+$/g, '').trim();

  return {
    type: 'book', author, title, edition, year, publisher, container_title: '', url: '', annotation: '',
  };
}

// Best-effort reverse of citeChicagoMarkdown(): Chicago citation prose isn't a
// real grammar, so this only recovers what markdown markup makes structurally
// unambiguous (a quoted “title”, an *italic* title/container, a trailing
// [url](url), and a bare 4-digit year) plus a type guess from which markers
// are present. Everything else in the line (publisher, pages, edition, place,
// archive info, ...) is not attributable to a specific field, so it's kept
// verbatim in `annotation` rather than silently dropped.
function parseCitationLine(rawLine: string, knownCollections: KnownCollection[] = []): Partial<Source> | null {
  const line = rawLine.trim();
  if (!line) return null;

  let remainder = line;

  let url = '';
  const linkMatch = remainder.match(/\[([^\]]+)\]\(([^)]+)\)\.?/);
  if (linkMatch) {
    url = linkMatch[2];
    remainder = (remainder.slice(0, linkMatch.index) + remainder.slice((linkMatch.index ?? 0) + linkMatch[0].length)).trim();
  }

  // Bold is presentation-only in our rendered output (the publisher in book
  // citations) — strip the markers so **Green Mountain Club** reads as plain text.
  remainder = remainder.replace(/\*\*/g, '');

  // Straight-quote fallback matters even for our own output: fmtMagazine renders
  // titles as "..." while journal/website render “...”.
  const quoteMatch = remainder.match(/“([^”]+)”/) ?? remainder.match(/"([^"]+)"/);
  const italicMatch = remainder.match(/\*([^*]+)\*/);
  const yearMatch = remainder.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  // A line with no italics was pasted, not rendered by us (our formatter always
  // italicizes the container/title) — so a leading known-collection name owns it,
  // even when the article title uses straight quotes the marker path could match.
  if (!italicMatch) {
    const known = matchKnownCollection(remainder, knownCollections);
    if (known) return parsePlainCollectionCitation(known.collection, known.citedName, known.rest, year);
  }

  const markerIndexes = [quoteMatch?.index, italicMatch?.index].filter((i): i is number => i !== undefined);
  const firstMarkerIdx = markerIndexes.length ? Math.min(...markerIndexes) : -1;

  if (firstMarkerIdx === -1) {
    const authorFirst = tryParseAuthorFirstBookCitation(remainder);
    if (authorFirst) return authorFirst;

    return {
      type: 'other', author: '', title: '', container_title: '', year, url,
      annotation: remainder,
    };
  }

  const author = remainder.slice(0, firstMarkerIdx).trim().replace(/[.,]$/, '').trim();

  // What follows the italic run disambiguates a periodical container from a book
  // title in our own rendered output: magazines put a volume ("*Smoke & Blazes* 58
  // (2005)") or a comma-then-year ("*Long Trail News*, 1972") right after the
  // italics, while books follow their italic title with a period.
  const italicEnd = italicMatch && italicMatch.index !== undefined
    ? italicMatch.index + italicMatch[0].length : -1;
  const afterItalic = italicEnd >= 0 ? remainder.slice(italicEnd) : '';
  const volAfterItalic = afterItalic.match(/^\s*(\d+)(?:,\s*no\.\s*\d+)?\s*\((\d{4})\)/);
  const italicIsPeriodical = Boolean(volAfterItalic) || /^\s*,/.test(afterItalic);
  const volume = volAfterItalic ? volAfterItalic[1] : '';

  const hasQuote = Boolean(quoteMatch);
  const hasItalic = Boolean(italicMatch);
  let type: SourceType;
  if (hasQuote && hasItalic) type = url ? 'journal' : 'magazine';
  else if (hasItalic) type = italicIsPeriodical ? 'magazine' : 'book';
  else if (hasQuote && url) type = 'website';
  else type = 'other';

  let rest = remainder.slice(firstMarkerIdx);
  if (quoteMatch) rest = rest.replace(quoteMatch[0], '');
  if (italicMatch) rest = rest.replace(italicMatch[0], '');
  if (volAfterItalic) rest = rest.replace(volAfterItalic[0], '');

  const editionMatch = rest.match(/\b(\d+(?:st|nd|rd|th))\s+ed\.?/i);
  const edition = editionMatch ? editionMatch[1] : '';
  if (editionMatch) rest = rest.replace(editionMatch[0], '');

  const pagesPrefixMatch = rest.match(/\bpp?\.?\s*(\d+(?:\s*[–—-]\s*\d+)?)/i);
  let pages = pagesPrefixMatch ? pagesPrefixMatch[1].replace(/\s*[–—-]\s*/g, '-').trim() : '';
  if (pagesPrefixMatch) rest = rest.replace(pagesPrefixMatch[0], '');

  if (year !== null) rest = rest.replace(String(year), '');

  // Remaining sentence-ish segments: bare numeric ones are page refs (rendered
  // magazines cite pages with no "p." prefix), the first textual one is the
  // publisher, and anything further is kept in annotation rather than guessed at.
  const textSegments: string[] = [];
  for (const seg of rest.split('.').map((s) => s.replace(/^[,:\s]+|[,:\s]+$/g, '')).filter(Boolean)) {
    if (/^\d+(?:\s*[–—-]\s*\d+)?$/.test(seg)) {
      if (!pages) pages = seg.replace(/\s*[–—-]\s*/g, '-');
      continue;
    }
    textSegments.push(seg);
  }
  const publisher = textSegments[0] ?? '';
  const annotation = textSegments.slice(1).join('. ');

  const quotedTitle = quoteMatch ? quoteMatch[1].replace(/\.$/, '').trim() : '';
  const italicText = italicMatch ? italicMatch[1].trim() : '';
  const title = hasQuote ? quotedTitle : (italicIsPeriodical ? '' : italicText);
  const container_title = hasQuote || italicIsPeriodical ? italicText : '';

  return { type, author, title, container_title, year, pages, edition, volume, publisher, url, annotation };
}

/**
 * Parses the ### Sources bullet list back into best-effort Source fields — see
 * parseCitationLine. `knownCollections` (e.g. from window.api.collections.status())
 * lets a plain pasted line naming a real collection ("Long Trail News, ...") be
 * recognized as that collection's citation type — see parsePlainCollectionCitation.
 */
export function parseHistorySourcesSection(markdown: string, knownCollections: KnownCollection[] = []): Partial<Source>[] {
  const lines = markdown.split('\n');
  const start = lines.findIndex(isSourcesHeading);
  if (start === -1) return [];

  const bullets: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isHeading(lines[i])) break;
    const line = lines[i].trim();
    if (!line) continue;
    // Not every history file's Sources section was synced by this app (some are
    // hand-written or AI-drafted) — accept a plain line as a citation too, not
    // just markdown "- " bullets.
    bullets.push(line.startsWith('- ') ? line.slice(2) : line);
  }

  return bullets
    .map((line) => parseCitationLine(line, knownCollections))
    .filter((s): s is Partial<Source> => s !== null);
}

export function syncHistorySourcesSection(markdown: string, sources: Source[]): string {
  const section = buildHistorySourcesSection(sources);
  const trimmed = normalizeTrailingWhitespace(markdown);
  const { before, after, found } = splitAroundSourcesSection(trimmed);

  if (!section) {
    const remaining = [before, after].filter(Boolean).join('\n\n');
    return remaining ? `${remaining}\n` : '';
  }

  if (!trimmed || !found) {
    if (!trimmed) {
      return `${section}\n`;
    }

    return `${trimmed}\n\n${section}\n`;
  }

  const rebuilt = [before, section, after].filter(Boolean).join('\n\n');
  if (!rebuilt) {
    return `${section}\n`;
  }

  return `${rebuilt}\n`;
}
