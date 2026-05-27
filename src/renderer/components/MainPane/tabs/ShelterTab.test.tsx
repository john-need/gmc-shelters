import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import architecturesReducer from '../../../store/architecturesSlice';
import categoriesReducer from '../../../store/categoriesSlice';
import uiReducer from '../../../store/uiSlice';
import ShelterTab from './ShelterTab';
import type { Photo, Shelter } from '../../../../shared/ipc-types';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 7,
    name: 'Birch Glen Lodge',
    slug: 'birch-glen-lodge',
    start_year: 1932,
    end_year: null,
    description: 'A long-running shelter record used for renderer tests.',
    default_photo_id: 11,
    is_gmc: true,
    architecture: 'Adirondack',
    built_by: 'Green Mountain Club',
    notes: 'Internal notes',
    created: '2020-01-01',
    updated: '2020-01-02',
    is_extant: true,
    category: 'Lean-to',
    show_on_web: true,
    history: 'birch-glen-lodge/birch-glen-lodge.md',
    photo_count: 1,
    ...overrides,
  };
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 11,
    shelter_id: 7,
    file_name: 'default view.jpg',
    title: 'Default View',
    photographer: 'Jane Doe',
    caption: 'Looking south from the porch.',
    date_taken: '1984-09-15',
    notes: '',
    created: '2020-01-01',
    updated: '2020-01-01',
    alt_text: 'Birch Glen Lodge seen from the trail',
    description: '',
    include_in_post: true,
    ...overrides,
  };
}

function makeStore(shelter: Shelter, photos: Photo[] = []) {
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
        historyContent: '',
        historyOriginal: '',
        historyDirty: false,
      },
      photos: {
        byShelter: { [shelter.id]: photos },
        loading: false,
        uploading: false,
      },
      architectures: { list: [], loading: false, error: null },
      categories: { list: [], loading: false, error: null },
      ui: {
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
      },
    },
  });
}

describe('ShelterTab', () => {
  beforeEach(() => {
    window.api.app.getRepoRoot = jest.fn().mockResolvedValue('/tmp/repo root');
  });

  it('renders the default photo summary and opens the modal preview', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(window.api.app.getRepoRoot).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByAltText(/birch glen lodge seen from the trail/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Default View')).toBeInTheDocument();
    
    // Check photo URL - legacy path
    const img = screen.getByAltText('Birch Glen Lodge seen from the trail') as HTMLImageElement;
    // base = /tmp/repo root/shelters (since default sheltersRoot is 'shelters/')
    // fileName = default view.jpg
    // finalUrl = shelter:///tmp/repo%20root/shelters/default%20view.jpg
    expect(img.src).toBe('shelter:///tmp/repo%20root/shelters/default%20view.jpg');
    expect(screen.getByText(/photo id 11/i)).toBeInTheDocument();
    expect(screen.queryByText(/1 photos · 1 published/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1932–present/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /open default photo preview/i }));

    expect(screen.getByRole('dialog', { name: /default photo preview/i })).toBeInTheDocument();
    expect(screen.getAllByAltText(/birch glen lodge seen from the trail/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /close default photo preview/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /default photo preview/i })).not.toBeInTheDocument();
    });
  });

  it('strips redundant shelters/ prefix from legacy filenames', async () => {
    const shelter = makeShelter();
    const photo = makePhoto({ 
        file_name: 'shelters/birch-glen-lodge/legacy-photo.png',
        alt_text: 'Legacy photo'
    });
    const store = makeStore(shelter, [photo]);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByAltText(/legacy photo/i)).toBeInTheDocument();
    });

    const img = screen.getByAltText('Legacy photo') as HTMLImageElement;
    expect(img.src).toBe('shelter:///tmp/repo%20root/shelters/birch-glen-lodge/legacy-photo.png');
  });

  it('shows the empty default-photo message when none is selected', async () => {
    const shelter = makeShelter({ default_photo_id: null, photo_count: 0 });
    const store = makeStore(shelter, []);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(window.api.app.getRepoRoot).toHaveBeenCalled();
    });

    expect(screen.getByText(/no default photo selected/i)).toBeInTheDocument();
    expect(screen.getByText(/pick a lead image in the photos tab/i)).toBeInTheDocument();
  });

  it('reverts edited fields back to the selected shelter state', async () => {
    const shelter = makeShelter();
    const store = makeStore(shelter, [makePhoto()]);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(window.api.app.getRepoRoot).toHaveBeenCalled();
    });

    const nameInput = screen.getByDisplayValue('Birch Glen Lodge');
    fireEvent.change(nameInput, { target: { value: 'Refined Birch Glen Lodge' } });

    expect(screen.getByRole('button', { name: /revert/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /revert/i }));

    expect(screen.getByDisplayValue('Birch Glen Lodge')).toBeInTheDocument();
  });

  it('saves the edited shelter through the IPC update path', async () => {
    const shelter = makeShelter();
    const updatedShelter = makeShelter({ name: 'Birch Glen Shelter', updated: '2020-01-03' });
    const store = makeStore(shelter, [makePhoto()]);

    window.api.shelters.update = jest.fn().mockResolvedValue(updatedShelter);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(window.api.app.getRepoRoot).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByDisplayValue('Birch Glen Lodge'), { target: { value: 'Birch Glen Shelter' } });
    fireEvent.click(screen.getByRole('button', { name: /save record/i }));

    await waitFor(() => {
      expect(window.api.shelters.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Birch Glen Shelter' }));
    });

    await waitFor(() => {
      expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
    });
  });
});
