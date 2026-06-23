import type { Source, SourceType, SourceRef } from '../../../../shared/ipc-types';

export const SOURCE_TYPES: { v: SourceType; label: string }[] = [
  { v: 'book', label: 'Book' },
  { v: 'chapter', label: 'Book chapter' },
  { v: 'journal', label: 'Journal article' },
  { v: 'newspaper', label: 'Newspaper article' },
  { v: 'magazine', label: 'Magazine article' },
  { v: 'website', label: 'Website' },
  { v: 'archive', label: 'Archive material' },
  { v: 'manuscript', label: 'Manuscript / letter' },
  { v: 'interview', label: 'Interview' },
  { v: 'map', label: 'Map' },
  { v: 'report', label: 'Report / govt. document' },
  { v: 'other', label: 'Other' },
];

export const SOURCE_GLYPH: Record<string, string> = {
  book: 'B', chapter: 'C', journal: 'J', newspaper: 'N',
  magazine: 'M', website: 'W', archive: 'A', manuscript: 'M',
  interview: 'I', map: 'P', report: 'R', other: '?',
};

// Fields surfaced (and searchable) in the browse-existing picker, by type.
export type PickerField = { key: keyof SourceRef; label: string };
export const PICKER_FIELDS: Record<SourceType, PickerField[]> = {
  book:       [{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'edition', label: 'Edition' }, { key: 'year', label: 'Year' }],
  chapter:    [{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'edition', label: 'Edition' }, { key: 'year', label: 'Year' }],
  journal:    [{ key: 'container_title', label: 'Journal / Magazine' }, { key: 'volume', label: 'Volume' }, { key: 'issue', label: 'Issue' }, { key: 'year', label: 'Year' }],
  newspaper:  [{ key: 'container_title', label: 'Newspaper' }],
  magazine:   [{ key: 'container_title', label: 'Journal / Magazine' }, { key: 'volume', label: 'Volume' }, { key: 'issue', label: 'Issue' }, { key: 'year', label: 'Year' }],
  website:    [{ key: 'container_title', label: 'Website Name' }],
  archive:    [{ key: 'archive', label: 'Archive Repository' }, { key: 'container_title', label: 'Collection' }],
  manuscript: [{ key: 'archive', label: 'Archive Repository' }, { key: 'archive_location', label: 'Box / folder / call number' }],
  interview:  [{ key: 'archive', label: 'Archive Repository' }, { key: 'archive_location', label: 'Box / folder / call number' }],
  map:        [{ key: 'title', label: 'Title' }, { key: 'year', label: 'Year' }],
  report:     [{ key: 'title', label: 'Title' }, { key: 'edition', label: 'Edition' }, { key: 'volume', label: 'Volume' }, { key: 'year', label: 'Year' }],
  other:      [{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'year', label: 'Year' }],
};

// Bibliographic keys copied into the form when a picker row is selected.
export const BIB_KEYS: (keyof SourceRef)[] = [
  'type', 'author', 'title', 'container_title', 'editor', 'edition', 'volume',
  'issue', 'pages', 'publisher', 'place', 'year', 'date', 'url', 'access_date',
  'archive', 'archive_location',
];

export const BLANK_SOURCE: Omit<Source, 'id' | 'shelter_id' | 'created' | 'updated'> = {
  include_in_history: false,
  type: 'book',
  author: '', title: '', container_title: '', editor: '',
  edition: '', volume: '', issue: '', pages: '',
  publisher: '', place: '', year: null, date: '',
  url: '', access_date: '', archive: '', archive_location: '',
  annotation: '', notes: '', quote: '',
};

export const cell = (v: SourceRef[keyof SourceRef]): string => (v == null ? '' : String(v));

export function prettyUrl(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ''); }
  catch { return u; }
}

export function showSourceField(key: string, type: SourceType, hasUrl: boolean): boolean {
  const map: Record<string, boolean | SourceType[]> = {
    author: true,
    title: true,
    container_title: (['chapter', 'journal', 'newspaper', 'magazine', 'website', 'archive'] as SourceType[]).includes(type),
    editor: (['book', 'chapter', 'report'] as SourceType[]).includes(type),
    edition: (['book', 'chapter', 'report'] as SourceType[]).includes(type),
    volume: (['journal', 'magazine', 'report'] as SourceType[]).includes(type),
    issue: (['journal', 'magazine'] as SourceType[]).includes(type),
    pages: (['book', 'chapter', 'journal', 'newspaper', 'magazine', 'report'] as SourceType[]).includes(type),
    publisher: (['book', 'chapter', 'website', 'report', 'map'] as SourceType[]).includes(type),
    place: (['book', 'chapter', 'report', 'map', 'interview'] as SourceType[]).includes(type),
    year: true,
    date: (['newspaper', 'magazine', 'website', 'interview'] as SourceType[]).includes(type),
    url: true,
    access_date: (['website', 'journal'] as SourceType[]).includes(type) || hasUrl,
    archive: (['archive', 'manuscript', 'interview'] as SourceType[]).includes(type),
    archive_location: (['archive', 'manuscript', 'interview'] as SourceType[]).includes(type),
  };
  const v = map[key];
  return typeof v === 'boolean' ? v : Array.isArray(v) ? v.includes(type) : false;
}

export function containerTitleLabel(type: SourceType | undefined): string {
  if (type === 'journal' || type === 'magazine') return 'Journal / magazine';
  if (type === 'newspaper') return 'Newspaper';
  if (type === 'website') return 'Website name';
  if (type === 'archive') return 'Collection';
  return 'Container title';
}
