import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import uiReducer from '../../../store/uiSlice';
import PhotosTab from './PhotosTab';
import type { Shelter } from '../../../../shared/ipc-types';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 10, name: 'Test Shelter', slug: 'test-shelter',
    start_year: 1950, end_year: null,
    description: '', default_photo_id: null, is_gmc: false, is_extant: true,
    architecture: '', built_by: '', notes: '',
    created: '2020-01-01', updated: '2020-01-01',
    category: '', show_on_web: false,
    ...overrides,
  };
}

function makeStore(shelter: Shelter) {
  return configureStore({
    reducer: { shelters: sheltersReducer, photos: photosReducer, ui: uiReducer },
    preloadedState: {
      shelters: {
        list: [shelter],
        selectedId: shelter.id,
        editBuffer: shelter,
        loading: false,
        dirty: false,
        historyDirty: false,
        historyContent: '',
      },
      photos: {
        byShelter: { [shelter.id]: [] },
        originals: {},
        loading: false,
        uploading: false,
      },
    } as any,
  });
}

const mockReconcileScan = jest.fn();
const mockReconcileApply = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (window as any).api = {
    app: { getRepoRoot: jest.fn().mockResolvedValue('/repo') },
    photos: {
      reconcileScan: mockReconcileScan,
      reconcileApply: mockReconcileApply,
    },
  };
});

afterEach(() => {
  (window as any).api = undefined;
});

describe('ReconcileModal', () => {
  it('renders a Reconcile button in the toolbar', () => {
    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);
    expect(screen.getByRole('button', { name: /reconcile/i })).toBeInTheDocument();
  });

  it('opens modal and triggers scan when Reconcile button is clicked', async () => {
    mockReconcileScan.mockResolvedValue({ untrackedFiles: [], orphanedRecords: [] });
    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => {
      expect(mockReconcileScan).toHaveBeenCalledWith(10, expect.any(String));
    });
  });

  it('shows "All photos are in sync" when scan returns empty lists', async () => {
    mockReconcileScan.mockResolvedValue({ untrackedFiles: [], orphanedRecords: [] });
    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/all photos are in sync/i)).toBeInTheDocument();
    });
  });

  it('lists untracked files from scan result', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [
        { fileName: 'test-shelter/photos/untracked.jpg' },
        { fileName: 'test-shelter/another.png' },
      ],
      orphanedRecords: [],
    });
    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('untracked.jpg')).toBeInTheDocument();
      expect(screen.getByText('another.png')).toBeInTheDocument();
    });
  });

  it('lists orphaned records from scan result', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [],
      orphanedRecords: [{ id: 42, fileName: 'missing.jpg', title: 'Gone Photo' }],
    });
    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('missing.jpg')).toBeInTheDocument();
      expect(screen.getByText('Gone Photo')).toBeInTheDocument();
    });
  });

  it('disables apply button when nothing is selected', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => {
      const applyBtn = screen.getByRole('button', { name: /apply/i });
      expect(applyBtn).toBeDisabled();
    });
  });

  it('calls reconcileApply with selected files when applied', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    mockReconcileApply.mockResolvedValue({ added: 1, deleted: 0, failed: 0, failures: [] });

    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => screen.getByText('new.jpg'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText('new.jpg'));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });

    await waitFor(() => {
      expect(mockReconcileApply).toHaveBeenCalledWith(
        expect.objectContaining({ filesToAdd: ['test-shelter/photos/new.jpg'], recordIdsToDelete: [] }),
      );
    });
  });

  it('shows results summary after apply', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    mockReconcileApply.mockResolvedValue({ added: 1, deleted: 0, failed: 0, failures: [] });

    const store = makeStore(makeShelter());
    render(<Provider store={store}><PhotosTab /></Provider>);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /reconcile/i }));
    });

    await waitFor(() => screen.getByText('new.jpg'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText('new.jpg'));
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/1 added/i)).toBeInTheDocument();
    });
  });
});
