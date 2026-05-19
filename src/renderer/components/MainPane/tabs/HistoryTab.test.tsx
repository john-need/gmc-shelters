import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import architecturesReducer from '../../../store/architecturesSlice';
import categoriesReducer from '../../../store/categoriesSlice';
import uiReducer from '../../../store/uiSlice';
import HistoryTab from './HistoryTab';
import type { Shelter } from '../../../../shared/ipc-types';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 7,
    name: 'Aeolus View Camp',
    slug: 'aeolus-view-camp',
    start_year: 1932,
    end_year: null,
    description: '',
    default_photo_id: null,
    is_gmc: true,
    architecture: 'Adirondack',
    built_by: 'Green Mountain Club',
    notes: '',
    created: '2020-01-01',
    updated: '2020-01-02',
    is_extant: true,
    category: 'Lean-to',
    show_on_web: true,
    photo_count: 0,
    ...overrides,
  };
}

function makeStore(shelter: Shelter) {
  return configureStore({
    reducer: {
      shelters: sheltersReducer,
      photos: photosReducer,
      architectures: architecturesReducer,
      categories: categoriesReducer,
      ui: uiReducer,
    },
    preloadedState: {
      shelters: {
        list: [shelter],
        selectedId: shelter.id,
        editBuffer: shelter,
        loading: false,
        saving: false,
        dirty: false,
        historyContent: '# Camp history',
        historyOriginal: '# Camp history',
        historyDirty: false,
      },
      photos: {
        byShelter: { [shelter.id]: [] },
        loading: false,
        uploading: false,
      },
      architectures: { list: [], loading: false, error: null },
      categories: { list: [], loading: false, error: null },
      ui: {
        sidebarCollapsed: false,
        activeTab: 'history',
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
      },
    },
  });
}

describe('HistoryTab', () => {
  it('shows the slug-based markdown file path', () => {
    const store = makeStore(makeShelter());

    render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    expect(screen.getByText('/shelters/aeolus-view-camp/aeolus-view-camp.md')).toBeInTheDocument();
    expect(screen.getByText('Saved · aeolus-view-camp.md')).toBeInTheDocument();
  });

  it('uses the slug-based markdown file name in the save toast', async () => {
    const store = makeStore(makeShelter());
    window.api.history.write = jest.fn().mockResolvedValue(undefined);

    render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Updated history' } });
    fireEvent.click(screen.getByRole('button', { name: /save file/i }));

    await waitFor(() => {
      expect(window.api.history.write).toHaveBeenCalledWith('aeolus-view-camp', '# Updated history');
    });

    await waitFor(() => {
      expect(store.getState().ui.toast?.message).toBe('Saved · /shelters/aeolus-view-camp/aeolus-view-camp.md');
    });
  });
});
