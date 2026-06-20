import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../store/sheltersSlice';
import uiReducer from '../../store/uiSlice';
import type { Shelter } from '../../../shared/ipc-types';
import { NavigationGuardProvider, useGuardedNav } from './NavigationGuardProvider';
import Sidebar from '../Sidebar/Sidebar';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 1,
    name: 'Apple Camp',
    slug: 'apple-camp',
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
  } as Shelter;
}

function makeStore(shelterState: Partial<ReturnType<typeof sheltersReducer>> = {}) {
  return configureStore({
    reducer: { shelters: sheltersReducer, ui: uiReducer },
    preloadedState: {
      shelters: {
        list: [makeShelter()],
        selectedId: 1,
        editBuffer: makeShelter(),
        loading: false,
        saving: false,
        dirty: false,
        historyContent: '',
        historyOriginal: '',
        historyDirty: false,
        historyMissing: false,
        ...shelterState,
      },
    },
  });
}

// A button that fires a guarded navigation when clicked.
function NavButton({ onNavigate }: { onNavigate: () => void }) {
  const guardedNav = useGuardedNav();
  return <button onClick={() => guardedNav(onNavigate)}>navigate</button>;
}

function renderWithGuard(store: ReturnType<typeof makeStore>, onNavigate: () => void) {
  return render(
    <Provider store={store}>
      <NavigationGuardProvider>
        <NavButton onNavigate={onNavigate} />
      </NavigationGuardProvider>
    </Provider>,
  );
}

describe('NavigationGuard', () => {
  it('runs the navigation immediately when there are no unsaved changes', () => {
    const onNavigate = jest.fn();
    renderWithGuard(makeStore({ dirty: false, historyDirty: false }), onNavigate);

    fireEvent.click(screen.getByText('navigate'));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  it('blocks navigation and shows the prompt when the shelter form is dirty', () => {
    const onNavigate = jest.fn();
    renderWithGuard(makeStore({ dirty: true }), onNavigate);

    fireEvent.click(screen.getByText('navigate'));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it('Cancel aborts the navigation and dismisses the prompt', () => {
    const onNavigate = jest.fn();
    renderWithGuard(makeStore({ dirty: true }), onNavigate);

    fireEvent.click(screen.getByText('navigate'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  it('Discard proceeds with the navigation', () => {
    const onNavigate = jest.fn();
    renderWithGuard(makeStore({ dirty: true }), onNavigate);

    fireEvent.click(screen.getByText('navigate'));
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
  });

  describe('Save', () => {
    let update: jest.Mock;
    let write: jest.Mock;

    beforeEach(() => {
      update = jest.fn((s: Shelter) => Promise.resolve({ ...s, updated: '2026-06-19' }));
      write = jest.fn(() => Promise.resolve());
      (window as unknown as { api: unknown }).api = {
        shelters: { update },
        history: { write },
      };
    });

    afterEach(() => {
      delete (window as unknown as { api?: unknown }).api;
    });

    it('persists the dirty shelter form, then navigates', async () => {
      const onNavigate = jest.fn();
      renderWithGuard(makeStore({ dirty: true, editBuffer: makeShelter({ name: 'Edited' }) }), onNavigate);

      fireEvent.click(screen.getByText('navigate'));
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1));
      expect(update).toHaveBeenCalledTimes(1);
      expect(write).not.toHaveBeenCalled();
    });

    it('persists dirty history (writing the shelter slug path), then navigates', async () => {
      const onNavigate = jest.fn();
      renderWithGuard(
        makeStore({ historyDirty: true, historyContent: '# notes', editBuffer: makeShelter({ slug: 'apple-camp', history: null }) }),
        onNavigate,
      );

      fireEvent.click(screen.getByText('navigate'));
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1));
      expect(write).toHaveBeenCalledWith('apple-camp/apple-camp.md', '# notes', expect.anything());
      expect(update).not.toHaveBeenCalled();
    });

    it('persists both the form and history when both are dirty', async () => {
      const onNavigate = jest.fn();
      renderWithGuard(makeStore({ dirty: true, historyDirty: true, historyContent: '# notes' }), onNavigate);

      fireEvent.click(screen.getByText('navigate'));
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(onNavigate).toHaveBeenCalledTimes(1));
      expect(update).toHaveBeenCalledTimes(1);
      expect(write).toHaveBeenCalledTimes(1);
    });

    it('aborts the navigation when the save fails', async () => {
      update.mockRejectedValueOnce(new Error('validation failed'));
      const onNavigate = jest.fn();
      renderWithGuard(makeStore({ dirty: true }), onNavigate);

      fireEvent.click(screen.getByText('navigate'));
      fireEvent.click(screen.getByRole('button', { name: /save/i }));

      await waitFor(() => expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument());
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  it('intercepts a Sidebar row click when the current shelter is dirty', () => {
    (window as unknown as { api: unknown }).api = {
      app: { getRepoRoot: () => Promise.resolve('') },
    };
    const store = configureStore({
      reducer: { shelters: sheltersReducer, ui: uiReducer },
      preloadedState: {
        shelters: {
          list: [makeShelter({ id: 1, name: 'Apple Camp' }), makeShelter({ id: 2, name: 'Birch Lodge' })],
          selectedId: 1,
          editBuffer: makeShelter({ id: 1 }),
          loading: false,
          saving: false,
          dirty: true,
          historyContent: '',
          historyOriginal: '',
          historyDirty: false,
          historyMissing: false,
        },
      },
    });

    render(
      <Provider store={store}>
        <NavigationGuardProvider>
          <Sidebar />
        </NavigationGuardProvider>
      </Provider>,
    );

    fireEvent.click(screen.getByText('Birch Lodge'));

    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    expect(store.getState().shelters.selectedId).toBe(1);

    delete (window as unknown as { api?: unknown }).api;
  });
});
