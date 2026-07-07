import { wikiResultToSource } from './wiki-cite';
import type { WikiSearchResult } from './ipc-types';

const BASE: WikiSearchResult = {
  path: 'long-trail-news/1922_12_Dec.md',
  okf_type: 'Newsletter',
  title: 'Long Trail News',
  publisher: 'Green Mountain Club',
  volume: '1922',
  edition: 'December',
  printed_volume: '',
  printed_issue: '',
  author: 'Green Mountain Club',
  publication_date: '1922-12',
  resource: 'collections/long-trail-news/1922_12_Dec.pdf',
  citation_type: 'magazine',
  kind: 'page',
  page: 3,
  image: '',
  snippet: 'The <mark>Monroe Lodge</mark> will be built…next year.',
};

describe('wikiResultToSource', () => {
  it('maps a page hit to a magazine source with page number and quote', () => {
    const src = wikiResultToSource(BASE);
    expect(src.type).toBe('magazine');
    expect(src.container_title).toBe('Long Trail News');
    expect(src.title).toBeFalsy();
    expect(src.author).toBe('Green Mountain Club');
    expect(src.publisher).toBe('Green Mountain Club');
    expect(src.pages).toBe('3');
    expect(src.year).toBe(1922);
    expect(src.date).toBe('1922-12');
    expect(src.archive_location).toBe('collections/long-trail-news/1922_12_Dec.pdf');
    expect(src.quote).toBe('The Monroe Lodge will be built...next year.');
  });

  it('maps a book hit\'s document title/author into `title`/`author`, not `container_title`', () => {
    const src = wikiResultToSource({
      ...BASE, citation_type: 'book', title: 'Long Trail System Shelter History',
      author: 'Woodward, Paul & Joanne', publication_date: '1999-09-29', edition: '2nd',
    });
    expect(src.type).toBe('book');
    expect(src.title).toBe('Long Trail System Shelter History');
    expect(src.author).toBe('Woodward, Paul & Joanne');
    expect(src.container_title).toBe('');
    expect(src.edition).toBe('2nd');
    expect(src.year).toBe(1999);
  });

  it('maps chapter and report hits the same way as book (they share the book citation format)', () => {
    for (const citation_type of ['chapter', 'report'] as const) {
      const src = wikiResultToSource({ ...BASE, citation_type, title: 'A Section' });
      expect(src.title).toBe('A Section');
      expect(src.container_title).toBe('');
    }
  });

  it('always uses the document\'s real title, even when it equals its own collection/folder name', () => {
    // The folder/collection name is irrelevant to whether a title is legitimate —
    // a periodical's title (e.g. "Long Trail News") is *supposed* to equal its
    // collection name; that's not a sign of a missing/generic title.
    const src = wikiResultToSource({
      ...BASE,
      path: 'Long Trail News/1946_08_Aug.md',
      title: 'Long Trail News',
      citation_type: 'magazine',
    });
    expect(src.container_title).toBe('Long Trail News');
  });

  it('derives the year from publication_date, preferring it over volume', () => {
    const src = wikiResultToSource({ ...BASE, publication_date: '1917', volume: '9999' });
    expect(src.year).toBe(1917);
  });

  it('falls back to parsing volume as the year when publication_date is blank', () => {
    const src = wikiResultToSource({ ...BASE, publication_date: '' });
    expect(src.year).toBe(1922);
  });

  it('prefers printed volume and issue for the citation when available', () => {
    const src = wikiResultToSource({ ...BASE, printed_volume: '5', printed_issue: '2' });
    expect(src.volume).toBe('5');
    expect(src.issue).toBe('2');
  });

  it('falls back to the year as volume when no printed numbers exist', () => {
    const src = wikiResultToSource(BASE);
    expect(src.volume).toBe('1922');
    expect(src.issue).toBe('');
  });

  it('maps books to book type', () => {
    const src = wikiResultToSource({ ...BASE, okf_type: 'Book', citation_type: 'book' });
    expect(src.type).toBe('book');
  });

  it('trusts the header-authored citation_type even when okf_type is generic', () => {
    const src = wikiResultToSource({ ...BASE, okf_type: 'Publication', citation_type: 'report' });
    expect(src.type).toBe('report');
  });

  it('falls back to guessing from okf_type when citation_type is blank (pre-fix docs)', () => {
    const src = wikiResultToSource({ ...BASE, okf_type: 'Newsletter', citation_type: '' });
    expect(src.type).toBe('magazine');
  });

  it('uses the caption as quote for illustration hits', () => {
    const src = wikiResultToSource({
      ...BASE,
      kind: 'illustration',
      snippet: '<mark>Monroe Lodge</mark> under construction',
    });
    expect(src.quote).toBe('Monroe Lodge under construction');
  });
});
