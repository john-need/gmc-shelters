import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Sidebar from './Sidebar';
import sheltersReducer from '../../store/sheltersSlice';
import uiReducer, { type UiState } from '../../store/uiSlice';
import type { Shelter } from '../../../shared/ipc-types';

function makeShelter(name: string, overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: Math.floor(Math.random() * 100000),
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    start_year: 1950,
    end_year: null,
    description: '',
    category: 'Lean-to',
    architecture: '',
    built_by: '',
    notes: '',
    is_extant: true,
    is_gmc: false,
    show_on_web: false,
    history: null,
    default_photo_id: null,
    created: '2020-01-01',
    updated: '2020-01-01',
    photo_count: 0,
    ...overrides,
  };
}

function renderSidebar(shelters: Shelter[], advOverrides: Partial<UiState['advancedFilters']> = {}) {
  const store = configureStore({
    reducer: {
      shelters: sheltersReducer,
      ui: uiReducer,
    },
    preloadedState: {
      shelters: {
        list: shelters,
        selectedId: shelters[0]?.id ?? null,
        editBuffer: shelters[0] ?? null,
        loading: false,
        saving: false,
        dirty: false,
        historyContent: '',
        historyOriginal: '',
        historyDirty: false,
        historyMissing: false,
      },
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
          noDefaultPhoto: false,
          ...advOverrides,
        },
        toast: null,
      } as UiState,
    },
  });

  return render(
    <Provider store={store}>
      <Sidebar />
    </Provider>,
  );
}

describe('Sidebar', () => {
  it('lists all shelters together alphabetically regardless of extant status', () => {
    renderSidebar([
      makeShelter('Zephyr Shelter', { id: 3, is_extant: true }),
      makeShelter('Birch Lodge', { id: 2, is_extant: false }),
      makeShelter('Apple Camp', { id: 1, is_extant: true }),
    ]);

    const names = screen.getAllByText(/Apple Camp|Birch Lodge|Zephyr Shelter/).map((node) => node.textContent);
    expect(names).toEqual(['Apple Camp', 'Birch Lodge', 'Zephyr Shelter']);
  });

  it('category __none__ shows only shelters with empty/null category', () => {
    renderSidebar(
      [
        makeShelter('Has Category', { id: 1, category: 'Lean-to' }),
        makeShelter('No Category', { id: 2, category: '' }),
        makeShelter('Null Category', { id: 3, category: null as unknown as string }),
      ],
      { category: '__none__' },
    );
    expect(screen.getByText('No Category')).toBeInTheDocument();
    expect(screen.getByText('Null Category')).toBeInTheDocument();
    expect(screen.queryByText('Has Category')).not.toBeInTheDocument();
  });

  it('architecture __none__ shows only shelters with empty/null architecture', () => {
    renderSidebar(
      [
        makeShelter('Has Arch', { id: 1, architecture: 'Log' }),
        makeShelter('No Arch', { id: 2, architecture: '' }),
      ],
      { architecture: '__none__' },
    );
    expect(screen.getByText('No Arch')).toBeInTheDocument();
    expect(screen.queryByText('Has Arch')).not.toBeInTheDocument();
  });

  it('noDefaultPhoto shows only shelters with no default photo', () => {
    renderSidebar(
      [
        makeShelter('Has Photo', { id: 1, default_photo_id: 42 }),
        makeShelter('No Photo', { id: 2, default_photo_id: null }),
      ],
      { noDefaultPhoto: true },
    );
    expect(screen.getByText('No Photo')).toBeInTheDocument();
    expect(screen.queryByText('Has Photo')).not.toBeInTheDocument();
  });

  it('does not render extant/lost section headers in the shelter list', () => {
    const { container } = renderSidebar([
      makeShelter('Birch Lodge', { id: 2, is_extant: false }),
      makeShelter('Apple Camp', { id: 1, is_extant: true }),
    ]);

    expect(screen.queryByText('Removed / Lost')).not.toBeInTheDocument();
    expect(container.querySelector('.sidebar-section')).toBeNull();
  });
});
