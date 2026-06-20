import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { configureStore, combineReducers } from '@reduxjs/toolkit';
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
    category: '', show_on_web: false, history: null,
    ...overrides,
  };
}

function makeStore(shelter: Shelter, photos: Photo[] = []) {
  const reducer = combineReducers({ shelters: sheltersReducer, photos: photosReducer, ui: uiReducer });
  return configureStore({
    reducer,
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
    } as unknown as ReturnType<typeof reducer>,
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
const mockReorderPhotos = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (window as { api: unknown }).api = {
    app: { getRepoRoot: jest.fn().mockResolvedValue('/repo') },
    photos: {
      update: jest.fn().mockImplementation((photo: Partial<Photo>) => Promise.resolve({
        file_name: 'test.jpg', created: '2024-01-01', shelter_id: 10,
        ...photo, updated: '2024-01-01',
      })),
      reorder: mockReorderPhotos,
      reconcileScan: mockReconcileScan,
      reconcileApply: mockReconcileApply,
      readFileMetadata: jest.fn().mockReturnValue(new Promise(() => {})),
      writeFileMetadata: jest.fn().mockResolvedValue(undefined),
      readMetadata: jest.fn().mockResolvedValue({}),
      export: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
});

afterEach(() => {
  (window as { api: unknown }).api = undefined;
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
    expect(window.api.photos.readFileMetadata).toHaveBeenCalledWith('test-shelter', 'shot.jpg', expect.any(String));
  });

  it('export icon button is present in photo-detail-head when a photo is selected', async () => {
    const store = makeStore(makeShelter(), [makePhoto()]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export photo/i })).toBeInTheDocument();
    });
  });

  it('clicking the export button calls photos.export with the slug, file name and title', async () => {
    const shelter = makeShelter({ slug: 'test-shelter' });
    const photo = makePhoto({ file_name: 'shot.jpg', title: 'Town Hall' });
    const store = makeStore(shelter, [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /export photo/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /export photo/i }));
    });
    expect(window.api.photos.export).toHaveBeenCalledWith('test-shelter', 'shot.jpg', 'Town Hall', expect.any(String));
  });

  it('clicking delete opens a confirm dialog without deleting immediately', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ file_name: 'shot.jpg' })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete photo/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete photo/i }));
    expect(screen.getByRole('dialog', { name: /confirm/i })).toBeInTheDocument();
    expect(window.api.photos.delete).not.toHaveBeenCalled();
  });

  it('confirming the delete dialog calls photos.delete', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ id: 1, file_name: 'shot.jpg' })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete photo/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete photo/i }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog', { name: /confirm/i })).getByRole('button', { name: /^delete$/i }));
    });
    expect(window.api.photos.delete).toHaveBeenCalledWith(1, expect.any(String));
  });

  it('cancelling the delete dialog does not call photos.delete', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ file_name: 'shot.jpg' })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete photo/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /delete photo/i }));
    fireEvent.click(within(screen.getByRole('dialog', { name: /confirm/i })).getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog', { name: /confirm/i })).not.toBeInTheDocument();
    expect(window.api.photos.delete).not.toHaveBeenCalled();
  });
});

