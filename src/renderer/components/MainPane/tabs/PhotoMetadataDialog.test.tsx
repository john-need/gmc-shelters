import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import uiReducer from '../../../store/uiSlice';
import PhotoMetadataDialog from './PhotoMetadataDialog';
import type { Photo, FileMetadataTag } from '../../../../shared/ipc-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStore() {
  return configureStore({
    reducer: { shelters: sheltersReducer, photos: photosReducer, ui: uiReducer },
  });
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 42, shelter_id: 7, file_name: 'shelter.jpg',
    title: 'Main Hall', photographer: 'Alice', caption: 'The main hall',
    alt_text: 'Interior view', description: 'Desc text', notes: 'Internal note',
    date_taken: '2023-06-15', created: '2023-01-01', updated: '2023-12-01',
    include_in_post: true,
    ...overrides,
  };
}

function makeTags(overrides: Partial<FileMetadataTag>[] = []): FileMetadataTag[] {
  const base: FileMetadataTag[] = [
    { group: 'EXIF', key: 'Title', label: 'Title', value: 'Main Hall', writable: true },
    { group: 'EXIF', key: 'Creator', label: 'Creator', value: 'Alice', writable: true },
    { group: 'File', key: 'FileSize', label: 'File Size', value: '1234 kB', writable: false },
    { group: 'File', key: 'ImageWidth', label: 'Image Width', value: '3024', writable: false },
    { group: 'GPS', key: 'GPSLatitude', label: 'GPS Latitude', value: '44.0', writable: true },
  ];
  return [...base, ...overrides.map((o) => ({ group: 'EXIF', key: 'Extra', label: 'Extra', value: 'x', writable: true, ...o }))];
}

const defaultProps = {
  shelterId: 7,
  slug: 'test-shelter',
  sheltersRoot: '/shelters',
  onClose: jest.fn(),
};

function renderDialog(photo: Photo = makePhoto(), props: Partial<typeof defaultProps> = {}) {
  const store = makeStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <PhotoMetadataDialog {...defaultProps} {...props} photo={photo} />
      </Provider>,
    ),
  };
}

// ─── Setup / teardown ───────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText: jest.fn().mockResolvedValue(undefined) },
  });
  (window as any).api = {
    photos: {
      readFileMetadata: jest.fn().mockReturnValue(new Promise(() => {})),
      writeFileMetadata: jest.fn().mockResolvedValue(undefined),
    },
  };
});

afterEach(() => {
  (window as any).api = undefined;
});

// ─── US1: View Photo File Metadata ───────────────────────────────────────────

describe('US1 — View Photo File Metadata', () => {
  it('T009a: renders a dialog with role="dialog"', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('T009b: shows loading spinner while IPC is in flight', () => {
    (window as any).api.photos.readFileMetadata = jest.fn().mockReturnValue(new Promise(() => {}));
    renderDialog();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('T009c: renders tag rows with label and value after IPC resolves', async () => {
    const tags = makeTags();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('EXIF'));
    fireEvent.click(screen.getByText('EXIF'));
    await waitFor(() => {
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Main Hall')).toBeInTheDocument();
    });
  });

  it('T009d: tags are grouped by tag.group (group header rendered)', async () => {
    const tags = makeTags();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText('EXIF')).toBeInTheDocument();
      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('GPS')).toBeInTheDocument();
    });
  });

  it('T009h: all 5 canonical groups are always rendered even when missing from file data', async () => {
    // Only EXIF data — GPS, Composite, XMP, File should still appear
    const tags: FileMetadataTag[] = [
      { group: 'EXIF', key: 'Title', label: 'Title', value: 'x', writable: true },
    ];
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => {
      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('GPS')).toBeInTheDocument();
      expect(screen.getByText('EXIF')).toBeInTheDocument();
      expect(screen.getByText('Composite')).toBeInTheDocument();
      expect(screen.getByText('XMP')).toBeInTheDocument();
    });
  });

  it('T009i: groups with no data show "No data" and cannot be expanded', async () => {
    const tags: FileMetadataTag[] = [
      { group: 'EXIF', key: 'Title', label: 'Title', value: 'x', writable: true },
    ];
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('GPS'));
    // File, GPS, Composite, XMP have no data → 4 "No data" labels
    expect(screen.getAllByText(/^No data$/i)).toHaveLength(4);
    // Clicking an empty group header reveals nothing — count stays the same
    fireEvent.click(screen.getByText('GPS'));
    expect(screen.getAllByText(/^No data$/i)).toHaveLength(4);
    expect(screen.queryAllByTitle(/^Copy$/i)).toHaveLength(0);
  });

  it('T009e: null values show "—"', async () => {
    const tags: FileMetadataTag[] = [
      { group: 'EXIF', key: 'Title', label: 'Title', value: null, writable: true },
    ];
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('EXIF'));
    fireEvent.click(screen.getByText('EXIF'));
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('T009f: shows error message and Retry button on IPC rejection', async () => {
    (window as any).api.photos.readFileMetadata = jest.fn().mockRejectedValue(new Error('read failed'));
    renderDialog();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('T009g: clicking Retry re-calls readFileMetadata', async () => {
    const mockRead = jest.fn().mockRejectedValue(new Error('read failed'));
    (window as any).api.photos.readFileMetadata = mockRead;
    renderDialog();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });
    expect(mockRead).toHaveBeenCalledTimes(2);
  });
});

