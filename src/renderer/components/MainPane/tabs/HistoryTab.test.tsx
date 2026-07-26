import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import architecturesReducer from '../../../store/architecturesSlice';
import categoriesReducer from '../../../store/categoriesSlice';
import sourcesReducer from '../../../store/sourcesSlice';
import aiSettingsReducer from '../../../store/aiSettingsSlice';
import uiReducer, { type UiState } from '../../../store/uiSlice';
import HistoryTab from './HistoryTab';
import type { GenerateHistoryEvent, GenerateHistoryResponse, Shelter, Source } from '../../../../shared/ipc-types';

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: true,
    type: 'book',
    author: 'Doe, Jane',
    title: 'Shelter Notes',
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
    history: 'aeolus-view-camp/aeolus-view-camp.md',
    photo_count: 0,
    ...overrides,
  };
}

function makeStore(shelter: Shelter, sources: Source[] = [], apiKey = 'sk-ant-valid') {
  return configureStore({
    reducer: {
      shelters: sheltersReducer,
      photos: photosReducer,
      architectures: architecturesReducer,
      categories: categoriesReducer,
      sources: sourcesReducer,
      aiSettings: aiSettingsReducer,
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
        historyMissing: false,
      },
      photos: {
        byShelter: { [shelter.id]: [] },
        originals: {},
        loading: false,
        uploading: false,
      },
      architectures: { list: [], loading: false, error: null },
      categories: { list: [], loading: false, error: null },
      sources: {
        byShelter: { [shelter.id]: sources },
        loading: false,
        cleaningQuoteIds: [],
      },
      aiSettings: { apiKey },
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
      } as UiState,
    },
  });
}

