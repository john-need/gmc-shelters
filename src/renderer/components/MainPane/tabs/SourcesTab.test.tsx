import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import sourcesReducer from '../../../store/sourcesSlice';
import uiReducer, { type UiState } from '../../../store/uiSlice';
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
    updated: '2020-01-02',
    ...overrides,
  };
}

function makeStore(shelter: Shelter, sources: Source[] = []) {
  return configureStore({
    reducer: {
      shelters: sheltersReducer,
      sources: sourcesReducer,
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
        historyMissing: false,
      },
      sources: {
        byShelter: { [shelter.id]: sources },
        loading: false,
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
});

describe('SourceModal — browse existing sources picker', () => {
  type Ref = Awaited<ReturnType<typeof window.api.sources.getAll>>[number];
  const ref = (o: Partial<Ref>): Ref => ({
    id: 0, type: 'book', author: '', title: '', container_title: '', editor: '',
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
