import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('displays the message', () => {
    render(<ConfirmDialog message="Are you sure?" confirmLabel="Delete" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('has role=dialog with label Confirm', () => {
    render(<ConfirmDialog message="msg" confirmLabel="OK" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: /confirm/i })).toBeInTheDocument();
  });

  it('renders the confirmLabel on the confirm button', () => {
    render(<ConfirmDialog message="msg" confirmLabel="Wipe it" onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: /wipe it/i })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = jest.fn();
    render(<ConfirmDialog message="msg" confirmLabel="Delete" onConfirm={onConfirm} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    const onCancel = jest.fn();
    render(<ConfirmDialog message="msg" confirmLabel="OK" onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the overlay backdrop is clicked', () => {
    const onCancel = jest.fn();
    const { container } = render(<ConfirmDialog message="msg" confirmLabel="OK" onConfirm={jest.fn()} onCancel={onCancel} />);
    fireEvent.click(container.firstChild as Element);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
