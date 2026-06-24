import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import uiReducer from '../../../store/uiSlice';
import ReconcileModal from './ReconcileModal';
import type { Shelter } from '../../../../shared/ipc-types';

function makeStore() {
  const shelter: Shelter = {
    id: 10, name: 'Test', slug: 'test', start_year: 1950, end_year: null,
    description: '', default_photo_id: null, is_gmc: false, is_extant: true,
    architecture: '', built_by: '', notes: '', created: '2020-01-01', updated: '2020-01-01',
    category: '', show_on_web: false, history: null,
  };
  const reducer = combineReducers({ shelters: sheltersReducer, photos: photosReducer, ui: uiReducer });
  return configureStore({
    reducer,
    preloadedState: {
      shelters: { list: [shelter], selectedId: shelter.id, editBuffer: shelter, loading: false, dirty: false, historyDirty: false, historyContent: '' },
      photos: { byShelter: { [shelter.id]: [] }, originals: {}, loading: false, uploading: false },
    } as unknown as ReturnType<typeof reducer>,
  });
}

const mockReconcileScan = jest.fn();
const mockReconcileApply = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (window as { api: unknown }).api = {
    photos: { reconcileScan: mockReconcileScan, reconcileApply: mockReconcileApply },
  };
});
afterEach(() => { (window as { api: unknown }).api = undefined; });

function renderModal(onClose = jest.fn()) {
  const store = makeStore();
  return render(
    <Provider store={store}>
      <ReconcileModal shelterId={10} sheltersRoot="/shelters" shelterSlug="test" defaultPhotoId={null} onClose={onClose} dispatch={store.dispatch} />
    </Provider>,
  );
}

