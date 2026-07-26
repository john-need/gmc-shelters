import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import sourcesReducer from '../../../store/sourcesSlice';
import uiReducer, { type UiState } from '../../../store/uiSlice';
import aiSettingsReducer, { apiKeyChanged } from '../../../store/aiSettingsSlice';
import SourcesTab from './SourcesTab';
import type { Shelter, Source } from '../../../../shared/ipc-types';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 7,
    name: 'Birch Glen Lodge',
    slug: 'birch-glen-lodge',
    start_year: 1932,
    end_year: null,
    description: 'Renderer test shelter.',
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
    history: 'birch-glen-lodge/birch-glen-lodge.md',
    photo_count: 0,
    ...overrides,
  };
}

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 11,
    shelter_id: 7,
    include_in_history: false,
    type: 'book',
    author: '',
    title: '',
    container_title: '', container_author: '',
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
    updated: '2020-01-02',
    ...overrides,
  };
}

function makeStore(shelter: Shelter, sources: Source[] = [], apiKey = 'sk-ant-valid') {
  return configureStore({
    reducer: {
      shelters: sheltersReducer,
      sources: sourcesReducer,
      ui: uiReducer,
      aiSettings: aiSettingsReducer,
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
      sources: {
        byShelter: { [shelter.id]: sources },
        loading: false,
        cleaningQuoteIds: [],
      },
      ui: {
        sidebarCollapsed: false,
        activeTab: 'sources',
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

describe('SourcesTab', () => {
  it('saves a citation even when title and author are blank', async () => {
    const shelter = makeShelter();
    const createdSource = makeSource();
    const store = makeStore(shelter);

    window.api.sources.create = jest.fn().mockResolvedValue(createdSource);

    render(
      <Provider store={store}>
        <SourcesTab />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /add first source/i }));
    expect(screen.getByText(/add a new source/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /^add source$/i })[1]);

    await waitFor(() => {
      expect(window.api.sources.create).toHaveBeenCalledWith(
        expect.objectContaining({
          shelter_id: shelter.id,
          author: '',
          title: '',
        }),
      );
    });
  });

  it('toggles history inclusion and rewrites the history sources section', async () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));

    const shelter = makeShelter();
    const existingSource = makeSource({
      id: 21,
      author: 'Doe, Jane',
      title: 'Shelter Notes',
      include_in_history: false,
    });
    const updatedSource = { ...existingSource, include_in_history: true };
    const store = makeStore(shelter, [existingSource]);

    window.api.sources.update = jest.fn().mockResolvedValue(updatedSource);
    window.api.history.write = jest.fn().mockResolvedValue(undefined);

    render(
      <Provider store={store}>
        <SourcesTab />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: /include in history/i }));

    await waitFor(() => {
      expect(window.api.sources.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: existingSource.id,
          include_in_history: true,
        }),
      );
    });

    await waitFor(() => {
      expect(window.api.history.write).toHaveBeenCalledWith(
        shelter.history,
        expect.stringContaining('### Sources'),
        '/custom/shelters',
      );
    });
  });

  it('cite all adds every source to the history, not just the last one toggled', async () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));

    const shelter = makeShelter();
    const sourceA = makeSource({ id: 21, author: 'Doe, Jane', title: 'Shelter Notes', include_in_history: false });
    const sourceB = makeSource({ id: 22, author: 'Roe, Sam', title: 'Trail Records', include_in_history: false });
    const store = makeStore(shelter, [sourceA, sourceB]);

    window.api.sources.update = jest.fn().mockImplementation((s: Source) => Promise.resolve(s));
    window.api.history.write = jest.fn().mockResolvedValue(undefined);

    render(
      <Provider store={store}>
        <SourcesTab />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /cite all/i }));

    await waitFor(() => {
      expect(window.api.sources.update).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      const lastWrite = (window.api.history.write as jest.Mock).mock.calls.at(-1);
      expect(lastWrite[1]).toContain('Doe, Jane');
      expect(lastWrite[1]).toContain('Roe, Sam');
    });
  });

  it('gates the clean-up button on selectHasValidApiKey, reflecting store changes without remounting', async () => {
    const shelter = makeShelter();
    const existingSource = makeSource({ id: 21, quote: 'a messy quote' });
    const store = makeStore(shelter, [existingSource], '');

    render(
      <Provider store={store}>
        <SourcesTab />
      </Provider>,
    );

    expect(screen.getByTitle('Clean up quote (requires AI API key)')).toBeDisabled();

    store.dispatch(apiKeyChanged('sk-ant-newly-valid'));

    await waitFor(() => {
      expect(screen.getByTitle('Clean up quote')).not.toBeDisabled();
    });
  });

  it('wires each SourceCard\'s clean-up button to the cleanUpQuote thunk, reflecting cleaningQuoteIds', async () => {
    const shelter = makeShelter();
    const existingSource = makeSource({ id: 21, quote: 'a messy quote' });
    const store = makeStore(shelter, [existingSource]);
    window.api.sources.cleanUpQuote = jest.fn().mockResolvedValue({ ...existingSource, quote: 'clean quote' });
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('sk-ant-valid');

    render(
      <Provider store={store}>
        <SourcesTab />
      </Provider>,
    );

    fireEvent.click(screen.getByTitle('Clean up quote'));

    expect(window.api.sources.cleanUpQuote).toHaveBeenCalledWith({ id: 21, shelterId: shelter.id });
    // busy while the request is in flight
    expect(screen.getByTitle('Clean up quote')).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByTitle('Clean up quote')).not.toBeDisabled();
    });
  });

  it('shows an error toast and un-busies the button when clean-up fails', async () => {
    const shelter = makeShelter();
    const existingSource = makeSource({ id: 21, quote: 'a messy quote' });
    const store = makeStore(shelter, [existingSource]);
    window.api.sources.cleanUpQuote = jest.fn().mockRejectedValue(new Error('boom'));
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('sk-ant-valid');

    render(
      <Provider store={store}>
        <SourcesTab />
      </Provider>,
    );

    fireEvent.click(screen.getByTitle('Clean up quote'));
    expect(screen.getByTitle('Clean up quote')).toBeDisabled();

    await waitFor(() => {
      expect(store.getState().ui.toast).not.toBeNull();
    });
    expect(screen.getByTitle('Clean up quote')).not.toBeDisabled();
    // original quote preserved
    expect(store.getState().sources.byShelter[shelter.id][0].quote).toBe('a messy quote');
  });
});

