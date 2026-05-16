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

function q(t: string): string {
  return `“${esc(t)}.”`;
}

function linkify(url: string): string {
  const safe = esc(url);
  return `<a href="${safe}" target="_blank" rel="noopener">${safe}</a>`;
}

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

export function citeChicago(s: Source): string {
  if (!s) return '';
  const p: string[] = [];

  const author = s.author ? esc(s.author) + '.' : '';
  const year = s.year ? String(s.year) : '';

  switch (s.type) {
    case 'book':
    case 'chapter':
    case 'report': {
      if (author) p.push(author);
      if (s.title) p.push(it(s.title) + '.');
      if (s.editor) p.push(`Edited by ${esc(s.editor)}.`);
      if (s.edition && s.edition.toLowerCase() !== '1st') p.push(`${esc(s.edition)} ed.`);
      const pubBits = [s.place, s.publisher].filter(Boolean).map(esc).join(': ');
      const pubLine = [pubBits, year].filter(Boolean).join(', ');
      if (pubLine) p.push(pubLine + '.');
      if (s.pages) p.push(`Pp. ${esc(s.pages)}.`);
      break;
    }
    case 'journal': {
      if (author) p.push(author);
      if (s.title) p.push(q(s.title));
      let vol = '';
      if (s.container_title) vol = it(s.container_title);
      if (s.volume) vol += ` ${esc(s.volume)}`;
      if (s.issue) vol += `, no. ${esc(s.issue)}`;
      if (year) vol += ` (${year})`;
      if (s.pages) vol += `: ${esc(s.pages)}`;
      if (vol) p.push(vol + '.');
      if (s.url) p.push(linkify(s.url) + '.');
      break;
    }
    case 'newspaper':
    case 'magazine': {
      if (author) p.push(author);
      if (s.title) p.push(q(s.title));
      const ctn = s.container_title ? it(s.container_title) : '';
      const date = longDate(s.date) || (year ? String(year) : '');
      const tail = [ctn, date].filter(Boolean).join(', ');
      if (tail) p.push(tail + '.');
      if (s.pages) p.push(esc(s.pages) + '.');
      if (s.url) p.push(linkify(s.url) + '.');
      break;
    }
    case 'website': {
      if (author) p.push(author);
      if (s.title) p.push(q(s.title));
      if (s.container_title) p.push(it(s.container_title) + '.');
      if (s.publisher) p.push(esc(s.publisher) + '.');
      const date = longDate(s.date) || (year ? String(year) : '');
      if (date) p.push(`Last modified ${date}.`);
      if (s.access_date) p.push(`Accessed ${longDate(s.access_date)}.`);
      if (s.url) p.push(linkify(s.url) + '.');
      break;
    }
    case 'archive':
    case 'manuscript': {
      if (author) p.push(author);
      if (s.title) p.push(it(s.title) + '.');
      if (year) p.push(year + '.');
      if (s.container_title) p.push(esc(s.container_title) + '.');
      if (s.archive) p.push(esc(s.archive) + '.');
      if (s.archive_location) p.push(esc(s.archive_location) + '.');
      break;
    }
    case 'interview': {
      if (author) p.push(esc(s.author) + ', interviewer.');
      if (s.title) p.push(it(s.title) + '.');
      const date = longDate(s.date) || (year ? String(year) : '');
      if (s.place || date) p.push([esc(s.place), date].filter(Boolean).join(', ') + '.');
      if (s.archive) p.push(esc(s.archive) + '.');
      if (s.archive_location) p.push(esc(s.archive_location) + '.');
      break;
    }
    case 'map': {
      if (author) p.push(author);
      if (s.title) p.push(it(s.title) + '.');
      const place = [s.place, s.publisher].filter(Boolean).map(esc).join(': ');
      const line = [place, year].filter(Boolean).join(', ');
      if (line) p.push(line + '.');
      break;
    }
    default: {
      if (author) p.push(author);
      if (s.title) p.push(it(s.title) + '.');
      if (s.container_title) p.push(esc(s.container_title) + '.');
      if (year) p.push(year + '.');
    }
  }
  return p.filter(Boolean).join(' ');
}
