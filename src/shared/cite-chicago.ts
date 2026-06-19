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

function citeChicagoWithFormatter(s: Source, formatter: CitationFormatter): string {
  if (!s) return '';
  const p: string[] = [];

  const author = s.author ? formatter.escape(s.author) + '.' : '';
  const year = s.year ? String(s.year) : '';

  switch (s.type) {
    case 'book':
    case 'chapter':
    case 'report': {
      if (author) p.push(author);
      if (s.title) p.push(formatter.italic(s.title) + '.');
      if (s.editor) p.push(`Edited by ${formatter.escape(s.editor)}.`);
      if (s.edition && s.edition.toLowerCase() !== '1st') p.push(`${formatter.escape(s.edition)} ed.`);
      const pubBits = [s.place, s.publisher].filter(Boolean).map(formatter.escape).join(': ');
      const pubLine = [pubBits, year].filter(Boolean).join(', ');
      if (pubLine) p.push(pubLine + '.');
      if (s.pages) p.push(`Pp. ${formatter.escape(s.pages)}.`);
      break;
    }
    case 'journal': {
      if (author) p.push(author);
      if (s.title) p.push(formatter.quote(s.title));
      let vol = '';
      if (s.container_title) vol = formatter.italic(s.container_title);
      if (s.volume) vol += ` ${formatter.escape(s.volume)}`;
      if (s.issue) vol += `, no. ${formatter.escape(s.issue)}`;
      if (year) vol += ` (${year})`;
      if (s.pages) vol += `: ${formatter.escape(s.pages)}`;
      if (vol) p.push(vol + '.');
      if (s.url) p.push(formatter.link(s.url) + '.');
      break;
    }
    case 'newspaper': {
      if (author) p.push(author);
      if (s.title) p.push(formatter.quote(s.title));
      const ctn = s.container_title ? formatter.italic(s.container_title) : '';
      const date = longDate(s.date) || (year ? String(year) : '');
      const tail = [ctn, date].filter(Boolean).join(', ');
      if (tail) p.push(tail + '.');
      if (s.pages) p.push(formatter.escape(s.pages) + '.');
      if (s.url) p.push(formatter.link(s.url) + '.');
      break;
    }
    case 'magazine': {
      if (s.author) p.push(`${formatter.escape(s.author)},`);
      if (s.title) p.push(`"${formatter.escape(s.title)}."`);
      const ctn = s.container_title ? formatter.italic(s.container_title) : '';
      const tail = [ctn, year].filter(Boolean).join(', ');
      if (tail) p.push(tail + '.');
      if (s.pages) p.push(formatter.escape(s.pages) + '.');
      if (s.url) p.push(formatter.link(s.url) + '.');
      break;
    }
    case 'website': {
      if (author) p.push(author);
      if (s.title) p.push(formatter.quote(s.title));
      if (s.container_title) p.push(formatter.italic(s.container_title) + '.');
      if (s.publisher) p.push(formatter.escape(s.publisher) + '.');
      const date = longDate(s.date) || (year ? String(year) : '');
      if (date) p.push(`Last modified ${date}.`);
      if (s.access_date) p.push(`Accessed ${longDate(s.access_date)}.`);
      if (s.url) p.push(formatter.link(s.url) + '.');
      break;
    }
    case 'archive':
    case 'manuscript': {
      if (author) p.push(author);
      if (s.title) p.push(formatter.italic(s.title) + '.');
      if (year) p.push(year + '.');
      if (s.container_title) p.push(formatter.escape(s.container_title) + '.');
      if (s.archive) p.push(formatter.escape(s.archive) + '.');
      if (s.archive_location) p.push(formatter.escape(s.archive_location) + '.');
      break;
    }
    case 'interview': {
      if (author) p.push(formatter.escape(s.author) + ', interviewer.');
      if (s.title) p.push(formatter.italic(s.title) + '.');
      const date = longDate(s.date) || (year ? String(year) : '');
      if (s.place || date) p.push([formatter.escape(s.place), date].filter(Boolean).join(', ') + '.');
      if (s.archive) p.push(formatter.escape(s.archive) + '.');
      if (s.archive_location) p.push(formatter.escape(s.archive_location) + '.');
      break;
    }
    case 'map': {
      if (author) p.push(author);
      if (s.title) p.push(formatter.italic(s.title) + '.');
      const place = [s.place, s.publisher].filter(Boolean).map(formatter.escape).join(': ');
      const line = [place, year].filter(Boolean).join(', ');
      if (line) p.push(line + '.');
      break;
    }
    default: {
      if (author) p.push(author);
      if (s.title) p.push(formatter.italic(s.title) + '.');
      if (s.container_title) p.push(formatter.escape(s.container_title) + '.');
      if (year) p.push(year + '.');
    }
  }
  return p.filter(Boolean).join(' ');
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
