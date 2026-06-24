import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MovePhotoDialog from './MovePhotoDialog';
import type { Shelter } from '../../../../shared/ipc-types';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 1, name: 'Test Shelter', start_year: 1960, end_year: null, description: '',
    slug: 'test-shelter', default_photo_id: null, is_gmc: true, architecture: '',
    built_by: '', notes: '', created: '2020-01-01', updated: '2020-01-01',
    is_extant: true, category: '',
    ...overrides,
  } as Shelter;
}

describe('MovePhotoDialog', () => {
  const shelters = [
    makeShelter({ id: 1, name: 'Current Shelter' }),
    makeShelter({ id: 2, name: 'Shelter B' }),
    makeShelter({ id: 3, name: 'Shelter C' }),
  ];

  it('lists every shelter except the current one', () => {
    render(<MovePhotoDialog shelters={shelters} currentShelterId={1} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.queryByText('Current Shelter')).not.toBeInTheDocument();
    expect(screen.getByText('Shelter B')).toBeInTheDocument();
    expect(screen.getByText('Shelter C')).toBeInTheDocument();
  });

  it('disables Confirm move until a target shelter is picked', () => {
    render(<MovePhotoDialog shelters={shelters} currentShelterId={1} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('button', { name: /confirm move/i })).toBeDisabled();
  });

  it('enables Confirm move once a target shelter is selected, and calls onConfirm with its id', () => {
    const onConfirm = jest.fn();
    render(<MovePhotoDialog shelters={shelters} currentShelterId={1} onConfirm={onConfirm} onCancel={jest.fn()} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: '3' } });
    const confirmButton = screen.getByRole('button', { name: /confirm move/i });
    expect(confirmButton).not.toBeDisabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith(3);
  });

  it('calls onCancel when Cancel is clicked, with no call to onConfirm', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();
    render(<MovePhotoDialog shelters={shelters} currentShelterId={1} onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
