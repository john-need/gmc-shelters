import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import sheltersReducer from '../../../store/sheltersSlice';
import photosReducer from '../../../store/photosSlice';
import uiReducer from '../../../store/uiSlice';
import PhotoDetailPane from './PhotoDetailPane';
import type { Photo } from '../../../../shared/ipc-types';

function makeStore() {
  return configureStore({
    reducer: { shelters: sheltersReducer, photos: photosReducer, ui: uiReducer },
  });
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1, shelter_id: 10, file_name: 'hut.jpg',
    title: 'Trailside Hut', photographer: 'Jane Doe', caption: 'A fine hut.',
    alt_text: '', description: '', notes: '', date_taken: '1975',
    created: '2024-01-01', updated: '2024-01-01', include_in_post: false,
    ...overrides,
  };
}

function makeProps(overrides = {}) {
  return {
    selected: makePhoto(),
    shelterId: 10,
    shelterSlug: 'test-shelter',
    isDefault: false,
    selectedIdx: 0,
    selectedPhotoUrl: '',
    editorPhotoUrl: '',
    isMetadataDirty: false,
    detailWidth: 380,
    resizing: false,
    sheltersRoot: '/shelters',
    editorOpen: false,
    metadataOpen: false,
    onStartResize: jest.fn(),
    onOpenMetadata: jest.fn(),
    onSetDefault: jest.fn(),
    onExport: jest.fn(),
    onDelete: jest.fn(),
    onMove: jest.fn(),
    canMove: true,
    onUpdatePhoto: jest.fn(),
    onSaveMetadata: jest.fn(),
    onImportMetadata: jest.fn(),
    onOpenEditor: jest.fn(),
    onEditorSave: jest.fn(),
    onEditorCancel: jest.fn(),
    onMetadataClose: jest.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  (window as { api: unknown }).api = {
    photos: { readFileMetadata: jest.fn().mockReturnValue(new Promise(() => {})) },
  };
});
afterEach(() => { (window as { api: unknown }).api = undefined; });

describe('PhotoDetailPane', () => {
  it('renders the photo title', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    expect(screen.getByText('Trailside Hut')).toBeInTheDocument();
  });

  it('renders "Untitled" when title is empty', () => {
    render(<PhotoDetailPane {...makeProps({ selected: makePhoto({ title: '' }) })} />);
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('renders the photo id just below the title', () => {
    render(<PhotoDetailPane {...makeProps({ selected: makePhoto({ id: 42 }) })} />);
    const title = screen.getByText('Trailside Hut');
    const idText = screen.getByText('#42');
    // eslint-disable-next-line no-bitwise
    expect(title.compareDocumentPosition(idText) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('arranges the four icon buttons in a 2x2 grid to the right of the title', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    const group = screen.getByTitle('Set as default photo').parentElement;
    expect(group).toHaveStyle({ display: 'grid', gridTemplateColumns: 'repeat(2, auto)' });
    expect(group?.children).toHaveLength(4);
  });

  it('renders the file_name just below the photo image', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    const preview = screen.getByTestId('photo-preview');
    const fileName = screen.getByText('hut.jpg');
    // eslint-disable-next-line no-bitwise
    expect(preview.compareDocumentPosition(fileName) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Save button is disabled when not dirty', () => {
    render(<PhotoDetailPane {...makeProps({ isMetadataDirty: false })} />);
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('Save button is enabled when dirty', () => {
    render(<PhotoDetailPane {...makeProps({ isMetadataDirty: true })} />);
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled();
  });

  it('calls onSaveMetadata when Save is clicked', () => {
    const onSaveMetadata = jest.fn();
    render(<PhotoDetailPane {...makeProps({ isMetadataDirty: true, onSaveMetadata })} />);
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onSaveMetadata).toHaveBeenCalledTimes(1);
  });

  it('labels the sync-from-file button "Import"', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument();
  });

  it('renders a "Metadata" header above the action buttons', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    expect(screen.getByText('Metadata')).toBeInTheDocument();
  });

  it('keeps the View / Save / Import buttons outside the scrollable fields area (static footer)', () => {
    const { container } = render(<PhotoDetailPane {...makeProps()} />);
    const fields = container.querySelector('.photo-fields');
    const saveButton = screen.getByRole('button', { name: /^save$/i });
    expect(fields?.contains(saveButton)).toBe(false);
  });

  it('View button lives in the static footer, labeled "View", and calls onOpenMetadata', () => {
    const onOpenMetadata = jest.fn();
    const { container } = render(<PhotoDetailPane {...makeProps({ onOpenMetadata })} />);
    const viewButton = screen.getByRole('button', { name: /^view$/i });
    const actions = container.querySelector('.photo-detail-actions');
    expect(actions?.contains(viewButton)).toBe(true);
    fireEvent.click(viewButton);
    expect(onOpenMetadata).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenEditor when the preview is clicked', () => {
    const onOpenEditor = jest.fn();
    render(<PhotoDetailPane {...makeProps({ onOpenEditor })} />);
    fireEvent.click(screen.getByTestId('photo-preview'));
    expect(onOpenEditor).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when the delete button is clicked', () => {
    const onDelete = jest.fn();
    render(<PhotoDetailPane {...makeProps({ onDelete })} />);
    fireEvent.click(screen.getByTitle('Delete photo'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onMove when the move button is clicked', () => {
    const onMove = jest.fn();
    render(<PhotoDetailPane {...makeProps({ onMove })} />);
    fireEvent.click(screen.getByTitle('Move to shelter'));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('disables the move button when canMove is false', () => {
    render(<PhotoDetailPane {...makeProps({ canMove: false })} />);
    expect(screen.getByTitle('Move to shelter')).toBeDisabled();
  });

  it('enables the move button when canMove is true', () => {
    render(<PhotoDetailPane {...makeProps({ canMove: true })} />);
    expect(screen.getByTitle('Move to shelter')).not.toBeDisabled();
  });

  it('shows the ★ Default badge when isDefault is true', () => {
    render(<PhotoDetailPane {...makeProps({ isDefault: true })} />);
    expect(screen.getByText(/★ default/i)).toBeInTheDocument();
  });

  it('does not show the default badge when isDefault is false', () => {
    render(<PhotoDetailPane {...makeProps({ isDefault: false })} />);
    expect(screen.queryByText(/★ default/i)).not.toBeInTheDocument();
  });

  it('shows photo_preview-clickable class on the preview', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    expect(screen.getByTestId('photo-preview')).toHaveClass('photo-preview-clickable');
  });

  it('calls onExport when Export button is clicked', () => {
    const onExport = jest.fn();
    render(<PhotoDetailPane {...makeProps({ onExport })} />);
    fireEvent.click(screen.getByRole('button', { name: /export photo/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('renders the preview pane image using selectedPhotoUrl (preview-size thumbnail)', () => {
    render(<PhotoDetailPane {...makeProps({ selectedPhotoUrl: '/preview-thumb.jpg', editorPhotoUrl: '/full-res.jpg' })} />);
    const preview = screen.getByTestId('photo-preview');
    expect(preview.querySelector('img')?.getAttribute('src')).toBe('/preview-thumb.jpg');
  });

  it('passes editorPhotoUrl (not selectedPhotoUrl) to the photo editor dialog', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <PhotoDetailPane {...makeProps({
          editorOpen: true,
          selectedPhotoUrl: '/preview-thumb.jpg',
          editorPhotoUrl: '/full-res.jpg',
        })} />
      </Provider>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('img')?.getAttribute('src')).toBe('/full-res.jpg');
  });
});
