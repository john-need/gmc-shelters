import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoDetailPane from './PhotoDetailPane';
import type { Photo } from '../../../../shared/ipc-types';

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

  it('renders the file_name below the title', () => {
    render(<PhotoDetailPane {...makeProps()} />);
    expect(screen.getByText('hut.jpg')).toBeInTheDocument();
  });

  it('Save Metadata button is disabled when not dirty', () => {
    render(<PhotoDetailPane {...makeProps({ isMetadataDirty: false })} />);
    expect(screen.getByRole('button', { name: /save metadata/i })).toBeDisabled();
  });

  it('Save Metadata button is enabled when dirty', () => {
    render(<PhotoDetailPane {...makeProps({ isMetadataDirty: true })} />);
    expect(screen.getByRole('button', { name: /save metadata/i })).not.toBeDisabled();
  });

  it('calls onSaveMetadata when Save Metadata is clicked', () => {
    const onSaveMetadata = jest.fn();
    render(<PhotoDetailPane {...makeProps({ isMetadataDirty: true, onSaveMetadata })} />);
    fireEvent.click(screen.getByRole('button', { name: /save metadata/i }));
    expect(onSaveMetadata).toHaveBeenCalledTimes(1);
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

  it('calls onOpenMetadata when metadata button is clicked', () => {
    const onOpenMetadata = jest.fn();
    render(<PhotoDetailPane {...makeProps({ onOpenMetadata })} />);
    fireEvent.click(screen.getByRole('button', { name: /view photo metadata/i }));
    expect(onOpenMetadata).toHaveBeenCalledTimes(1);
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
});
