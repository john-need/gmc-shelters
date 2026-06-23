import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { PhotoCard, PhotoCardOverlay } from './PhotoCard';
import type { Photo } from '../../../../shared/ipc-types';

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1, shelter_id: 10, file_name: 'test.jpg',
    title: 'Test Photo', photographer: '', caption: '', alt_text: '',
    description: '', notes: '', date_taken: '',
    created: '2024-01-01', updated: '2024-01-01', include_in_post: false,
    ...overrides,
  };
}

const baseProps = {
  idx: 0, isDefault: false, isSelected: false,
  onSelect: jest.fn(), onOpenEditor: jest.fn(), onToggleInclude: jest.fn(),
  photoUrl: '',
};

function renderCard(p: Photo, props = {}) {
  return render(
    <DndContext>
      <SortableContext items={[p.id]}>
        <PhotoCard p={p} {...baseProps} {...props} />
      </SortableContext>
    </DndContext>,
  );
}

describe('PhotoCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the photo title', () => {
    renderCard(makePhoto({ title: 'Trailside Hut' }));
    expect(screen.getByText('Trailside Hut')).toBeInTheDocument();
  });

  it('renders "Untitled" when title is empty', () => {
    renderCard(makePhoto({ title: '' }));
    expect(screen.getByText('Untitled')).toBeInTheDocument();
  });

  it('shows the default badge when isDefault is true', () => {
    renderCard(makePhoto(), { isDefault: true });
    expect(screen.getByTestId('photo-card-1').querySelector('.photo-default-badge')).toBeInTheDocument();
  });

  it('omits the default badge when isDefault is false', () => {
    renderCard(makePhoto(), { isDefault: false });
    expect(screen.getByTestId('photo-card-1').querySelector('.photo-default-badge')).toBeNull();
  });

  it('applies "selected" class when isSelected is true', () => {
    renderCard(makePhoto(), { isSelected: true });
    expect(screen.getByTestId('photo-card-1')).toHaveClass('selected');
  });

  it('calls onSelect with the photo id on click', () => {
    const onSelect = jest.fn();
    renderCard(makePhoto(), { onSelect });
    fireEvent.click(screen.getByTestId('photo-card-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('calls onOpenEditor with the photo id on double-click', () => {
    const onOpenEditor = jest.fn();
    renderCard(makePhoto(), { onOpenEditor });
    fireEvent.doubleClick(screen.getByTestId('photo-card-1'));
    expect(onOpenEditor).toHaveBeenCalledWith(1);
  });

  it('renders include_in_post checkbox checked when true', () => {
    renderCard(makePhoto({ include_in_post: true }));
    expect(within(screen.getByTestId('photo-card-1')).getByRole('checkbox', { name: /include in post/i })).toBeChecked();
  });

  it('renders include_in_post checkbox unchecked when false', () => {
    renderCard(makePhoto({ include_in_post: false }));
    expect(within(screen.getByTestId('photo-card-1')).getByRole('checkbox', { name: /include in post/i })).not.toBeChecked();
  });

  it('calls onToggleInclude when checkbox is clicked', () => {
    const onToggleInclude = jest.fn();
    renderCard(makePhoto({ include_in_post: false }), { onToggleInclude });
    fireEvent.click(within(screen.getByTestId('photo-card-1')).getByRole('checkbox', { name: /include in post/i }));
    expect(onToggleInclude).toHaveBeenCalledWith(1, true);
  });

  it('shows "Post on web" label text', () => {
    renderCard(makePhoto());
    expect(within(screen.getByTestId('photo-card-1')).getByText('Post on web')).toBeInTheDocument();
  });
});

describe('PhotoCardOverlay', () => {
  it('renders without crashing', () => {
    render(<PhotoCardOverlay p={makePhoto()} idx={0} isDefault={false} onToggleInclude={jest.fn()} photoUrl="" />);
    expect(document.querySelector('.photo-card')).toBeInTheDocument();
  });
});
