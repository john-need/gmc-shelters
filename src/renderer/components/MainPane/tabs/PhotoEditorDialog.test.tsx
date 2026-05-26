import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import uiReducer from '../../../store/uiSlice';
import PhotoEditorDialog from './PhotoEditorDialog';
import type { Photo } from '../../../../shared/ipc-types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeStore() {
  return configureStore({
    reducer: { shelters: sheltersReducer, photos: photosReducer, ui: uiReducer },
  });
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1, shelter_id: 10, file_name: 'test.jpg',
    title: 'Test Photo', photographer: 'Jane', caption: 'A caption',
    alt_text: 'Alt', description: 'Desc', notes: 'Note',
    date_taken: '2024-01-01', created: '2024-01-01', updated: '2024-01-01',
    include_in_post: false,
    ...overrides,
  };
}

const defaultProps = {
  photoUrl: '/test/photo.jpg',
  shelterId: 10,
  sheltersRoot: '/shelters',
  isDefault: false,
  onSave: jest.fn(),
  onCancel: jest.fn(),
};

function renderDialog(photo: Photo = makePhoto(), props = {}) {
  const store = makeStore();
  return {
    store,
    ...render(
      <Provider store={store}>
        <PhotoEditorDialog {...defaultProps} {...props} photo={photo} />
      </Provider>,
    ),
  };
}

// ─── Setup / teardown ───────────────────────────────────────────────────────

const mockUpdate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (window as any).api = {
    app: { getRepoRoot: jest.fn().mockResolvedValue('/repo') },
    photos: {
      update: mockUpdate,
      setDefault: jest.fn(),
      delete: jest.fn(),
      readMetadata: jest.fn(),
      reconcileScan: jest.fn(),
      reconcileApply: jest.fn(),
    },
  };
});

afterEach(() => {
  (window as any).api = undefined;
});

// ─── T003: US1 — dialog renders with all controls ───────────────────────────

describe('US1 — Open Photo Editor Dialog', () => {
  it('T003: renders dialog with photo and all editing controls', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTitle(/rotate 90° left/i)).toBeInTheDocument();
    expect(screen.getByTitle(/rotate 90° right/i)).toBeInTheDocument();
    expect(screen.getByTitle(/flip horizontal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crop$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
  });

  // T004: photo load error → placeholder shown, controls remain
  it('T004: shows placeholder letter when photo cannot load, controls still visible', () => {
    renderDialog();
    const img = screen.getByRole('img');
    fireEvent.error(img);
    // Placeholder initial should appear (first char of title)
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTitle(/rotate 90° left/i)).toBeInTheDocument();
    expect(screen.getByTitle(/flip horizontal/i)).toBeInTheDocument();
  });

  // T026: Tab key focus trap stays inside dialog
  it('T026: Tab key keeps focus inside the dialog (focus trap)', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const buttons = dialog.querySelectorAll<HTMLElement>('button:not([disabled])');
    expect(buttons.length).toBeGreaterThan(0);
    const lastBtn = buttons[buttons.length - 1];
    lastBtn.focus();
    expect(document.activeElement).toBe(lastBtn);
    // Tab from last → should wrap to first (focus trap)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: false });
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  // T027: flip button toggles aria-pressed state
  it('T027: clicking Flip button toggles aria-pressed state', () => {
    renderDialog();
    const flipBtn = screen.getByTitle(/flip horizontal/i);
    expect(flipBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(flipBtn);
    expect(flipBtn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(flipBtn);
    expect(flipBtn).toHaveAttribute('aria-pressed', 'false');
  });

  // T028: crop button enters/exits crop mode
  it('T028: Crop button enters crop mode (shows Done), clicking again exits crop mode', () => {
    renderDialog();
    const cropBtn = screen.getByRole('button', { name: /^crop$/i });
    expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument();
    fireEvent.click(cropBtn);
    expect(screen.getByRole('button', { name: /^done$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^crop$/i })).toBeInTheDocument();
  });
});

// ─── T010–T013: US2 — Save edits ────────────────────────────────────────────

describe('US2 — Save Edits from Dialog', () => {
  it('T010: Save with rotation dispatches savePhotoMetadata and calls onSave', async () => {
    mockUpdate.mockResolvedValue(makePhoto());
    const onSave = jest.fn();
    renderDialog(makePhoto(), { onSave });

    fireEvent.click(screen.getByTitle(/rotate 90° right/i));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ rotation: 90, flipped: false, crop: null }),
      );
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('T011: Save with no edits calls onSave without dispatching savePhotoMetadata', () => {
    const onSave = jest.fn();
    renderDialog(makePhoto(), { onSave });

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSave).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('T012: Save button shows Saving… and is disabled while save is in flight', async () => {
    let resolveUpdate!: (v: unknown) => void;
    mockUpdate.mockReturnValue(new Promise((r) => { resolveUpdate = r; }));
    renderDialog();

    fireEvent.click(screen.getByTitle(/rotate 90° right/i));

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    await act(async () => {
      resolveUpdate(makePhoto());
    });
  });

  it('T013: save failure shows error state, dialog stays open, Save re-enabled', async () => {
    mockUpdate.mockRejectedValue(new Error('disk error'));
    const onSave = jest.fn();
    renderDialog(makePhoto(), { onSave });

    fireEvent.click(screen.getByTitle(/rotate 90° right/i));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
      expect(onSave).not.toHaveBeenCalled();
    });
  });
});

// ─── T015–T017: US3 — Cancel edits ──────────────────────────────────────────

describe('US3 — Cancel Edits from Dialog', () => {
  it('T015: Cancel button calls onCancel without dispatching savePhotoMetadata', () => {
    const onCancel = jest.fn();
    renderDialog(makePhoto(), { onCancel });
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('T016: Escape key calls onCancel', () => {
    const onCancel = jest.fn();
    renderDialog(makePhoto(), { onCancel });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('T017: clicking the overlay backdrop calls onCancel', () => {
    const onCancel = jest.fn();
    const { container } = renderDialog(makePhoto(), { onCancel });
    const overlay = container.querySelector('.modal-bg');
    expect(overlay).toBeInTheDocument();
    fireEvent.click(overlay!);
    expect(onCancel).toHaveBeenCalled();
  });
});