describe('ReconcileModal', () => {
  it('shows scanning state while loading', () => {
    mockReconcileScan.mockReturnValue(new Promise(() => {}));
    renderModal();
    expect(screen.getByText(/scanning/i)).toBeInTheDocument();
  });

  it('shows "All photos are in sync" when scan returns empty lists', async () => {
    mockReconcileScan.mockResolvedValue({ untrackedFiles: [], orphanedRecords: [] });
    renderModal();
    await waitFor(() => expect(screen.getByText(/all photos are in sync/i)).toBeInTheDocument());
  });

  it('lists untracked files', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    renderModal();
    await waitFor(() => expect(screen.getByText('new.jpg')).toBeInTheDocument());
  });

  it('lists orphaned records with title', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [],
      orphanedRecords: [{ id: 42, fileName: 'missing.jpg', title: 'Gone Photo' }],
    });
    renderModal();
    await waitFor(() => {
      expect(screen.getByText('missing.jpg')).toBeInTheDocument();
      expect(screen.getByText('Gone Photo')).toBeInTheDocument();
    });
  });

  it('disables Apply when nothing is selected', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    renderModal();
    await waitFor(() => screen.getByText('new.jpg'));
    expect(screen.getByRole('button', { name: /apply/i })).toBeDisabled();
  });

  it('enables Apply after selecting a file', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    renderModal();
    await waitFor(() => screen.getByText('new.jpg'));
    fireEvent.click(screen.getByLabelText('new.jpg'));
    expect(screen.getByRole('button', { name: /apply/i })).not.toBeDisabled();
  });

  it('calls reconcileApply with selected files when Apply is clicked', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    mockReconcileApply.mockResolvedValue({ added: 1, deleted: 0, failed: 0, failures: [] });
    renderModal();
    await waitFor(() => screen.getByText('new.jpg'));
    fireEvent.click(screen.getByLabelText('new.jpg'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /apply/i })); });
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
    renderModal();
    await waitFor(() => screen.getByText('new.jpg'));
    fireEvent.click(screen.getByLabelText('new.jpg'));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /apply/i })); });
    await waitFor(() => expect(screen.getByText(/1 added/i)).toBeInTheDocument());
  });

  it('calls onClose(false) when Cancel is clicked', async () => {
    mockReconcileScan.mockResolvedValue({
      untrackedFiles: [{ fileName: 'test-shelter/photos/new.jpg' }],
      orphanedRecords: [],
    });
    const onClose = jest.fn();
    renderModal(onClose);
    await waitFor(() => screen.getByText('new.jpg'));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledWith(false);
  });

  describe('thumbnail housekeeping', () => {
    it('shows the Apply screen (not "all in sync") when only orphaned thumbnails are found', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 0,
        orphanedThumbnails: ['stale-1000.png'],
      });
      renderModal();
      await waitFor(() => expect(screen.getByText('stale-1000.png')).toBeInTheDocument());
      expect(screen.queryByText(/all photos are in sync/i)).not.toBeInTheDocument();
    });

    it('lists orphaned thumbnails with a single checkbox to purge them all', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 0,
        orphanedThumbnails: ['stale-1000.png', 'stale-2000.png'],
      });
      renderModal();
      await waitFor(() => screen.getByText('stale-1000.png'));
      expect(screen.getByText('stale-2000.png')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox', { name: /purge/i })).toHaveLength(1);
    });

    it('shows an informational note (no checkbox) when thumbnails are missing', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 3,
        orphanedThumbnails: [],
      });
      renderModal();
      await waitFor(() => expect(screen.getByText(/3 missing thumbnails/i)).toBeInTheDocument());
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });

    it('Apply is enabled even with nothing selected when thumbnail work is pending', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 1,
        orphanedThumbnails: [],
      });
      renderModal();
      await waitFor(() => expect(screen.getByText(/1 missing thumbnail/i)).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /apply/i })).not.toBeDisabled();
    });

    it('calls reconcileApply with purgeOrphanedThumbnails:false when the checkbox is left unchecked', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 0,
        orphanedThumbnails: ['stale-1000.png'],
      });
      mockReconcileApply.mockResolvedValue({ added: 0, deleted: 0, failed: 0, failures: [], thumbnailsGenerated: 0, thumbnailsPurged: 0 });
      renderModal();
      await waitFor(() => screen.getByText('stale-1000.png'));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /apply/i })); });
      await waitFor(() => {
        expect(mockReconcileApply).toHaveBeenCalledWith(
          expect.objectContaining({ purgeOrphanedThumbnails: false }),
        );
      });
    });

    it('calls reconcileApply with purgeOrphanedThumbnails:true when the checkbox is checked', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 0,
        orphanedThumbnails: ['stale-1000.png'],
      });
      mockReconcileApply.mockResolvedValue({ added: 0, deleted: 0, failed: 0, failures: [], thumbnailsGenerated: 0, thumbnailsPurged: 1 });
      renderModal();
      await waitFor(() => screen.getByText('stale-1000.png'));
      fireEvent.click(screen.getByRole('checkbox', { name: /purge/i }));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /apply/i })); });
      await waitFor(() => {
        expect(mockReconcileApply).toHaveBeenCalledWith(
          expect.objectContaining({ purgeOrphanedThumbnails: true }),
        );
      });
    });

    it('shows thumbnail generated/purged counts in the result summary', async () => {
      mockReconcileScan.mockResolvedValue({
        untrackedFiles: [], orphanedRecords: [],
        missingThumbnailCount: 2,
        orphanedThumbnails: ['stale-1000.png'],
      });
      mockReconcileApply.mockResolvedValue({ added: 0, deleted: 0, failed: 0, failures: [], thumbnailsGenerated: 2, thumbnailsPurged: 1 });
      renderModal();
      await waitFor(() => screen.getByText('stale-1000.png'));
      fireEvent.click(screen.getByRole('checkbox', { name: /purge/i }));
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /apply/i })); });
      await waitFor(() => {
        expect(screen.getByText(/2 thumbnails generated/i)).toBeInTheDocument();
        expect(screen.getByText(/1 thumbnail purged/i)).toBeInTheDocument();
      });
    });
  });
});
