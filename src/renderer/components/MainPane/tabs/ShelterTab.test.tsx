import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import architecturesReducer from '../../../store/architecturesSlice';
import categoriesReducer from '../../../store/categoriesSlice';
import aiSettingsReducer from '../../../store/aiSettingsSlice';
import uiReducer, { type UiState } from '../../../store/uiSlice';
import ShelterTab from './ShelterTab';
import type { Architecture, Photo, Shelter } from '../../../../shared/ipc-types';

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

function makeArchitecture(overrides: Partial<Architecture> = {}): Architecture {
  return {
    id: 1, name: 'Adirondack', description: '', created: '2020-01-01', updated: '2020-01-02', ...overrides,
  };
}

function makeStore(shelter: Shelter, photos: Photo[] = [], architectures: Architecture[] = [], apiKey = 'sk-ant-valid') {
  return configureStore({
    reducer: {
      shelters: sheltersReducer,
      photos: photosReducer,
      architectures: architecturesReducer,
      categories: categoriesReducer,
      aiSettings: aiSettingsReducer,
      ui: uiReducer,
    },
    preloadedState: {
      aiSettings: { apiKey },
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
        historyMissing: false,
      },
      photos: {
        byShelter: { [shelter.id]: photos },
        originals: {},
        loading: false,
        uploading: false,
      },
      architectures: { list: architectures, loading: false, error: null },
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
      } as UiState,
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
    // finalUrl = shelter:///tmp/repo%20root/shelters/default%20view.jpg?size=preview (US3: preview-size thumbnail)
    expect(img.src).toBe('shelter:///tmp/repo%20root/shelters/default%20view.jpg?size=preview');
    expect(screen.queryByText(/1 photos · 1 published/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1932–present/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /choose default photo/i }));

    expect(screen.getByRole('dialog', { name: /choose default photo/i })).toBeInTheDocument();
    expect(screen.getAllByAltText(/birch glen lodge seen from the trail/i)).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /choose default photo/i })).not.toBeInTheDocument();
    });
  });

  it('ArrowRight and ArrowLeft keys navigate photos in the default-photo modal', async () => {
    const shelter = makeShelter();
    const photoA = makePhoto({ id: 11, title: 'A', alt_text: 'Photo A' });
    const photoB = makePhoto({ id: 12, title: 'B', alt_text: 'Photo B', file_name: 'b.jpg' });
    const store = makeStore(shelter, [photoA, photoB]);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(window.api.app.getRepoRoot).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole('button', { name: /choose default photo/i }));
    expect(screen.getByRole('dialog', { name: /choose default photo/i })).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeInTheDocument();
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
    expect(img.src).toBe('shelter:///tmp/repo%20root/shelters/birch-glen-lodge/legacy-photo.png?size=preview');
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

  it('shows "---" in the Architecture dropdown when the shelter has no architecture set, rather than defaulting to the first option', async () => {
    const shelter = makeShelter({ architecture: '' });
    const architectures = [makeArchitecture({ id: 1, name: 'Adirondack' }), makeArchitecture({ id: 2, name: 'Lean-to' })];
    const store = makeStore(shelter, [], architectures);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

    expect(screen.getByRole('combobox', { name: 'Architecture' })).toHaveValue('');
  });

  it('shows the shelter\'s architecture selected in the dropdown when one is set', async () => {
    const shelter = makeShelter({ architecture: 'Lean-to' });
    const architectures = [makeArchitecture({ id: 1, name: 'Adirondack' }), makeArchitecture({ id: 2, name: 'Lean-to' })];
    const store = makeStore(shelter, [], architectures);

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

    expect(screen.getByRole('combobox', { name: 'Architecture' })).toHaveValue('Lean-to');
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
      expect(window.api.shelters.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Birch Glen Shelter' }),
        expect.any(String),
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/all changes saved/i)).toBeInTheDocument();
    });
  });

  it('shows an error toast when saving is rejected (e.g. duplicate slug)', async () => {
    const shelter = makeShelter();
    const store = makeStore(shelter, [makePhoto()]);

    window.api.shelters.update = jest.fn().mockRejectedValue(new Error('Slug "other-slug" is already in use'));

    render(
      <Provider store={store}>
        <ShelterTab />
      </Provider>,
    );

    await waitFor(() => {
      expect(window.api.app.getRepoRoot).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByDisplayValue('birch-glen-lodge'), { target: { value: 'other-slug' } });
    fireEvent.click(screen.getByRole('button', { name: /save record/i }));

    await waitFor(() => {
      expect(store.getState().ui.toast?.message).toBe('Slug "other-slug" is already in use');
    });
  });

  describe('Extract From History', () => {
    beforeEach(() => {
      // ShelterTab's own loadApiKey() effect re-fetches the key on mount, which
      // would otherwise overwrite the store's preloaded apiKey with this mock's
      // default ('') shortly after render — match it to what each test needs.
      window.api.ai.getApiKey = jest.fn().mockResolvedValue('sk-ant-valid');
      // This file has no global clearAllMocks, so an earlier test's call to
      // shelters.update would otherwise still be on this mock's call history.
      (window.api.shelters.update as jest.Mock).mockClear();
    });

    it('is disabled with a "requires AI API key" title when no valid key is configured', async () => {
      const shelter = makeShelter();
      const store = makeStore(shelter, [], [], '');
      window.api.ai.getApiKey = jest.fn().mockResolvedValue('');
      render(<Provider store={store}><ShelterTab /></Provider>);
      await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

      const button = screen.getByRole('button', { name: /extract from history/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', expect.stringContaining('requires AI API key'));
    });

    it('reads the history file, calls generateDescription with the shelter facts, and shows the result in a review modal', async () => {
      const shelter = makeShelter();
      const store = makeStore(shelter);
      window.api.history.read = jest.fn().mockResolvedValue({ content: '# Birch Glen Lodge\n\nBuilt in 1932.', missing: false });
      window.api.shelters.generateDescription = jest.fn().mockResolvedValue({ ok: true, description: 'A cozy Adirondack lean-to built in 1932.' });

      render(<Provider store={store}><ShelterTab /></Provider>);
      await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /extract from history/i }));

      await waitFor(() => expect(window.api.shelters.generateDescription).toHaveBeenCalledTimes(1));
      const req = (window.api.shelters.generateDescription as jest.Mock).mock.calls[0][0];
      expect(req.shelter.name).toBe('Birch Glen Lodge');
      expect(req.historyContent).toBe('# Birch Glen Lodge\n\nBuilt in 1932.');

      expect(await screen.findByRole('dialog', { name: /extract.*description/i })).toBeInTheDocument();
      expect(screen.getByText('A cozy Adirondack lean-to built in 1932.')).toBeInTheDocument();
    });

    it('treats a missing history file as blank history content, not an error', async () => {
      const shelter = makeShelter();
      const store = makeStore(shelter);
      window.api.history.read = jest.fn().mockResolvedValue({ content: '', missing: true });
      window.api.shelters.generateDescription = jest.fn().mockResolvedValue({ ok: true, description: 'A description from facts alone.' });

      render(<Provider store={store}><ShelterTab /></Provider>);
      await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /extract from history/i }));

      await waitFor(() => expect(window.api.shelters.generateDescription).toHaveBeenCalledTimes(1));
      const req = (window.api.shelters.generateDescription as jest.Mock).mock.calls[0][0];
      expect(req.historyContent).toBe('');
    });

    it('Accept replaces the description field and closes the modal, without saving', async () => {
      const shelter = makeShelter({ description: 'Old description.' });
      const store = makeStore(shelter);
      window.api.history.read = jest.fn().mockResolvedValue({ content: '', missing: true });
      window.api.shelters.generateDescription = jest.fn().mockResolvedValue({ ok: true, description: 'New extracted description.' });

      render(<Provider store={store}><ShelterTab /></Provider>);
      await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /extract from history/i }));
      await screen.findByText('New extracted description.');
      fireEvent.click(screen.getByRole('button', { name: /^accept$/i }));

      expect(screen.queryByRole('dialog', { name: /extract.*description/i })).not.toBeInTheDocument();
      expect(store.getState().shelters.editBuffer?.description).toBe('New extracted description.');
      expect(window.api.shelters.update).not.toHaveBeenCalled();
    });

    it('Reject leaves the description field unchanged and closes the modal', async () => {
      const shelter = makeShelter({ description: 'Old description.' });
      const store = makeStore(shelter);
      window.api.history.read = jest.fn().mockResolvedValue({ content: '', missing: true });
      window.api.shelters.generateDescription = jest.fn().mockResolvedValue({ ok: true, description: 'New extracted description.' });

      render(<Provider store={store}><ShelterTab /></Provider>);
      await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /extract from history/i }));
      await screen.findByText('New extracted description.');
      fireEvent.click(screen.getByRole('button', { name: /^reject$/i }));

      expect(screen.queryByRole('dialog', { name: /extract.*description/i })).not.toBeInTheDocument();
      expect(store.getState().shelters.editBuffer?.description).toBe('Old description.');
    });

    it('shows an inline error and a Dismiss button when generation fails', async () => {
      const shelter = makeShelter();
      const store = makeStore(shelter);
      window.api.history.read = jest.fn().mockResolvedValue({ content: '', missing: true });
      window.api.shelters.generateDescription = jest.fn().mockResolvedValue({ ok: false, error: 'network' });

      render(<Provider store={store}><ShelterTab /></Provider>);
      await waitFor(() => expect(window.api.app.getRepoRoot).toHaveBeenCalled());

      fireEvent.click(screen.getByRole('button', { name: /extract from history/i }));

      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByRole('dialog', { name: /extract.*description/i })).not.toBeInTheDocument();
    });
  });
});
