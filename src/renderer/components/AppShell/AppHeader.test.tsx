import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from '../../store/uiSlice';
import sheltersReducer from '../../store/sheltersSlice';
import photosReducer from '../../store/photosSlice';
import sourcesReducer from '../../store/sourcesSlice';
import AppHeader from './AppHeader';

function makeStore(shelterCount = 0) {
  return configureStore({
    reducer: { ui: uiReducer, shelters: sheltersReducer, photos: photosReducer, sources: sourcesReducer },
    preloadedState: {
      shelters: {
        list: Array.from({ length: shelterCount }, (_, i) => ({
          id: i + 1, name: `Shelter ${i + 1}`, slug: `shelter-${i + 1}`,
          start_year: 1960, end_year: null, description: '', category: 'lean-to',
          architecture: '', built_by: '', notes: '',
          is_extant: true, is_gmc: false, show_on_web: false, default_photo_id: null, history: null,
          created: '2020-01-01', updated: '2020-01-01', photo_count: 0,
        })),
        selectedId: null, editBuffer: null, loading: false, saving: false,
        dirty: false, historyContent: '', historyOriginal: '', historyDirty: false, historyMissing: false,
      },
    },
  });
}

describe('AppHeader', () => {
  it('renders the New shelter button', () => {
    const store = makeStore();
    const onNew = jest.fn();
    render(<Provider store={store}><AppHeader onNewShelter={onNew} onOpenSettings={jest.fn()} /></Provider>);
    expect(screen.getByText('New shelter')).toBeInTheDocument();
  });

  it('calls onNewShelter when New shelter is clicked', () => {
    const store = makeStore();
    const onNew = jest.fn();
    render(<Provider store={store}><AppHeader onNewShelter={onNew} onOpenSettings={jest.fn()} /></Provider>);
    fireEvent.click(screen.getByText('New shelter'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('shows record count from store', () => {
    const store = makeStore(5);
    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={jest.fn()} /></Provider>);
    expect(screen.getByText(/5 records/)).toBeInTheDocument();
  });

  it('dispatches toast when Publish to web is clicked', () => {
    const store = makeStore();
    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={jest.fn()} /></Provider>);
    fireEvent.click(screen.getByText('Publish to web'));
    expect(store.getState().ui.toast).not.toBeNull();
    expect(store.getState().ui.toast?.message).toMatch(/publish/i);
  });
});
