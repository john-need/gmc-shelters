import { fireEvent, render, screen } from '@testing-library/react';
import GenerateHistoryModal from './GenerateHistoryModal';
import type { GenerateHistoryEvent, Source } from '../../../../shared/ipc-types';

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

function baseProps(overrides: Partial<React.ComponentProps<typeof GenerateHistoryModal>> = {}) {
  return {
    shelterName: 'Aeolus View Camp',
    citations: [] as Source[],
    events: [] as GenerateHistoryEvent[],
    pendingPermission: null,
    onRespondPermission: jest.fn(),
    status: 'running' as const,
    narrative: null,
    errorMessage: null,
    onAccept: jest.fn(),
    onReject: jest.fn(),
    ...overrides,
  };
}

describe('GenerateHistoryModal', () => {
  describe('done phase (review)', () => {
    it('renders the assembled preview document via the shared markdown renderer', () => {
      render(<GenerateHistoryModal {...baseProps({
        status: 'done', narrative: 'A history of the camp.', citations: [makeSource()],
      })}
      />);

      expect(screen.getByRole('heading', { level: 1, name: 'Aeolus View Camp' })).toBeInTheDocument();
      expect(screen.getByText('A history of the camp.')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: 'Sources' })).toBeInTheDocument();
      expect(screen.getByText(/Doe, Jane/)).toBeInTheDocument();
    });

    it('calls onAccept exactly once when Accept is clicked', () => {
      const onAccept = jest.fn();
      render(<GenerateHistoryModal {...baseProps({ status: 'done', narrative: 'A history.', onAccept })} />);

      fireEvent.click(screen.getByRole('button', { name: /accept/i }));
      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('calls onReject exactly once when Reject is clicked', () => {
      const onReject = jest.fn();
      render(<GenerateHistoryModal {...baseProps({ status: 'done', narrative: 'A history.', onReject })} />);

      fireEvent.click(screen.getByRole('button', { name: /reject/i }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });

    it('does not call either callback before a click', () => {
      const onAccept = jest.fn();
      const onReject = jest.fn();
      render(<GenerateHistoryModal {...baseProps({ status: 'done', narrative: 'A history.', onAccept, onReject })} />);

      expect(onAccept).not.toHaveBeenCalled();
      expect(onReject).not.toHaveBeenCalled();
    });

    it('calls onReject when the overlay backdrop itself is clicked, not onAccept', () => {
      const onAccept = jest.fn();
      const onReject = jest.fn();
      const { container } = render(<GenerateHistoryModal {...baseProps({ status: 'done', narrative: 'A history.', onAccept, onReject })} />);

      const overlay = container.querySelector('.modal-bg') as HTMLElement;
      fireEvent.click(overlay);

      expect(onReject).toHaveBeenCalledTimes(1);
      expect(onAccept).not.toHaveBeenCalled();
    });

    it('does not call onReject when clicking inside the modal content', () => {
      const onReject = jest.fn();
      render(<GenerateHistoryModal {...baseProps({ status: 'done', narrative: 'A history.', onReject })} />);

      fireEvent.click(screen.getByText('A history.'));
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  describe('running phase (live agent transcript)', () => {
    it('renders live narrative text as it streams in', () => {
      render(<GenerateHistoryModal {...baseProps({
        events: [{ type: 'text', text: 'Drafting the opening paragraph.' }],
      })}
      />);

      expect(screen.getByText('Drafting the opening paragraph.')).toBeInTheDocument();
    });

    it('renders tool_call and tool_result events in the activity log', () => {
      render(<GenerateHistoryModal {...baseProps({
        events: [
          { type: 'tool_call', tool: 'web_search', input: { query: 'Aeolus View Camp history' } },
          { type: 'tool_result', tool: 'web_search', ok: true, summary: '3 result(s)' },
        ],
      })}
      />);

      expect(screen.getAllByText(/Web search/).length).toBe(2);
      expect(screen.getByText(/3 result\(s\)/)).toBeInTheDocument();
    });

    it('shows an Allow/Deny prompt when a permission is pending, and calls onRespondPermission with the requestId', () => {
      const onRespondPermission = jest.fn();
      render(<GenerateHistoryModal {...baseProps({
        pendingPermission: { requestId: 'tool_1', tool: 'search_collections', input: { query: 'Aeolus' } },
        onRespondPermission,
      })}
      />);

      expect(screen.getByText(/Search collections/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /allow/i }));
      expect(onRespondPermission).toHaveBeenCalledWith('tool_1', true);
    });

    it('calls onRespondPermission with false when Deny is clicked', () => {
      const onRespondPermission = jest.fn();
      render(<GenerateHistoryModal {...baseProps({
        pendingPermission: { requestId: 'tool_1', tool: 'download_document', input: { resource: 'collections/x/y.pdf' } },
        onRespondPermission,
      })}
      />);

      fireEvent.click(screen.getByRole('button', { name: /deny/i }));
      expect(onRespondPermission).toHaveBeenCalledWith('tool_1', false);
    });

    it('calls onReject (cancel) when the Cancel button is clicked while running', () => {
      const onReject = jest.fn();
      render(<GenerateHistoryModal {...baseProps({ onReject })} />);

      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });

  describe('error phase', () => {
    it('shows the error message and dismisses via onReject', () => {
      const onReject = jest.fn();
      render(<GenerateHistoryModal {...baseProps({ status: 'error', errorMessage: 'Generate History failed — try again.', onReject })} />);

      expect(screen.getByRole('alert')).toHaveTextContent('Generate History failed');
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });
});