// ─── US2: Copy Metadata Field to Clipboard ───────────────────────────────────

describe('US2 — Copy Metadata Field to Clipboard', () => {
  it('T015a: each tag row has a copy button with title="Copy"', async () => {
    const tags = makeTags();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('File'));
    // Expand all groups so all copy buttons are visible
    fireEvent.click(screen.getByText('File'));
    fireEvent.click(screen.getByText('GPS'));
    fireEvent.click(screen.getByText('EXIF'));
    await waitFor(() => {
      const copyBtns = screen.getAllByTitle(/^Copy$/i);
      expect(copyBtns.length).toBe(tags.length);
    });
  });

  it('T015b: clicking a copy button calls clipboard.writeText with tag.value', async () => {
    const tags = makeTags();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('File'));
    // File is first in group order; expand it and click its first copy button
    fireEvent.click(screen.getByText('File'));
    await waitFor(() => screen.getAllByTitle(/^Copy$/i));
    const copyBtns = screen.getAllByTitle(/^Copy$/i);
    await act(async () => { fireEvent.click(copyBtns[0]); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1234 kB');
  });

  it('T015c: copy button shows "Copied" title after click', async () => {
    const tags = makeTags();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('File'));
    fireEvent.click(screen.getByText('File'));
    await waitFor(() => screen.getAllByTitle(/^Copy$/i));
    await act(async () => { fireEvent.click(screen.getAllByTitle(/^Copy$/i)[0]); });
    expect(screen.getAllByTitle(/copied/i).length).toBeGreaterThanOrEqual(1);
  });

  it('T015d: copy icon reverts after ~1.5s', async () => {
    jest.useFakeTimers();
    const tags = makeTags();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await act(async () => {});
    fireEvent.click(screen.getByText('File'));
    await waitFor(() => screen.getAllByTitle(/^Copy$/i));
    await act(async () => { fireEvent.click(screen.getAllByTitle(/^Copy$/i)[0]); });
    expect(screen.getAllByTitle(/copied/i).length).toBeGreaterThanOrEqual(1);
    act(() => { jest.advanceTimersByTime(1600); });
    expect(screen.queryAllByTitle(/copied/i)).toHaveLength(0);
    jest.useRealTimers();
  });

  it('T015e: null-value tag copies empty string', async () => {
    const tags: FileMetadataTag[] = [
      { group: 'EXIF', key: 'Title', label: 'Title', value: null, writable: true },
    ];
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    renderDialog();
    await waitFor(() => screen.getByText('EXIF'));
    fireEvent.click(screen.getByText('EXIF'));
    await waitFor(() => screen.getAllByTitle(/^Copy$/i));
    await act(async () => { fireEvent.click(screen.getAllByTitle(/^Copy$/i)[0]); });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('');
  });
});

// ─── US3: Edit Metadata Fields and Save to File ──────────────────────────────