describe('HistoryTab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows the slug-based markdown file path', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = makeStore(makeShelter());

    render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    expect(screen.getByText('shelters/aeolus-view-camp/aeolus-view-camp.md')).toBeInTheDocument();
    expect(screen.getByText('Saved · aeolus-view-camp.md')).toBeInTheDocument();
  });

  it('uses the slug-based markdown file name in the save toast', async () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
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
      expect(window.api.history.write).toHaveBeenCalledWith(
        'aeolus-view-camp/aeolus-view-camp.md',
        '# Updated history',
        '/custom/shelters',
      );
    });

    await waitFor(() => {
      expect(store.getState().ui.toast?.message).toBe(
        'Saved · shelters/aeolus-view-camp/aeolus-view-camp.md',
      );
    });
  });

  it('shows a missing file message when the history markdown file does not exist', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = configureStore({
      reducer: {
        shelters: sheltersReducer,
        photos: photosReducer,
        architectures: architecturesReducer,
        categories: categoriesReducer,
        sources: sourcesReducer,
        aiSettings: aiSettingsReducer,
        ui: uiReducer,
      },
      preloadedState: {
        ...makeStore(makeShelter()).getState(),
        shelters: {
          ...makeStore(makeShelter()).getState().shelters,
          historyContent: '',
          historyOriginal: '',
          historyDirty: false,
          historyMissing: true,
        },
      },
    });

    render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    expect(screen.getByText(/history file not found/i)).toBeInTheDocument();
    expect(screen.getByText('aeolus-view-camp/aeolus-view-camp.md')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create file/i })).toBeInTheDocument();
  });

  it('defaults to the Both view mode with both panes visible', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = makeStore(makeShelter());

    const { container } = render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Source' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'false');
    expect(container.querySelector('.md-pane--source')).not.toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.md-pane--preview')).not.toHaveAttribute('aria-hidden', 'true');
  });

  it('selecting Source hides the preview pane and keeps editing/save behavior intact', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = makeStore(makeShelter());
    window.api.history.write = jest.fn();

    const { container } = render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));

    expect(screen.getByRole('button', { name: 'Source' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.md-pane--preview')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.md-split')).toHaveClass('mode-source');

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Updated in source view' } });
    expect(store.getState().shelters.historyContent).toBe('# Updated in source view');
    expect(screen.getByText(/Modified/)).toBeInTheDocument();

    expect(window.api.history.write).not.toHaveBeenCalled();
  });

  it('selecting Preview hides the source editor and keeps the dirty indicator accurate', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = makeStore(makeShelter());

    const { container } = render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Edited before switching' } });
    expect(screen.getByText(/Modified/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.md-pane--source')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.md-split')).toHaveClass('mode-preview');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Modified/)).toBeInTheDocument();
  });

  it('selecting Both restores the two-pane layout with content intact', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = makeStore(makeShelter());

    const { container } = render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Source' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Written in source view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Both' }));

    expect(screen.getByRole('button', { name: 'Both' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.md-pane--source')).not.toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.md-pane--preview')).not.toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.md-split')).not.toHaveClass('mode-source');
    expect(container.querySelector('.md-split')).not.toHaveClass('mode-preview');
    expect(store.getState().shelters.historyContent).toBe('# Written in source view');
    expect(screen.getByRole('textbox')).toHaveValue('# Written in source view');
  });

  it('does not disrupt an in-progress save when the view mode changes', async () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    const store = makeStore(makeShelter());
    let resolveWrite: () => void = () => {};
    window.api.history.write = jest.fn(() => new Promise<void>((resolve) => { resolveWrite = resolve; }));

    render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Saving this' } });
    fireEvent.click(screen.getByRole('button', { name: /save file/i }));

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true');

    resolveWrite();
    await waitFor(() => {
      expect(store.getState().shelters.historyDirty).toBe(false);
    });
    expect(screen.getByText(/Saved/)).toBeInTheDocument();
  });

  it('restores the last-selected view mode on mount, proving persistence across navigation', () => {
    localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
    localStorage.setItem('gmc.historyView', 'preview');
    const store = makeStore(makeShelter());

    const { container } = render(
      <Provider store={store}>
        <HistoryTab />
      </Provider>,
    );

    expect(screen.getByRole('button', { name: 'Preview' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('.md-pane--source')).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.md-split')).toHaveClass('mode-preview');
  });

  describe('Generate History', () => {
    beforeEach(() => {
      // The mount-effect dispatch of loadApiKey() re-fetches and can overwrite
      // preloaded store state, so keep this mock in sync with each test's apiKey.
      window.api.ai.getApiKey = jest.fn().mockResolvedValue('sk-ant-valid');
    });

    it('renders after the Source/Both/Preview toggle', () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      const toggleGroup = screen.getByRole('group', { name: /history view mode/i });
      const generateButton = screen.getByRole('button', { name: /generate history/i });
      expect(toggleGroup.compareDocumentPosition(generateButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('is disabled with a "requires AI API key" title when no valid key is configured', () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      window.api.ai.getApiKey = jest.fn().mockResolvedValue('');
      const store = makeStore(makeShelter(), [], '');

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      const button = screen.getByRole('button', { name: /generate history/i });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('title', 'Generate History (requires AI API key)');
    });

    it('is enabled with a plain title when a valid key is configured', () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter(), [], 'sk-ant-valid');

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      const button = screen.getByRole('button', { name: /generate history/i });
      expect(button).not.toBeDisabled();
      expect(button).toHaveAttribute('title', 'Generate History');
    });

    it('calls window.api.history.generate with the shelter facts, included citations, and Sources-stripped history', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const shelter = makeShelter();
      const included = makeSource({ id: 1, include_in_history: true });
      const excluded = makeSource({ id: 2, include_in_history: false });
      const store = configureStore({
        reducer: {
          shelters: sheltersReducer,
          photos: photosReducer,
          architectures: architecturesReducer,
          categories: categoriesReducer,
          sources: sourcesReducer,
          aiSettings: aiSettingsReducer,
          ui: uiReducer,
        },
        preloadedState: {
          ...makeStore(shelter, [included, excluded]).getState(),
          shelters: {
            ...makeStore(shelter).getState().shelters,
            historyContent: '# Camp history\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n',
          },
        },
      });
      window.api.history.generate = jest.fn().mockReturnValue(new Promise(() => {}));

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      expect(window.api.history.generate).toHaveBeenCalledWith({
        shelter: {
          name: shelter.name,
          architecture: shelter.architecture,
          built_by: shelter.built_by,
          description: shelter.description,
          notes: shelter.notes,
          start_year: shelter.start_year,
          end_year: shelter.end_year,
          is_extant: shelter.is_extant,
          is_gmc: shelter.is_gmc,
          category: shelter.category,
        },
        citations: [included],
        currentHistory: '# Camp history\n',
      });
    });

    it('shows a busy state while in flight and ignores a second click', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      let resolveGenerate: (v: GenerateHistoryResponse) => void = () => {};
      window.api.history.generate = jest.fn(() => new Promise((resolve) => { resolveGenerate = resolve; }));

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      const button = screen.getByRole('button', { name: /generate history/i });
      fireEvent.click(button);
      expect(button).toBeDisabled();

      fireEvent.click(button);
      expect(window.api.history.generate).toHaveBeenCalledTimes(1);

      resolveGenerate({ ok: true, narrative: 'A narrative.' });
      await waitFor(() => expect(button).not.toBeDisabled());
    });

    it('still triggers a request for a shelter with blank History content', () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      store.dispatch({ type: 'shelters/setHistoryContent', payload: '' });
      window.api.history.generate = jest.fn().mockReturnValue(new Promise(() => {}));

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      expect(window.api.history.generate).toHaveBeenCalledWith(
        expect.objectContaining({ currentHistory: '' }),
      );
    });

    it('opens the modal immediately in a running state, before the response resolves', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      window.api.history.generate = jest.fn().mockReturnValue(new Promise(() => {}));

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /generating history/i })).toBeInTheDocument();
    });

    it('shows live progress text and tool activity as onGenerateProgress events arrive', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      window.api.history.generate = jest.fn().mockReturnValue(new Promise(() => {}));
      let emit: (evt: GenerateHistoryEvent) => void = () => {};
      window.api.history.onGenerateProgress = jest.fn((cb) => { emit = cb; return jest.fn(); });

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));
      act(() => {
        emit({ type: 'text', text: 'Drafting the opening paragraph.' });
        emit({ type: 'tool_call', tool: 'web_search', input: { query: 'Aeolus View Camp' } });
      });

      expect(screen.getByText('Drafting the opening paragraph.')).toBeInTheDocument();
      expect(screen.getByText(/Web search/)).toBeInTheDocument();
    });

    it('shows an Allow/Deny prompt on a permission_request event and forwards the decision via respondToPermission', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      window.api.history.generate = jest.fn().mockReturnValue(new Promise(() => {}));
      let emit: (evt: GenerateHistoryEvent) => void = () => {};
      window.api.history.onGenerateProgress = jest.fn((cb) => { emit = cb; return jest.fn(); });

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));
      act(() => {
        emit({ type: 'permission_request', requestId: 'tool_1', tool: 'search_collections', input: { query: 'Aeolus' } });
      });

      fireEvent.click(screen.getByRole('button', { name: /allow/i }));

      expect(window.api.history.respondToPermission).toHaveBeenCalledWith('tool_1', true);
    });

    it.each([
      ['no_api_key' as const],
      ['network' as const],
      ['timeout' as const],
      ['max_turns' as const],
    ])('opens the modal and shows an error, leaving content unchanged, on a %s response', async (error) => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      window.api.history.generate = jest.fn().mockResolvedValue({ ok: false, error });

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
      });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(store.getState().shelters.historyContent).toBe('# Camp history');
      expect(store.getState().shelters.historyDirty).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens the review modal on a successful response, and Accept replaces the History tab content', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const shelter = makeShelter();
      const included = makeSource({ id: 1, include_in_history: true });
      const store = makeStore(shelter, [included]);
      window.api.history.generate = jest.fn().mockResolvedValue({ ok: true, narrative: 'A generated narrative.' });

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      expect(screen.getByText('A generated narrative.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /accept/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(store.getState().shelters.historyContent).toBe(
        '# Aeolus View Camp\n\nA generated narrative.\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n',
      );
      expect(store.getState().shelters.historyDirty).toBe(true);
    });

    it('clicking Reject leaves content unchanged and a subsequent click sends a fresh, independent request', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      window.api.history.generate = jest.fn().mockResolvedValue({ ok: true, narrative: 'First draft.' });

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      fireEvent.click(screen.getByRole('button', { name: /reject/i }));

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(store.getState().shelters.historyContent).toBe('# Camp history');
      expect(store.getState().shelters.historyDirty).toBe(false);

      window.api.history.generate = jest.fn().mockResolvedValue({ ok: true, narrative: 'Second, independent draft.' });
      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      expect(window.api.history.generate).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      expect(screen.getByText('Second, independent draft.')).toBeInTheDocument();
    });

    it('dismissing the modal via backdrop click also leaves content unchanged', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const store = makeStore(makeShelter());
      window.api.history.generate = jest.fn().mockResolvedValue({ ok: true, narrative: 'A draft.' });

      const { container } = render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

      fireEvent.click(container.querySelector('.modal-bg') as HTMLElement);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(store.getState().shelters.historyContent).toBe('# Camp history');
      expect(store.getState().shelters.historyDirty).toBe(false);
    });

    it('discards a response that arrives after the user has switched to a different shelter', async () => {
      localStorage.setItem('gmc.paths', JSON.stringify({ SHELTERS_ROOT: '/custom/shelters' }));
      const shelter = makeShelter();
      const store = makeStore(shelter);
      let resolveGenerate: (v: GenerateHistoryResponse) => void = () => {};
      window.api.history.generate = jest.fn(() => new Promise((resolve) => { resolveGenerate = resolve; }));

      render(
        <Provider store={store}>
          <HistoryTab />
        </Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: /generate history/i }));

      act(() => {
        store.dispatch({ type: 'shelters/setSelectedId', payload: shelter.id + 1 });
      });
      resolveGenerate({ ok: true, narrative: 'A narrative for the wrong shelter.' });

      await waitFor(() => {
        expect(screen.queryByText(/A narrative for the wrong shelter/i)).not.toBeInTheDocument();
      });
      expect(store.getState().shelters.historyContent).toBe('# Camp history');
    });
  });

  describe('Replace Sources', () => {
    beforeEach(() => {
      // A preceding test in this file ("does not disrupt an in-progress save...") reassigns
      // window.api.history.write to a promise that only resolves via a locally-captured
      // resolver, and never restores it — these tests dispatch createSource/deleteSource,
      // which write through history sync, so they'd hang forever on that leaked mock.
      window.api.history.write = jest.fn().mockResolvedValue(undefined);
      window.api.history.read = jest.fn().mockResolvedValue({ content: '', missing: false });
      // This file has no global clearAllMocks, so a prior test's calls to these would
      // otherwise still be on the mock's call history for the next test's assertions.
      (window.api.sources.create as jest.Mock).mockClear();
      (window.api.sources.delete as jest.Mock).mockClear();
      window.api.collections.status = jest.fn().mockResolvedValue([]);
    });

    function makeStoreWithHistory(shelter: Shelter, sources: Source[], historyContent: string) {
      return configureStore({
        reducer: {
          shelters: sheltersReducer,
          photos: photosReducer,
          architectures: architecturesReducer,
          categories: categoriesReducer,
          sources: sourcesReducer,
          aiSettings: aiSettingsReducer,
          ui: uiReducer,
        },
        preloadedState: {
          ...makeStore(shelter, sources).getState(),
          shelters: {
            ...makeStore(shelter, sources).getState().shelters,
            historyContent,
            historyOriginal: historyContent,
          },
        },
      });
    }

    const HISTORY_WITH_SOURCES = '# Aeolus View Camp\n\n### Sources\n\n'
      + '- Doe, Jane. *Shelter Notes*.\n'
      + '- Smith, John. *Trail Log*.\n';

    it('is disabled when the history has no ### Sources section', () => {
      const store = makeStoreWithHistory(makeShelter(), [], '# Aeolus View Camp\n\nNo sources here.\n');
      render(<Provider store={store}><HistoryTab /></Provider>);
      expect(screen.getByRole('button', { name: /replace sources/i })).toBeDisabled();
    });

    it('is enabled when the history has a parseable ### Sources section', () => {
      const store = makeStoreWithHistory(makeShelter(), [], HISTORY_WITH_SOURCES);
      render(<Provider store={store}><HistoryTab /></Provider>);
      expect(screen.getByRole('button', { name: /replace sources/i })).not.toBeDisabled();
    });

    it('fetches window.api.collections.status() and uses it to recognize a plain pasted citation naming a known collection', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      window.api.collections.status = jest.fn().mockResolvedValue([
        { name: 'Long Trail News', total: 1, added: 1, cleaned: 1, files: [], citationType: 'magazine', defaults: {} },
      ]);
      window.api.sources.create = jest.fn().mockImplementation((input) => Promise.resolve({ ...input, id: 99 }));
      const historyWithPastedCitation = '# Aeolus View Camp\n\n### Sources\n\n'
        + 'Long Trail News, August 1963, p. 4–5. "Little Rock Pond Shelter Dedicated to Lula M. Tye." Green Mountain Club.\n';
      const store = makeStoreWithHistory(makeShelter(), [], historyWithPastedCitation);
      render(<Provider store={store}><HistoryTab /></Provider>);

      await waitFor(() => expect(window.api.collections.status).toHaveBeenCalled());
      fireEvent.click(screen.getByRole('button', { name: /replace sources/i }));

      await waitFor(() => expect(window.api.sources.create).toHaveBeenCalledTimes(1));
      expect(window.api.sources.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'magazine',
          container_title: 'Long Trail News',
          title: 'Little Rock Pond Shelter Dedicated to Lula M. Tye',
          publisher: 'Green Mountain Club',
          pages: '4-5',
          date: '1963-08',
          year: 1963,
        }),
      );
    });

    it('links each parsed citation to a collection document via wiki.findResource and reports the linked count', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      window.api.sources.create = jest.fn().mockImplementation((input) => Promise.resolve({ ...input, id: Math.random() }));
      window.api.wiki.findResource = jest.fn()
        .mockResolvedValueOnce('collections/Long Trail News/1963_08_Aug.pdf')
        .mockResolvedValueOnce(null);
      const store = makeStoreWithHistory(makeShelter(), [], HISTORY_WITH_SOURCES);
      render(<Provider store={store}><HistoryTab /></Provider>);

      fireEvent.click(screen.getByRole('button', { name: /replace sources/i }));

      await waitFor(() => expect(window.api.sources.create).toHaveBeenCalledTimes(2));
      expect(window.api.wiki.findResource).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Shelter Notes' }),
      );
      expect(window.api.sources.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Shelter Notes', archive_location: 'collections/Long Trail News/1963_08_Aug.pdf' }),
      );
      expect(window.api.sources.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Trail Log', archive_location: '' }),
      );
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).toBe('Sources replaced — 2 added, 1 linked');
      });
    });

    it('does nothing when the confirmation is declined', () => {
      window.confirm = jest.fn().mockReturnValue(false);
      const existing = makeSource({ id: 5 });
      const store = makeStoreWithHistory(makeShelter(), [existing], HISTORY_WITH_SOURCES);
      render(<Provider store={store}><HistoryTab /></Provider>);

      fireEvent.click(screen.getByRole('button', { name: /replace sources/i }));

      expect(window.api.sources.delete).not.toHaveBeenCalled();
      expect(window.api.sources.create).not.toHaveBeenCalled();
    });

    it('asks for confirmation naming the current and incoming counts', () => {
      window.confirm = jest.fn().mockReturnValue(false);
      const existing = [makeSource({ id: 5 }), makeSource({ id: 6 })];
      const store = makeStoreWithHistory(makeShelter(), existing, HISTORY_WITH_SOURCES);
      render(<Provider store={store}><HistoryTab /></Provider>);

      fireEvent.click(screen.getByRole('button', { name: /replace sources/i }));

      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('2'));
    });

    it('deletes every current source and creates one per parsed history citation, on confirm', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      window.api.sources.delete = jest.fn().mockResolvedValue(undefined);
      window.api.sources.create = jest.fn().mockImplementation((input) => Promise.resolve({ ...input, id: Math.random() }));
      const existing = makeSource({ id: 5 });
      const store = makeStoreWithHistory(makeShelter(), [existing], HISTORY_WITH_SOURCES);
      render(<Provider store={store}><HistoryTab /></Provider>);

      fireEvent.click(screen.getByRole('button', { name: /replace sources/i }));

      await waitFor(() => expect(window.api.sources.delete).toHaveBeenCalledWith(5));
      await waitFor(() => expect(window.api.sources.create).toHaveBeenCalledTimes(2));
      expect(window.api.sources.create).toHaveBeenCalledWith(
        expect.objectContaining({ shelter_id: 7, title: 'Shelter Notes', author: 'Doe, Jane', include_in_history: true }),
      );
      expect(window.api.sources.create).toHaveBeenCalledWith(
        expect.objectContaining({ shelter_id: 7, title: 'Trail Log', author: 'Smith, John', include_in_history: true }),
      );
      await waitFor(() => {
        expect(store.getState().ui.toast?.message).toMatch(/2/);
      });
    });
  });
});
