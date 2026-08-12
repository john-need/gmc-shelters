import React from 'react';
import { render, screen } from '@testing-library/react';
import ExportModal from './ExportModal';

describe('ExportModal', () => {
  it('shows a Cancel button (not Dismiss) while exporting', () => {
    render(<ExportModal phase="exporting" progress={null} result={null} error={null} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('shows a progress bar and shelter count once building progress arrives', () => {
    render(
      <ExportModal
        phase="exporting"
        progress={{ stage: 'building', current: 2, total: 5, shelterName: 'Birch Glen Lodge' }}
        result={null}
        error={null}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('2 / 5 shelters')).toBeInTheDocument();
    expect(screen.getByText(/Birch Glen Lodge/)).toBeInTheDocument();
  });

  it('shows the done summary and a Dismiss button (not Cancel) when complete', () => {
    render(
      <ExportModal
        phase="done"
        progress={null}
        result={{ cancelled: false, savedTo: '/tmp/export.zip', shelterCount: 5, photoCount: 12, skippedPhotos: 1 }}
        error={null}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('/tmp/export.zip')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('shows a cancelled message and a Dismiss button when cancelled', () => {
    render(<ExportModal phase="cancelled" progress={null} result={null} error={null} onCancel={jest.fn()} />);
    expect(screen.getByText(/nothing was saved/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('shows the error message and a Dismiss button on failure', () => {
    render(<ExportModal phase="error" progress={null} result={null} error="disk full" onCancel={jest.fn()} />);
    expect(screen.getByText('disk full')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls onCancel when the button is clicked, regardless of phase', () => {
    const onCancel = jest.fn();
    render(<ExportModal phase="done" progress={null} result={{ cancelled: false, savedTo: '/x.zip', shelterCount: 1, photoCount: 1, skippedPhotos: 0 }} error={null} onCancel={onCancel} />);
    screen.getByRole('button', { name: 'Dismiss' }).click();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
