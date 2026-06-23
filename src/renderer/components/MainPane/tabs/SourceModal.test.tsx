import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SourceModal from './SourceModal';
import type { Source, SourceRef } from '../../../../shared/ipc-types';

function makeSource(overrides: Partial<Source> = {}): Partial<Source> & { shelter_id: number } {
  return {
    shelter_id: 7, type: 'book', author: '', title: '', container_title: '',
    editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '',
    place: '', year: null, date: '', url: '', access_date: '', archive: '',
    archive_location: '', annotation: '', notes: '', quote: '',
    include_in_history: false,
    ...overrides,
  };
}

function ref(o: Partial<SourceRef> = {}): SourceRef {
  return {
    id: 0, type: 'book', author: '', title: '', container_title: '', editor: '',
    edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
    year: null, date: '', url: '', access_date: '', archive: '', archive_location: '',
    ...o,
  };
}

beforeEach(() => {
  (window as { api: unknown }).api = {
    sources: { getAll: jest.fn().mockResolvedValue([]) },
  };
});
afterEach(() => { (window as { api: unknown }).api = undefined; });

describe('SourceModal', () => {
  it('shows "Add a new source" title when creating', () => {
    render(<SourceModal source={makeSource()} creating onCancel={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByText(/add a new source/i)).toBeInTheDocument();
  });

  it('shows "Edit source" title when not creating', () => {
    render(<SourceModal source={makeSource()} creating={false} onCancel={jest.fn()} onSave={jest.fn()} />);
    expect(screen.getByText(/edit source/i)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = jest.fn();
    render(<SourceModal source={makeSource()} creating onCancel={onCancel} onSave={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with the current form state on submit', () => {
    const onSave = jest.fn();
    render(<SourceModal source={makeSource({ author: 'Doe, Jane' })} creating onCancel={jest.fn()} onSave={onSave} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^add source$/i })[0]);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ author: 'Doe, Jane' }));
  });

  it('updates title field when typed in', () => {
    render(<SourceModal source={makeSource()} creating onCancel={jest.fn()} onSave={jest.fn()} />);
    const input = screen.getByPlaceholderText('A Hearth on Birch Glen') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Trail Notes' } });
    expect(input.value).toBe('Trail Notes');
  });

  it('shows container_title field when type is changed to journal', () => {
    render(<SourceModal source={makeSource()} creating onCancel={jest.fn()} onSave={jest.fn()} />);
    expect(screen.queryByPlaceholderText('Long Trail News')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'journal' } });
    expect(screen.getByText(/journal \/ magazine/i)).toBeInTheDocument();
  });

  it('shows the browse button and opens picker when clicked', async () => {
    (window as { api: unknown }).api = {
      sources: { getAll: jest.fn().mockResolvedValue([ref({ id: 1, type: 'book', title: 'Trail Notes' })]) },
    };
    render(<SourceModal source={makeSource()} creating onCancel={jest.fn()} onSave={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /browse existing sources/i }));
    await waitFor(() => expect(screen.getByText(/reuse an existing source/i)).toBeInTheDocument());
  });

  it('populates fields when a picker row is selected', async () => {
    (window as { api: unknown }).api = {
      sources: { getAll: jest.fn().mockResolvedValue([ref({ id: 1, type: 'book', title: 'Alpha', author: 'Zed, A' })]) },
    };
    render(<SourceModal source={makeSource()} creating onCancel={jest.fn()} onSave={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /browse existing sources/i }));
    await waitFor(() => screen.getByTestId('picker-row-1'));
    fireEvent.click(screen.getByTestId('picker-row-1'));
    expect(screen.queryByTestId('picker-row-1')).not.toBeInTheDocument();
    expect((screen.getByPlaceholderText('A Hearth on Birch Glen') as HTMLInputElement).value).toBe('Alpha');
    expect((screen.getByPlaceholderText('Calloway, Henry') as HTMLInputElement).value).toBe('Zed, A');
  });
});
