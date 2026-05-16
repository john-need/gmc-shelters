import { citeChicago } from './cite-chicago';
import type { Source } from './ipc-types';

const defaultSource: Source = {
  id: 1,
  shelter_id: 1,
  type: 'book',
  author: 'Doe, Jane',
  title: 'A Test Book',
  container_title: '',
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
});
