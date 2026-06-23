import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { ListRow, ListRowOverlay } from './ListRow';
import type { Photo } from '../../../../shared/ipc-types';

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 1, shelter_id: 10, file_name: 'test.jpg',
    title: 'Test Photo', photographer: 'Jane Doe', caption: '', alt_text: '',
    description: '', notes: '', date_taken: '1980',
    created: '2024-01-01', updated: '2024-01-01', include_in_post: false,
    ...overrides,
  };
}

const baseProps = {
  idx: 0, isDefault: false, isSelected: false,
  onSelect: jest.fn(), onOpenEditor: jest.fn(), onToggleInclude: jest.fn(),
  photoUrl: '',
};

function renderRow(p: Photo, props = {}) {
  return render(
    <DndContext>
      <SortableContext items={[p.id]}>
        <ListRow p={p} {...baseProps} {...props} />
      </SortableContext>
    </DndContext>,
  );
}

describe('ListRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the photo title', () => {
    renderRow(makePhoto({ title: 'Summit Shelter' }));
    expect(screen.getByTestId('list-row-1')).toHaveTextContent('Summit Shelter');
  });

  it('renders "Untitled" when title is empty', () => {
    renderRow(makePhoto({ title: '' }));
    expect(screen.getByTestId('list-row-1')).toHaveTextContent('Untitled');
  });

  it('renders photographer name', () => {
    renderRow(makePhoto({ photographer: 'Jane Doe' }));
    expect(screen.getByTestId('list-row-1')).toHaveTextContent('Jane Doe');
  });

  it('renders date taken', () => {
    renderRow(makePhoto({ date_taken: '1980' }));
    expect(screen.getByTestId('list-row-1')).toHaveTextContent('1980');
  });

  it('renders a drag handle as the first child', () => {
    renderRow(makePhoto());
    const row = screen.getByTestId('list-row-1');
    expect(row.querySelector('.list-drag-handle')).toBeInTheDocument();
    expect(row.firstElementChild).toBe(row.querySelector('.list-drag-handle'));
  });

  it('calls onSelect when the row is clicked', () => {
    const onSelect = jest.fn();
    renderRow(makePhoto(), { onSelect });
    fireEvent.click(screen.getByTestId('list-row-1'));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('calls onOpenEditor when the row is double-clicked', () => {
    const onOpenEditor = jest.fn();
    renderRow(makePhoto(), { onOpenEditor });
    fireEvent.doubleClick(screen.getByTestId('list-row-1'));
    expect(onOpenEditor).toHaveBeenCalledWith(1);
  });

  it('renders the include_in_post checkbox checked when true', () => {
    renderRow(makePhoto({ include_in_post: true }));
    expect(within(screen.getByTestId('list-row-1')).getByRole('checkbox', { name: /include in post/i })).toBeChecked();
  });

  it('calls onToggleInclude when checkbox is clicked', () => {
    const onToggleInclude = jest.fn();
    renderRow(makePhoto({ include_in_post: false }), { onToggleInclude });
    fireEvent.click(within(screen.getByTestId('list-row-1')).getByRole('checkbox', { name: /include in post/i }));
    expect(onToggleInclude).toHaveBeenCalledWith(1, true);
  });
});

describe('ListRowOverlay', () => {
  it('renders without crashing', () => {
    render(<ListRowOverlay p={makePhoto()} idx={0} isDefault={false} onToggleInclude={jest.fn()} photoUrl="" />);
    expect(document.querySelector('.list-drag-handle')).toBeInTheDocument();
  });
});
