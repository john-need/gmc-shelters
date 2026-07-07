import { citeChicago, citeChicagoMarkdown } from './cite-chicago';
import type { Source } from './ipc-types';

const defaultSource: Source = {
  id: 1,
  shelter_id: 1,
  include_in_history: false,
  type: 'book',
  author: 'Doe, Jane',
  title: 'A Test Book',
  container_title: '', container_author: '',
  editor: '',
  edition: '',
  volume: '',
  issue: '',
  pages: '',
  publisher: 'Test Press',
  place: 'Burlington',
  year: 2000,
  date: '',
  url: '',
  access_date: '',
  archive: '',
  archive_location: '',
  annotation: '',
  quote: '',
  notes: '',
  created: '2026-05-15',
  updated: '2026-05-15',
};

describe('citeChicago (stub)', () => {
  it('returns a string', () => {
    expect(typeof citeChicago(defaultSource)).toBe('string');
  });

  it('does not throw for any source type', () => {
    const types: Source['type'][] = [
      'book', 'chapter', 'journal', 'newspaper', 'magazine',
      'website', 'archive', 'manuscript', 'interview', 'map', 'report', 'other',
    ];
    for (const type of types) {
      expect(() => citeChicago({ ...defaultSource, type })).not.toThrow();
    }
  });

  it('renders markdown-style Chicago citation text, with the publisher marked distinctly', () => {
    expect(citeChicagoMarkdown(defaultSource)).toBe(
      'Doe, Jane. *A Test Book*. Burlington: **Test Press**, 2000.',
    );
  });

  it('omits the book title and year in compact mode, for views that already show them as a heading', () => {
    expect(citeChicago(defaultSource, true)).toBe(
      'Doe, Jane. Burlington: <strong>Test Press</strong>.',
    );
  });

  it('omits the magazine title in compact mode', () => {
    expect(
      citeChicago({
        ...defaultSource,
        type: 'magazine',
        author: 'Doe, Jane',
        title: 'Shelter Life',
        container_title: 'Trail Weekly',
        publisher: '',
        year: 1984,
        date: '1984-05-14',
        pages: '',
        url: '',
      }, true),
    ).toBe('Doe, Jane, <em>Trail Weekly</em>, 1984.');
  });

  it('renders magazine citations with author, article title, publication, and year', () => {
    expect(
      citeChicagoMarkdown({
        ...defaultSource,
        type: 'magazine',
        author: 'Doe, Jane',
        title: 'Shelter Life',
        container_title: 'Trail Weekly',
        publisher: '',
        year: 1984,
        date: '1984-05-14',
        pages: '',
        url: '',
      }),
    ).toBe('Doe, Jane, "Shelter Life." *Trail Weekly*, 1984.');
  });

  it('renders magazine/newsletter citations with volume, issue, and publisher when set', () => {
    expect(
      citeChicagoMarkdown({
        ...defaultSource,
        type: 'magazine',
        author: '',
        title: '',
        container_title: 'Long Trail News',
        publisher: 'Green Mountain Club',
        volume: '5',
        issue: '2',
        year: 1922,
        date: '',
        pages: '2',
        url: '',
      }),
    ).toBe('*Long Trail News* 5, no. 2 (1922). Green Mountain Club. 2.');
  });

  it('renders magazine citations in sources tab html with requested punctuation', () => {
    expect(
      citeChicago({
        ...defaultSource,
        type: 'magazine',
        author: 'Doe, Jane',
        title: 'Shelter Life',
        container_title: 'Trail Weekly',
        publisher: '',
        year: 1984,
        date: '1984-05-14',
        pages: '',
        url: '',
      }),
    ).toBe('Doe, Jane, "Shelter Life." <em>Trail Weekly</em>, 1984.');
  });
});
