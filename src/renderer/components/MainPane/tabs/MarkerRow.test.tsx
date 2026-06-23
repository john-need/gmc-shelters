import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkerRow from './MarkerRow';
import type { MapMarker } from '../../../../shared/ipc-types';

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.1234, longitude: -71.5678,
    name: 'Original Site', start_year: 1960, end_year: 1975,
    change_type: 'Original', notes: '', is_extant: false,
    photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

const baseProps = {
  idx: 0, selected: false,
  onRowClick: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn(),
};

describe('MarkerRow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders marker name', () => {
    render(<MarkerRow {...baseProps} m={makeMarker()} />);
    expect(screen.getByTestId('marker-name')).toHaveTextContent('Original Site');
  });

  it('renders "(unnamed)" when name is empty', () => {
    render(<MarkerRow {...baseProps} m={makeMarker({ name: '' })} />);
    expect(screen.getByTestId('marker-name')).toHaveTextContent('(unnamed)');
  });

  it('renders year range with end year', () => {
    render(<MarkerRow {...baseProps} m={makeMarker({ start_year: 1960, end_year: 1975 })} />);
    expect(screen.getByText(/1960–1975/)).toBeInTheDocument();
  });

  it('renders "present" for null end_year', () => {
    render(<MarkerRow {...baseProps} m={makeMarker({ end_year: null })} />);
    expect(screen.getByText(/present/)).toBeInTheDocument();
  });

  it('renders change type', () => {
    render(<MarkerRow {...baseProps} m={makeMarker({ change_type: 'Moved' })} />);
    expect(screen.getByText('Moved')).toBeInTheDocument();
  });

  it('renders coordinates', () => {
    render(<MarkerRow {...baseProps} m={makeMarker()} />);
    expect(screen.getByText(/44\.1234/)).toBeInTheDocument();
    expect(screen.getByText(/71\.5678/)).toBeInTheDocument();
  });

  it('renders row number from idx+1', () => {
    render(<MarkerRow {...baseProps} idx={2} m={makeMarker()} />);
    expect(document.querySelector('.mm-pin-num')).toHaveTextContent('3');
  });

  it('applies selected class when selected=true', () => {
    render(<MarkerRow {...baseProps} selected m={makeMarker()} />);
    expect(screen.getByTestId('marker-row')).toHaveClass('selected');
  });

  it('calls onRowClick with id, lat, lng on row click', () => {
    const onRowClick = jest.fn();
    render(<MarkerRow {...baseProps} onRowClick={onRowClick} m={makeMarker({ id: 5, latitude: 44.1, longitude: -71.6 })} />);
    fireEvent.click(screen.getByTestId('marker-row'));
    expect(onRowClick).toHaveBeenCalledWith(5, 44.1, -71.6);
  });

  it('calls onEdit with marker on Edit click (no row click)', () => {
    const onEdit = jest.fn();
    const onRowClick = jest.fn();
    const m = makeMarker();
    render(<MarkerRow {...baseProps} m={m} onEdit={onEdit} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(onEdit).toHaveBeenCalledWith(m);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('calls onDelete with id on Delete click (no row click)', () => {
    const onDelete = jest.fn();
    const onRowClick = jest.fn();
    render(<MarkerRow {...baseProps} m={makeMarker({ id: 7 })} onDelete={onDelete} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalledWith(7);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('adds gone class on pin number when not extant', () => {
    render(<MarkerRow {...baseProps} m={makeMarker({ is_extant: false })} />);
    expect(document.querySelector('.mm-pin-num')).toHaveClass('gone');
  });
});
