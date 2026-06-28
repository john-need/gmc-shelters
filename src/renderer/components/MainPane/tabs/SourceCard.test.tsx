import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SourceCard from './SourceCard';
import type { Source } from '../../../../shared/ipc-types';

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1, shelter_id: 7, include_in_history: false,
    type: 'book', author: 'Doe, Jane', title: 'The Green Mountain Trail',
    container_title: '', editor: '', edition: '', volume: '', issue: '', pages: '',
    publisher: 'GMC Press', place: 'Waterbury', year: 1972, date: '',
    url: '', access_date: '', archive: '', archive_location: '',
    annotation: '', notes: '', quote: '',
    created: '2020-01-01', updated: '2020-01-02',
    ...overrides,
  };
}

const baseProps = {
  selected: false,
  onClick: jest.fn(),
  onToggleInclude: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
};

describe('SourceCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the type badge', () => {
    render(<SourceCard s={makeSource()} {...baseProps} />);
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('renders the formatted citation', () => {
    render(<SourceCard s={makeSource()} {...baseProps} />);
    expect(document.querySelector('.source-citation')).toBeInTheDocument();
  });

  it('shows the year chip when year is set', () => {
    render(<SourceCard s={makeSource({ year: 1972 })} {...baseProps} />);
    expect(screen.getByText('1972')).toBeInTheDocument();
  });

  it('omits the year chip when year is null', () => {
    render(<SourceCard s={makeSource({ year: null })} {...baseProps} />);
    expect(screen.queryByText('1972')).not.toBeInTheDocument();
  });

  it('renders include_in_history checkbox unchecked when false', () => {
    render(<SourceCard s={makeSource({ include_in_history: false })} {...baseProps} />);
    expect(screen.getByRole('checkbox', { name: /include in history/i })).not.toBeChecked();
  });

  it('renders include_in_history checkbox checked when true', () => {
    render(<SourceCard s={makeSource({ include_in_history: true })} {...baseProps} />);
    expect(screen.getByRole('checkbox', { name: /include in history/i })).toBeChecked();
  });

  it('calls onToggleInclude with the new value when checkbox changes', () => {
    const onToggleInclude = jest.fn();
    render(<SourceCard s={makeSource({ include_in_history: false })} {...baseProps} onToggleInclude={onToggleInclude} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /include in history/i }));
    expect(onToggleInclude).toHaveBeenCalledWith(true);
  });

  it('calls onEdit when the edit button is clicked', () => {
    const onEdit = jest.fn();
    render(<SourceCard s={makeSource()} {...baseProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByTitle('Edit source'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when the delete button is clicked', () => {
    const onDelete = jest.fn();
    render(<SourceCard s={makeSource()} {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete source'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when the card is clicked', () => {
    const onClick = jest.fn();
    render(<SourceCard s={makeSource()} {...baseProps} onClick={onClick} />);
    fireEvent.click(document.querySelector('.source-card') as Element);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows annotation only when selected', () => {
    const s = makeSource({ annotation: 'Key reference for timber framing.' });
    const { rerender } = render(<SourceCard s={s} {...baseProps} selected={false} />);
    expect(screen.queryByText('Key reference for timber framing.')).not.toBeInTheDocument();
    rerender(<SourceCard s={s} {...baseProps} selected />);
    expect(screen.getByText('Key reference for timber framing.')).toBeInTheDocument();
  });

  it('shows a URL link when url is set', () => {
    render(<SourceCard s={makeSource({ url: 'https://example.com/path' })} {...baseProps} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('clicking citation link calls openExternal, not browser nav', () => {
    const openExternal = jest.spyOn(window.api.shell, 'openExternal');
    render(<SourceCard s={makeSource({ type: 'journal', url: 'https://example.com' })} {...baseProps} />);
    const link = document.querySelector('.source-citation a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    fireEvent.click(link);
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining('example.com'));
  });

  it('applies "selected" class when selected is true', () => {
    render(<SourceCard s={makeSource()} {...baseProps} selected />);
    expect(document.querySelector('.source-card')).toHaveClass('selected');
  });
});
