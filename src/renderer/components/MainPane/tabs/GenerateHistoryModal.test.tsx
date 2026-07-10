import { fireEvent, render, screen } from '@testing-library/react';
import GenerateHistoryModal from './GenerateHistoryModal';
import type { Source } from '../../../../shared/ipc-types';

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: true,
    type: 'book',
    author: 'Doe, Jane',
    title: 'Shelter Notes',
    container_title: '', container_author: '',
    editor: '',
    edition: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    place: '',
    year: null,
    date: '',
    url: '',
    access_date: '',
    archive: '',
    archive_location: '',
    annotation: '',
    notes: '',
    quote: '',
    created: '2020-01-01',
    updated: '2020-01-02',
    ...overrides,
  };
}

describe('GenerateHistoryModal', () => {
  it('renders the assembled preview document via the shared markdown renderer', () => {
    render(
      <GenerateHistoryModal
        shelterName="Aeolus View Camp"
        narrative="A history of the camp."
        citations={[makeSource()]}
        onAccept={jest.fn()}
        onReject={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Aeolus View Camp' })).toBeInTheDocument();
    expect(screen.getByText('A history of the camp.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Sources' })).toBeInTheDocument();
    expect(screen.getByText(/Doe, Jane/)).toBeInTheDocument();
  });

  it('calls onAccept exactly once when Accept is clicked', () => {
    const onAccept = jest.fn();
    render(
      <GenerateHistoryModal
        shelterName="Aeolus View Camp"
        narrative="A history."
        citations={[]}
        onAccept={onAccept}
        onReject={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('calls onReject exactly once when Reject is clicked', () => {
    const onReject = jest.fn();
    render(
      <GenerateHistoryModal
        shelterName="Aeolus View Camp"
        narrative="A history."
        citations={[]}
        onAccept={jest.fn()}
        onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('does not call either callback before a click', () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    render(
      <GenerateHistoryModal
        shelterName="Aeolus View Camp"
        narrative="A history."
        citations={[]}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    expect(onAccept).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
  });

  it('calls onReject when the overlay backdrop itself is clicked, not onAccept', () => {
    const onAccept = jest.fn();
    const onReject = jest.fn();
    const { container } = render(
      <GenerateHistoryModal
        shelterName="Aeolus View Camp"
        narrative="A history."
        citations={[]}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    const overlay = container.querySelector('.modal-bg') as HTMLElement;
    fireEvent.click(overlay);

    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onAccept).not.toHaveBeenCalled();
  });

  it('does not call onReject when clicking inside the modal content', () => {
    const onReject = jest.fn();
    render(
      <GenerateHistoryModal
        shelterName="Aeolus View Camp"
        narrative="A history."
        citations={[]}
        onAccept={jest.fn()}
        onReject={onReject}
      />,
    );

    fireEvent.click(screen.getByText('A history.'));
    expect(onReject).not.toHaveBeenCalled();
  });
});
