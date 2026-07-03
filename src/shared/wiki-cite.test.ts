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
    expect(src.publisher).toBe('Green Mountain Club');
    expect(src.pages).toBe('3');
    expect(src.year).toBe(1922);
    expect(src.date).toBe('December 1922');
    expect(src.archive_location).toBe('collections/long-trail-news/1922_12_Dec.pdf');
    expect(src.quote).toBe('The Monroe Lodge will be built...next year.');
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
