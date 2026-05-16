import sheltersReducer, {
  setSelectedId,
  setEditBuffer,
  revertEditBuffer,
  setHistoryContent,
  clearDirty,
} from './sheltersSlice';
import type { SheltersState } from './sheltersSlice';
import type { Shelter } from '../../shared/ipc-types';

const mockShelter: Shelter = {
  id: 1, name: 'Test Shelter', slug: 'test-shelter',
  start_year: 1940, end_year: null, description: '',
  latitude: 44.0, longitude: -72.8, default_photo_id: null,
  is_gmc: true, architecture: '', built_by: '', notes: '',
  created: '2020-01-01', updated: '2020-01-01',
  is_extant: true, category: 'Shelter', show_on_web: false, photo_count: 0,
};

const initial: SheltersState = {
  list: [],
  selectedId: null,
  editBuffer: null,
  loading: false,
  saving: false,
  dirty: false,
  historyContent: '',
  historyOriginal: '',
  historyDirty: false,
};

describe('sheltersSlice', () => {
  it('has correct initial state', () => {
    expect(sheltersReducer(undefined, { type: '@@INIT' })).toEqual(initial);
  });

  it('setSelectedId updates selectedId and clears dirty', () => {
    const state = sheltersReducer({ ...initial, dirty: true }, setSelectedId(5));
    expect(state.selectedId).toBe(5);
    expect(state.dirty).toBe(false);
    expect(state.historyDirty).toBe(false);
  });

  it('setSelectedId accepts null and clears editBuffer', () => {
    const withId = sheltersReducer({ ...initial, list: [mockShelter] }, setSelectedId(1));
    const cleared = sheltersReducer(withId, setSelectedId(null));
    expect(cleared.selectedId).toBeNull();
    expect(cleared.editBuffer).toBeNull();
  });

  it('setSelectedId populates editBuffer from list', () => {
    const withShelter = { ...initial, list: [mockShelter] };
    const state = sheltersReducer(withShelter, setSelectedId(1));
    expect(state.editBuffer).toEqual(mockShelter);
  });

  it('setEditBuffer stores the edit buffer', () => {
    const state = sheltersReducer(initial, setEditBuffer(mockShelter));
    expect(state.editBuffer).toEqual(mockShelter);
  });

  it('setEditBuffer marks dirty when buffer differs from list', () => {
    const withShelter = { ...initial, list: [mockShelter], selectedId: 1, editBuffer: mockShelter };
    const state = sheltersReducer(withShelter, setEditBuffer({ ...mockShelter, name: 'Changed' }));
    expect(state.dirty).toBe(true);
  });

  it('revertEditBuffer restores from list', () => {
    const withEdits = {
      ...initial,
      list: [mockShelter],
      selectedId: 1,
      editBuffer: { ...mockShelter, name: 'Changed' },
      dirty: true,
    };
    const state = sheltersReducer(withEdits, revertEditBuffer());
    expect(state.editBuffer).toEqual(mockShelter);
    expect(state.dirty).toBe(false);
  });

  it('setHistoryContent marks historyDirty when changed', () => {
    const withOriginal = { ...initial, historyOriginal: '# Original' };
    const state = sheltersReducer(withOriginal, setHistoryContent('# Changed'));
    expect(state.historyContent).toBe('# Changed');
    expect(state.historyDirty).toBe(true);
  });

  it('setHistoryContent clears historyDirty when matches original', () => {
    const withContent = { ...initial, historyOriginal: '# Same', historyContent: '# Changed', historyDirty: true };
    const state = sheltersReducer(withContent, setHistoryContent('# Same'));
    expect(state.historyDirty).toBe(false);
  });

  it('clearDirty resets dirty and historyDirty', () => {
    const dirty = { ...initial, dirty: true, historyDirty: true };
    const cleared = sheltersReducer(dirty, clearDirty());
    expect(cleared.dirty).toBe(false);
    expect(cleared.historyDirty).toBe(false);
  });
});
