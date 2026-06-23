import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import IncludeInPostCheckbox from './IncludeInPostCheckbox';

describe('IncludeInPostCheckbox', () => {
  it('renders checked when prop is true', () => {
    render(<IncludeInPostCheckbox photoId={1} checked onToggle={jest.fn()} />);
    expect(screen.getByRole('checkbox', { name: /include in post/i })).toBeChecked();
  });

  it('renders unchecked when prop is false', () => {
    render(<IncludeInPostCheckbox photoId={1} checked={false} onToggle={jest.fn()} />);
    expect(screen.getByRole('checkbox', { name: /include in post/i })).not.toBeChecked();
  });

  it('calls onToggle with the photo id and new value when clicked', () => {
    const onToggle = jest.fn();
    render(<IncludeInPostCheckbox photoId={42} checked={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith(42, true);
  });
});