describe('include_in_post quick-toggle checkbox', () => {
  it('grid: renders unchecked checkbox when include_in_post is false', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ include_in_post: false })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => expect(screen.getByTestId('photo-card-1')).toBeInTheDocument());
    const cb = within(screen.getByTestId('photo-card-1')).getByRole('checkbox', { name: /include in post/i });
    expect(cb).not.toBeChecked();
  });

  // dnd-kit's pointer drag cannot be driven by jsdom's fireEvent.drag*, so the
  // reorder math + persistence are covered at the seam: reorderByIds.test.ts and
  // photosSlice.test.ts (reorderPhotos thunk). Here we verify the views mount the
  // photos as sortable items in order.
  describe('photo drag reordering', () => {
    const threePhotos = () => [
      makePhoto({ id: 1, title: 'First', file_name: 'first.jpg' }),
      makePhoto({ id: 2, title: 'Second', file_name: 'second.jpg' }),
      makePhoto({ id: 3, title: 'Third', file_name: 'third.jpg' }),
    ];

    it('grid: renders photos as sortable cards in order', async () => {
      const store = makeStore(makeShelter(), threePhotos());
      render(<Provider store={store}><PhotosTab /></Provider>);

      const cards = await screen.findAllByTestId(/^photo-card-/);
      expect(cards.map((c) => c.getAttribute('data-testid'))).toEqual([
        'photo-card-1', 'photo-card-2', 'photo-card-3',
      ]);
      expect(cards[0]).toHaveAttribute('aria-roledescription', 'sortable');
    });

    it('list: renders rows as sortable items in order', async () => {
      const store = makeStore(makeShelter(), threePhotos());
      render(<Provider store={store}><PhotosTab /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /list/i }));

      const rows = await screen.findAllByTestId(/^list-row-/);
      expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
        'list-row-1', 'list-row-2', 'list-row-3',
      ]);
      // Sortable attributes live on the dedicated drag handle, not the whole row.
      expect(rows[0].querySelector('.list-drag-handle')).toHaveAttribute('aria-roledescription', 'sortable');
    });
  });

  it('grid: renders checked checkbox when include_in_post is true', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ include_in_post: true })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => expect(screen.getByTestId('photo-card-1')).toBeInTheDocument());
    const cb = within(screen.getByTestId('photo-card-1')).getByRole('checkbox', { name: /include in post/i });
    expect(cb).toBeChecked();
  });

  it('grid: clicking checkbox calls photos.update with toggled include_in_post', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ include_in_post: false })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    await waitFor(() => expect(screen.getByTestId('photo-card-1')).toBeInTheDocument());
    const cb = within(screen.getByTestId('photo-card-1')).getByRole('checkbox', { name: /include in post/i });
    await act(async () => { fireEvent.click(cb); });
    expect(window.api.photos.update).toHaveBeenCalledWith(
      expect.objectContaining({ include_in_post: true }),
    );
  });

  it('list: renders unchecked checkbox when include_in_post is false', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ include_in_post: false })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    await waitFor(() => expect(screen.getByTestId('list-row-1')).toBeInTheDocument());
    const cb = within(screen.getByTestId('list-row-1')).getByRole('checkbox', { name: /include in post/i });
    expect(cb).not.toBeChecked();
  });

  it('list: renders checked checkbox when include_in_post is true', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ include_in_post: true })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    await waitFor(() => expect(screen.getByTestId('list-row-1')).toBeInTheDocument());
    const cb = within(screen.getByTestId('list-row-1')).getByRole('checkbox', { name: /include in post/i });
    expect(cb).toBeChecked();
  });

  it('list: clicking checkbox calls photos.update with toggled include_in_post', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ include_in_post: false })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    await waitFor(() => expect(screen.getByTestId('list-row-1')).toBeInTheDocument());
    const cb = within(screen.getByTestId('list-row-1')).getByRole('checkbox', { name: /include in post/i });
    await act(async () => { fireEvent.click(cb); });
    expect(window.api.photos.update).toHaveBeenCalledWith(
      expect.objectContaining({ include_in_post: true }),
    );
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

  describe('photo date taken field', () => {
    it('accepts a year-only value and saves it', async () => {
      const shelter = makeShelter();
      const photo = makePhoto();
      const store = makeStore(shelter, [photo]);
      render(<Provider store={store}><PhotosTab /></Provider>);

      const input = await screen.findByLabelText(/date taken/i);
      fireEvent.change(input, { target: { value: '1984' } });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /save metadata/i }));
      });

      await waitFor(() => {
        expect(window.api.photos.update).toHaveBeenCalledWith(
          expect.objectContaining({ date_taken: '1984' }),
        );
      });
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

describe('default photo badge (grid view)', () => {
  it('renders the default badge as an overlay inside the photo thumb', async () => {
    const photo = makePhoto({ id: 1 });
    const store = makeStore(makeShelter({ default_photo_id: 1 }), [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    const card = await screen.findByTestId('photo-card-1');
    const badge = card.querySelector('.photo-thumb .photo-default-badge');
    expect(badge).toBeInTheDocument();
    expect(badge?.textContent?.toLowerCase()).toContain('default');
    expect(badge?.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render the badge in the meta row below the thumb', async () => {
    const photo = makePhoto({ id: 1 });
    const store = makeStore(makeShelter({ default_photo_id: 1 }), [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    const card = await screen.findByTestId('photo-card-1');
    expect(card.querySelector('.photo-meta .photo-default-badge')).toBeNull();
  });

  it('renders no badge when the photo is not the default', async () => {
    const photo = makePhoto({ id: 1 });
    const store = makeStore(makeShelter({ default_photo_id: null }), [photo]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    const card = await screen.findByTestId('photo-card-1');
    expect(card.querySelector('.photo-default-badge')).toBeNull();
  });

  it('labels the include-in-post toggle "Post on web"', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ id: 1 })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    const card = await screen.findByTestId('photo-card-1');
    expect(within(card).getByText('Post on web')).toBeInTheDocument();
    expect(within(card).queryByText('pub')).toBeNull();
  });
});

describe('list view drag handle', () => {
  it('renders a dedicated drag handle as the first cell of each row', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ id: 1 })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    const row = await screen.findByTestId('list-row-1');
    const handle = row.querySelector('.list-drag-handle');
    expect(handle).toBeInTheDocument();
    expect(row.firstElementChild).toBe(handle);
  });

  it('does not set a grab cursor on the whole row', async () => {
    const store = makeStore(makeShelter(), [makePhoto({ id: 1 })]);
    render(<Provider store={store}><PhotosTab /></Provider>);
    fireEvent.click(screen.getByRole('button', { name: /list/i }));
    const row = await screen.findByTestId('list-row-1');
    expect(row.style.cursor).not.toBe('grab');
  });
});
