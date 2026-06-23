import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SourcePicker from './SourcePicker';
import type { SourceRef } from '../../../../shared/ipc-types';

function ref(o: Partial<SourceRef> = {}): SourceRef {
  return {
    id: 0, type: 'book', author: '', title: '', container_title: '', editor: '',
    edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
    year: null, date: '', url: '', access_date: '', archive: '', archive_location: '',
    ...o,
  };
}

const baseProps = {
  open: true,
  type: 'book' as const,
  sources: [],
  onPick: jest.fn(),
  onClose: jest.fn(),
};

describe('SourcePicker', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when open is false', () => {
    render(<SourcePicker {...baseProps} open={false} />);
    expect(screen.queryByText(/reuse an existing source/i)).not.toBeInTheDocument();
  });

  it('shows heading when open', () => {
    render(<SourcePicker {...baseProps} />);
    expect(screen.getByText(/reuse an existing source/i)).toBeInTheDocument();
  });

  it('lists sources matching the selected type, alphabetically by title', () => {
    const sources = [
      ref({ id: 1, type: 'book', title: 'Beta' }),
      ref({ id: 2, type: 'book', title: 'Alpha' }),
      ref({ id: 3, type: 'journal', container_title: 'Nature' }),
    ];
    render(<SourcePicker {...baseProps} sources={sources} />);
    const rows = screen.getAllByTestId(/^picker-row-/);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual(['picker-row-2', 'picker-row-1']);
    expect(screen.queryByText('Nature')).not.toBeInTheDocument();
  });

  it('de-duplicates sources with identical field signatures', () => {
    const sources = [
      ref({ id: 1, type: 'book', title: 'Same', author: 'Doe' }),
      ref({ id: 2, type: 'book', title: 'Same', author: 'Doe' }),
    ];
    render(<SourcePicker {...baseProps} sources={sources} />);
    expect(screen.getAllByTestId(/^picker-row-/)).toHaveLength(1);
  });

  it('filters rows via search boxes', () => {
    const sources = [
      ref({ id: 1, type: 'book', title: 'Alpha' }),
      ref({ id: 2, type: 'book', title: 'Beta' }),
    ];
    render(<SourcePicker {...baseProps} sources={sources} />);
    fireEvent.change(screen.getByLabelText(/search title/i), { target: { value: 'bet' } });
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('shows "No matching sources" when search yields no results', () => {
    render(<SourcePicker {...baseProps} sources={[ref({ id: 1, type: 'book', title: 'Alpha' })]} />);
    fireEvent.change(screen.getByLabelText(/search title/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/no matching sources/i)).toBeInTheDocument();
  });

  it('calls onPick with the row when a row is clicked', () => {
    const onPick = jest.fn();
    const s = ref({ id: 5, type: 'book', title: 'Picked' });
    render(<SourcePicker {...baseProps} sources={[s]} onPick={onPick} />);
    fireEvent.click(screen.getByTestId('picker-row-5'));
    expect(onPick).toHaveBeenCalledWith(s);
  });

  it('calls onClose when Back is clicked', () => {
    const onClose = jest.fn();
    render(<SourcePicker {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
