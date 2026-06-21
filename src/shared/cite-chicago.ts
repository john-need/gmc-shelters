import type { Source } from './ipc-types';

function esc(t: unknown): string {
  return String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function it(t: string): string {
  return `<em>${esc(t)}</em>`;
}

function txt(t: unknown): string {
  return String(t ?? '');
}

function q(t: string): string {
  return `“${esc(t)}.”`;
}

function linkify(url: string): string {
  const safe = esc(url);
  return `<a href="${safe}" target="_blank" rel="noopener">${safe}</a>`;
}

function markdownItalic(t: string): string {
  return `*${txt(t)}*`;
}

function markdownLink(url: string): string {
  return `[${txt(url)}](${txt(url)})`;
}

type CitationFormatter = {
  escape: (value: unknown) => string;
  italic: (value: string) => string;
  quote: (value: string) => string;
  link: (value: string) => string;
};

function monthName(m: number): string {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][m - 1] ?? '';
}

function longDate(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return '';
  return `${monthName(m)} ${d}, ${y}`;
}

function fmtBook(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.italic(s.title) + '.');
  if (s.editor) p.push(`Edited by ${f.escape(s.editor)}.`);
  if (s.edition && s.edition.toLowerCase() !== '1st') p.push(`${f.escape(s.edition)} ed.`);
  const pubLine = [[s.place, s.publisher].filter(Boolean).map(f.escape).join(': '), year].filter(Boolean).join(', ');
  if (pubLine) p.push(pubLine + '.');
  if (s.pages) p.push(`Pp. ${f.escape(s.pages)}.`);
  return p;
}

function fmtJournal(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.quote(s.title));
  let vol = s.container_title ? f.italic(s.container_title) : '';
  if (s.volume) vol += ` ${f.escape(s.volume)}`;
  if (s.issue) vol += `, no. ${f.escape(s.issue)}`;
  if (year) vol += ` (${year})`;
  if (s.pages) vol += `: ${f.escape(s.pages)}`;
  if (vol) p.push(vol + '.');
  if (s.url) p.push(f.link(s.url) + '.');
  return p;
}

function fmtNewspaper(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.quote(s.title));
  const date = longDate(s.date) || (year ? String(year) : '');
  const tail = [s.container_title ? f.italic(s.container_title) : '', date].filter(Boolean).join(', ');
  if (tail) p.push(tail + '.');
  if (s.pages) p.push(f.escape(s.pages) + '.');
  if (s.url) p.push(f.link(s.url) + '.');
  return p;
}

function fmtMagazine(s: Source, f: CitationFormatter, year: string): string[] {
  const p: string[] = [];
  if (s.author) p.push(`${f.escape(s.author)},`);
  if (s.title) p.push(`"${f.escape(s.title)}."`);
  const tail = [s.container_title ? f.italic(s.container_title) : '', year].filter(Boolean).join(', ');
  if (tail) p.push(tail + '.');
  if (s.pages) p.push(f.escape(s.pages) + '.');
  if (s.url) p.push(f.link(s.url) + '.');
  return p;
}

function fmtWebsite(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.quote(s.title));
  if (s.container_title) p.push(f.italic(s.container_title) + '.');
  if (s.publisher) p.push(f.escape(s.publisher) + '.');
  const date = longDate(s.date) || (year ? String(year) : '');
  if (date) p.push(`Last modified ${date}.`);
  if (s.access_date) p.push(`Accessed ${longDate(s.access_date)}.`);
  if (s.url) p.push(f.link(s.url) + '.');
  return p;
}

function fmtArchive(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.italic(s.title) + '.');
  if (year) p.push(year + '.');
  if (s.container_title) p.push(f.escape(s.container_title) + '.');
  if (s.archive) p.push(f.escape(s.archive) + '.');
  if (s.archive_location) p.push(f.escape(s.archive_location) + '.');
  return p;
}

function fmtInterview(s: Source, f: CitationFormatter, year: string): string[] {
  const p: string[] = [];
  if (s.author) p.push(f.escape(s.author) + ', interviewer.');
  if (s.title) p.push(f.italic(s.title) + '.');
  const date = longDate(s.date) || (year ? String(year) : '');
  if (s.place || date) p.push([f.escape(s.place), date].filter(Boolean).join(', ') + '.');
  if (s.archive) p.push(f.escape(s.archive) + '.');
  if (s.archive_location) p.push(f.escape(s.archive_location) + '.');
  return p;
}

function fmtMap(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.italic(s.title) + '.');
  const line = [[s.place, s.publisher].filter(Boolean).map(f.escape).join(': '), year].filter(Boolean).join(', ');
  if (line) p.push(line + '.');
  return p;
}

function fmtOther(s: Source, f: CitationFormatter, author: string, year: string): string[] {
  const p: string[] = [];
  if (author) p.push(author);
  if (s.title) p.push(f.italic(s.title) + '.');
  if (s.container_title) p.push(f.escape(s.container_title) + '.');
  if (year) p.push(year + '.');
  return p;
}

function citeChicagoWithFormatter(s: Source, formatter: CitationFormatter): string {
  if (!s) return '';
  const author = s.author ? formatter.escape(s.author) + '.' : '';
  const year = s.year ? String(s.year) : '';
  let parts: string[];
  switch (s.type) {
    case 'book': case 'chapter': case 'report': parts = fmtBook(s, formatter, author, year); break;
    case 'journal':   parts = fmtJournal(s, formatter, author, year); break;
    case 'newspaper': parts = fmtNewspaper(s, formatter, author, year); break;
    case 'magazine':  parts = fmtMagazine(s, formatter, year); break;
    case 'website':   parts = fmtWebsite(s, formatter, author, year); break;
    case 'archive': case 'manuscript': parts = fmtArchive(s, formatter, author, year); break;
    case 'interview': parts = fmtInterview(s, formatter, year); break;
    case 'map':       parts = fmtMap(s, formatter, author, year); break;
    default:          parts = fmtOther(s, formatter, author, year);
  }
  return parts.filter(Boolean).join(' ');
}

export function citeChicago(s: Source): string {
  return citeChicagoWithFormatter(s, {
    escape: esc,
    italic: it,
    quote: q,
    link: linkify,
  });
}

export function citeChicagoText(s: Source): string {
  return citeChicagoWithFormatter(s, {
    escape: txt,
    italic: txt,
    quote: (value) => `“${txt(value)}.”`,
    link: txt,
  });
}

export function citeChicagoMarkdown(s: Source): string {
  return citeChicagoWithFormatter(s, {
    escape: txt,
    italic: markdownItalic,
    quote: (value) => `“${txt(value)}.”`,
    link: markdownLink,
  });
}
