import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import architecturesReducer from '../../../store/architecturesSlice';
import categoriesReducer from '../../../store/categoriesSlice';
import uiReducer, { type UiState } from '../../../store/uiSlice';
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
    history: 'aeolus-view-camp/aeolus-view-camp.md',
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
});
