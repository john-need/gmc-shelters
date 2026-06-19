import sourcesReducer, {
  loadSources,
  createSource,
  updateSource,
  deleteSource,
  SourcesState,
} from './sourcesSlice';
import type { Source } from '@shared/ipc-types';

const source = (overrides: Partial<Source> = {}): Source => ({
  id: 1,
  shelter_id: 10,
  include_in_history: false,
  type: 'book',
  author: 'Doe',
  title: 'Test Book',
  container_title: '',
  editor: '',
  edition: '',
  volume: '',
  issue: '',
  pages: '',
  publisher: '',
  place: '',
  year: null,
  date: '',
  url: '',
  access_date: '',
  archive: '',
  archive_location: '',
  annotation: '',
  notes: '',
  quote: '',
  created: '2020-01-01',
  updated: '2020-01-01',
  ...overrides,
});

const initialState: SourcesState = { byShelter: {}, loading: false };

describe('sourcesSlice', () => {
  it('has correct initial state', () => {
    expect(sourcesReducer(undefined, { type: '@@init' })).toEqual(initialState);
  });

  describe('loadSources', () => {
    it('sets loading on pending', () => {
      const next = sourcesReducer(initialState, loadSources.pending('', 10));
      expect(next.loading).toBe(true);
    });

    it('stores sources and clears loading on fulfilled', () => {
      const sources = [source()];
      const next = sourcesReducer(
        { ...initialState, loading: true },
        loadSources.fulfilled({ shelterId: 10, sources }, '', 10),
      );
      expect(next.loading).toBe(false);
      expect(next.byShelter[10]).toEqual(sources);
    });

    it('clears loading on rejected', () => {
      const next = sourcesReducer(
        { ...initialState, loading: true },
        loadSources.rejected(new Error('err'), '', 10),
      );
      expect(next.loading).toBe(false);
    });
  });

  describe('createSource', () => {
    it('prepends source to shelter list on fulfilled', () => {
      const existing = source({ id: 1, title: 'First' });
      const state: SourcesState = { byShelter: { 10: [existing] }, loading: false };
      const newSource = source({ id: 2, title: 'Second' });
      const input = { shelter_id: 10, include_in_history: false, type: 'book' as const, author: '', title: 'Second', container_title: '', editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '', place: '', year: null, date: '', url: '', access_date: '', archive: '', archive_location: '', annotation: '', notes: '', quote: '' };
      const next = sourcesReducer(
        state,
        createSource.fulfilled({ shelterId: 10, source: newSource }, '', input),
      );
      expect(next.byShelter[10][0].id).toBe(2);
      expect(next.byShelter[10]).toHaveLength(2);
    });

    it('creates list if none exists yet', () => {
      const newSource = source({ id: 1 });
      const input = { shelter_id: 10, include_in_history: false, type: 'book' as const, author: '', title: '', container_title: '', editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '', place: '', year: null, date: '', url: '', access_date: '', archive: '', archive_location: '', annotation: '', notes: '', quote: '' };
      const next = sourcesReducer(
        initialState,
        createSource.fulfilled({ shelterId: 10, source: newSource }, '', input),
      );
      expect(next.byShelter[10]).toHaveLength(1);
    });
  });

  describe('updateSource', () => {
    it('replaces source in list on fulfilled', () => {
      const old = source({ id: 5, author: 'Old' });
      const updated = source({ id: 5, author: 'New' });
      const state: SourcesState = { byShelter: { 10: [old] }, loading: false };
      const next = sourcesReducer(
        state,
        updateSource.fulfilled({ shelterId: 10, source: updated }, '', updated),
      );
      expect(next.byShelter[10][0].author).toBe('New');
    });
  });

  describe('deleteSource', () => {
    it('removes source from list on fulfilled', () => {
      const state: SourcesState = {
        byShelter: { 10: [source({ id: 1 }), source({ id: 2 })] },
        loading: false,
      };
      const next = sourcesReducer(
        state,
        deleteSource.fulfilled({ id: 1, shelterId: 10 }, '', { id: 1, shelterId: 10 }),
      );
      expect(next.byShelter[10]).toHaveLength(1);
      expect(next.byShelter[10][0].id).toBe(2);
    });
  });
});