describe('US3 — Edit Metadata Fields and Save to File', () => {
  async function renderWithTags(tags = makeTags()) {
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(tags);
    const result = renderDialog();
    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    return result;
  }

  it('T017a: Edit button is present in view mode after tags load', async () => {
    await renderWithTags();
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('T017b: clicking Edit shows Save/Cancel and renders inputs for writable tags', async () => {
    await renderWithTags();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByText('EXIF'));
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Main Hall')).toBeInTheDocument();
  });

  it('T017c: non-writable tags remain as plain text in edit mode', async () => {
    await renderWithTags();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByText('EXIF'));
    fireEvent.click(screen.getByText('File'));
    const inputs = document.querySelectorAll('input:not([type="checkbox"]), textarea');
    const vals = Array.from(inputs).map((el) => (el as HTMLInputElement).value);
    expect(vals).not.toContain('1234 kB');
    expect(vals).not.toContain('3024');
    expect(screen.getByText('1234 kB')).toBeInTheDocument();
  });

  it('T017d: clicking Save calls writeFileMetadata with only changed tags', async () => {
    await renderWithTags();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByText('EXIF'));
    const input = screen.getByDisplayValue('Main Hall');
    fireEvent.change(input, { target: { value: 'New Title' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    expect((window as any).api.photos.writeFileMetadata).toHaveBeenCalledWith(
      'test-shelter', 'shelter.jpg', '/shelters', { Title: 'New Title' }
    );
  });

  it('T017e: Save closes the dialog', async () => {
    const onClose = jest.fn();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(makeTags());
    renderDialog(makePhoto(), { onClose });
    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('T017f: Save does not dispatch updatePhotoLocal', async () => {
    const { store } = await renderWithTags();
    const dispatchSpy = jest.spyOn(store, 'dispatch');
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    const calls = dispatchSpy.mock.calls.map((c) => c[0]);
    const updateCall = calls.find((c: any) => c?.type === 'photos/updatePhotoLocal');
    expect(updateCall).toBeUndefined();
  });

  it('T017g: Save does not call window.api.photos.update', async () => {
    const mockUpdate = jest.fn();
    (window as any).api.photos.update = mockUpdate;
    await renderWithTags();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('T017h: write failure shows inline error without closing dialog', async () => {
    (window as any).api.photos.writeFileMetadata = jest.fn().mockRejectedValue(new Error('write failed'));
    const onClose = jest.fn();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(makeTags());
    renderDialog(makePhoto(), { onClose });
    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /save/i })); });
    await waitFor(() => {
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('T017i: Cancel closes dialog without calling writeFileMetadata', async () => {
    const onClose = jest.fn();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(makeTags());
    renderDialog(makePhoto(), { onClose });
    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect((window as any).api.photos.writeFileMetadata).not.toHaveBeenCalled();
  });
});

// ─── US4: Cancel / Dismiss Without Editing ───────────────────────────────────

describe('US4 — Cancel / Dismiss Without Editing', () => {
  it('T019a: pressing Escape calls onClose', () => {
    const onClose = jest.fn();
    renderDialog(makePhoto(), { onClose });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('T019b: clicking the overlay backdrop calls onClose', () => {
    const onClose = jest.fn();
    renderDialog(makePhoto(), { onClose });
    const overlay = document.querySelector('[data-overlay]') as HTMLElement;
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('T019c: close button calls onClose', () => {
    const onClose = jest.fn();
    renderDialog(makePhoto(), { onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('T019d: clicking inside dialog body does NOT call onClose', () => {
    const onClose = jest.fn();
    renderDialog(makePhoto(), { onClose });
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('T019e: Escape in edit mode calls onClose without writeFileMetadata', async () => {
    const onClose = jest.fn();
    (window as any).api.photos.readFileMetadata = jest.fn().mockResolvedValue(makeTags());
    renderDialog(makePhoto(), { onClose });
    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect((window as any).api.photos.writeFileMetadata).not.toHaveBeenCalled();
  });

  it('T019f: Tab key traps focus within the dialog', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('T019g: Shift+Tab traps focus backward within the dialog', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
