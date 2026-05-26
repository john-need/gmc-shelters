import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import uiReducer from '../../../store/uiSlice';
import PhotosTab from './PhotosTab';
import type { Shelter, Photo } from '../../../../shared/ipc-types';

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

function makeStore(shelter: Shelter, photos: Photo[] = []) {
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
        byShelter: { [shelter.id]: photos },
        originals: photos.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}),
        loading: false,
        uploading: false,
      },
    } as any,
  });
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1, shelter_id: 10, file_name: 'test.jpg',
    title: 'Test Photo', photographer: '', caption: '', alt_text: '',
    description: '', notes: '', date_taken: '',
    created: '2024-01-01', updated: '2024-01-01', include_in_post: false,
    ...overrides,
  };
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
      readFileMetadata: jest.fn().mockReturnValue(new Promise(() => {})),
      writeFileMetadata: jest.fn().mockResolvedValue(undefined),
      readMetadata: jest.fn().mockResolvedValue({}),
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

// ─── T005–T007: US1 — dialog triggers from PhotosTab ────────────────────────

describe('US1 — Photo editor dialog triggers', () => {
  it('T005: clicking the right-aside photo preview opens the editor dialog', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);

    // Wait for selection to settle (selectedId auto-set to first photo)
    await waitFor(() => {
      expect(screen.getByTestId('photo-preview')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('photo-preview'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('T006: double-clicking a PhotoCard in grid view opens the editor dialog', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);

    // Grid view is default; find the photo card and double-click
    await waitFor(() => {
      expect(screen.getByTestId('photo-card-1')).toBeInTheDocument();
    });

    const card = screen.getByTestId('photo-card-1');
    fireEvent.doubleClick(card);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('T007: double-clicking a ListRow in list view opens the editor dialog', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);

    // Switch to list view
    fireEvent.click(screen.getByRole('button', { name: /list/i }));

    await waitFor(() => {
      expect(screen.getByTestId('list-row-1')).toBeInTheDocument();
    });

    fireEvent.doubleClick(screen.getByTestId('list-row-1'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});

// ─── T019–T020: US4 — Editing tools removed from right-aside ─────────────────

describe('US4 — Editing tools removed from right-aside panel', () => {
  it('T019: right-aside panel does not contain crop, rotate, or flip controls', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);

    await waitFor(() => {
      expect(screen.getByTestId('photo-preview')).toBeInTheDocument();
    });

    // Editor dialog is closed — these controls must NOT exist in the tab
    expect(screen.queryByTitle(/rotate 90° left/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/rotate 90° right/i)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/flip horizontal/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^crop$/i })).not.toBeInTheDocument();
  });

  it('T020: the right-aside photo preview has the photo-preview-clickable class', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);

    await waitFor(() => {
      expect(screen.getByTestId('photo-preview')).toBeInTheDocument();
    });

    expect(screen.getByTestId('photo-preview')).toHaveClass('photo-preview-clickable');
  });
});

// ─── US1: Metadata Icon Button ───────────────────────────────────────────────

describe('US1 — Metadata icon button', () => {
  it('T003a: metadata icon button is absent when no photo is selected', () => {
    const store = makeStore(makeShelter(), []);
    render(<Provider store={store}><PhotosTab /></Provider>);
    expect(screen.queryByRole('button', { name: /view photo metadata/i })).not.toBeInTheDocument();
  });

  it('T003b: metadata icon button is present in photo-detail-head when a photo is selected', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view photo metadata/i })).toBeInTheDocument();
    });
  });

  it('T003c: clicking the metadata icon button opens the metadata dialog', async () => {
    const shelter = makeShelter();
    const photo = makePhoto({ title: 'Test Photo' });
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view photo metadata/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /view photo metadata/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('T010d: clicking the button calls readFileMetadata with the shelter slug', async () => {
    const shelter = makeShelter({ slug: 'test-shelter' });
    const photo = makePhoto({ file_name: 'shot.jpg' });
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /view photo metadata/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /view photo metadata/i }));
    expect((window as any).api.photos.readFileMetadata).toHaveBeenCalledWith('test-shelter', 'shot.jpg', expect.any(String));
  });
});

describe('US1 — Sync from File button', () => {
  it('T014a: "Sync from File" button is present when a photo is selected', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByTitle('Copy file metadata values into the editorial record')).toBeInTheDocument();
    });
  });

  it('T014b: "Import from File" label is absent', async () => {
    const shelter = makeShelter();
    const photo = makePhoto();
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.queryByText('Import from File')).not.toBeInTheDocument();
    });
  });
});