// SourceModal unit tests (form, picker) live in SourceModal.test.tsx.
// These integration tests confirm the picker wires up through SourcesTab.
describe('SourceModal — browse existing sources picker (integration)', () => {
  type Ref = Awaited<ReturnType<typeof window.api.sources.getAll>>[number];
  const ref = (o: Partial<Ref>): Ref => ({
    id: 0, type: 'book', author: '', title: '', container_title: '', container_author: '', editor: '',
    edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
    year: null, date: '', url: '', access_date: '', archive: '', archive_location: '',
    ...o,
  });

  function openCreateModal() {
    const store = makeStore(makeShelter());
    render(<Provider store={store}><SourcesTab /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /add first source/i }));
    return store;
  }

  it('shows a browse button next to Type, enabled when a type is set', () => {
    openCreateModal();
    const btn = screen.getByRole('button', { name: /browse existing sources/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('opens the picker and lists only sources matching the selected type, alphabetically', async () => {
    window.api.sources.getAll = jest.fn().mockResolvedValue([
      ref({ id: 1, type: 'book', title: 'Beta', author: 'Yale, B' }),
      ref({ id: 2, type: 'book', title: 'Alpha', author: 'Zed, A' }),
      ref({ id: 3, type: 'journal', container_title: 'Nature' }),
    ]);
    openCreateModal(); // type defaults to 'book'
    fireEvent.click(screen.getByRole('button', { name: /browse existing sources/i }));

    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Nature')).toBeNull(); // journal filtered out

    const rows = screen.getAllByTestId(/^picker-row-/);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'picker-row-2', 'picker-row-1', // Alpha before Beta
    ]);
  });

  it('filters rows via the per-field search boxes', async () => {
    window.api.sources.getAll = jest.fn().mockResolvedValue([
      ref({ id: 1, type: 'book', title: 'Alpha', author: 'Zed, A' }),
      ref({ id: 2, type: 'book', title: 'Beta', author: 'Yale, B' }),
    ]);
    openCreateModal();
    fireEvent.click(screen.getByRole('button', { name: /browse existing sources/i }));
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/search title/i), { target: { value: 'bet' } });
    expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('selecting a row populates the modal fields and closes the picker', async () => {
    window.api.sources.getAll = jest.fn().mockResolvedValue([
      ref({ id: 1, type: 'book', title: 'Alpha', author: 'Zed, A', edition: '3rd', year: 1991 }),
    ]);
    openCreateModal();
    fireEvent.click(screen.getByRole('button', { name: /browse existing sources/i }));
    await waitFor(() => expect(screen.getByTestId('picker-row-1')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('picker-row-1'));

    // picker closed
    expect(screen.queryByTestId('picker-row-1')).toBeNull();
    // fields populated
    expect((screen.getByPlaceholderText('A Hearth on Birch Glen') as HTMLInputElement).value).toBe('Alpha');
    expect((screen.getByPlaceholderText('Calloway, Henry') as HTMLInputElement).value).toBe('Zed, A');
  });
});
