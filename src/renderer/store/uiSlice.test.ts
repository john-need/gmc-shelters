import uiReducer, {
  setActiveTab,
  setSidebarCollapsed,
  setQuery,
  setFilter,
  showToast,
  clearToast,
} from './uiSlice';
import type { UiState } from './uiSlice';

describe('uiSlice', () => {
  const initial: UiState = {
    sidebarCollapsed: false,
    activeTab: 'shelter',
    query: '',
    filter: 'all',
    advancedFilters: {
      yearMin: '',
      yearMax: '',
      architecture: '',
      builtBy: '',
      category: '',
      showOnWeb: 'any',
    },
    toast: null,
  };

  it('has correct initial state', () => {
    expect(uiReducer(undefined, { type: '@@INIT' })).toEqual(initial);
  });

  it('setActiveTab updates activeTab', () => {
    const state = uiReducer(initial, setActiveTab('photos'));
    expect(state.activeTab).toBe('photos');
  });

  it('setSidebarCollapsed toggles sidebar', () => {
    const state = uiReducer(initial, setSidebarCollapsed(true));
    expect(state.sidebarCollapsed).toBe(true);
  });

  it('setQuery updates search query', () => {
    const state = uiReducer(initial, setQuery('birch glen'));
    expect(state.query).toBe('birch glen');
  });

  it('setFilter updates filter', () => {
    const state = uiReducer(initial, setFilter('extant'));
    expect(state.filter).toBe('extant');
  });

  it('showToast sets toast message', () => {
    const state = uiReducer(initial, showToast({ id: '1', message: 'Saved' }));
    expect(state.toast).toEqual({ id: '1', message: 'Saved' });
  });

  it('clearToast resets toast to null', () => {
    const withToast = uiReducer(initial, showToast({ id: '1', message: 'Saved' }));
    const cleared = uiReducer(withToast, clearToast());
    expect(cleared.toast).toBeNull();
  });
});
