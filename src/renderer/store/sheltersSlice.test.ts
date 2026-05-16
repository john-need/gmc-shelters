import sheltersReducer, {
  setSelectedId,
  setDirty,
  setHistoryDirty,
  setEditBuffer,
  clearDirty,
} from './sheltersSlice';
import type { SheltersState } from './sheltersSlice';

describe('sheltersSlice', () => {
  const initial: SheltersState = {
    list: [],
    selectedId: null,
    editBuffer: null,
    loading: false,
    saving: false,
    dirty: false,
    historyContent: '',
    historyDirty: false,
  };

  it('has correct initial state', () => {
    expect(sheltersReducer(undefined, { type: '@@INIT' })).toEqual(initial);
  });

  it('setSelectedId updates selectedId', () => {
    const state = sheltersReducer(initial, setSelectedId(5));
    expect(state.selectedId).toBe(5);
  });

  it('setSelectedId accepts null', () => {
    const withId = sheltersReducer(initial, setSelectedId(5));
    const cleared = sheltersReducer(withId, setSelectedId(null));
    expect(cleared.selectedId).toBeNull();
  });

  it('setDirty sets dirty flag', () => {
    const state = sheltersReducer(initial, setDirty(true));
    expect(state.dirty).toBe(true);
  });

  it('setHistoryDirty sets historyDirty flag', () => {
    const state = sheltersReducer(initial, setHistoryDirty(true));
    expect(state.historyDirty).toBe(true);
  });

  it('setEditBuffer stores the edit buffer', () => {
    const shelter = { id: 1, name: 'Test', slug: 'test' } as Parameters<typeof setEditBuffer>[0];
    const state = sheltersReducer(initial, setEditBuffer(shelter));
    expect(state.editBuffer).toEqual(shelter);
  });

  it('clearDirty resets dirty and historyDirty', () => {
    const dirty = sheltersReducer(
      sheltersReducer(initial, setDirty(true)),
      setHistoryDirty(true),
    );
    const cleared = sheltersReducer(dirty, clearDirty());
    expect(cleared.dirty).toBe(false);
    expect(cleared.historyDirty).toBe(false);
  });
});
