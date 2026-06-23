import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkerDetailPanel from './MarkerDetailPanel';
import type { MapMarker } from '../../../../shared/ipc-types';

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.123456, longitude: -71.567890,
    name: 'Original Site', start_year: 1960, end_year: 1975,
    change_type: 'Original', notes: '', is_extant: false,
    photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

const base = { selectedIndex: 0, onEdit: jest.fn(), onDelete: jest.fn() };

describe('MarkerDetailPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows placeholder when no marker selected', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={undefined} />);
    expect(screen.getByText(/select a marker/i)).toBeInTheDocument();
  });

  it('shows marker name', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker()} />);
    expect(screen.getByText('Original Site')).toBeInTheDocument();
  });

  it('shows "(unnamed)" when name is empty', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker({ name: '' })} />);
    expect(screen.getByText('(unnamed)')).toBeInTheDocument();
  });

  it('shows PRESENT for null end_year in header id line', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker({ end_year: null })} />);
    expect(screen.getByText(/PRESENT/)).toBeInTheDocument();
  });

  it('shows "present" for null end_year in fields', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker({ end_year: null })} />);
    expect(screen.getByText('present')).toBeInTheDocument();
  });

  it('shows lat/lng formatted to 6dp', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker()} />);
    expect(screen.getByText('44.123456')).toBeInTheDocument();
    expect(screen.getByText('-71.567890')).toBeInTheDocument();
  });

  it('shows change type', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker()} />);
    expect(screen.getByText('Original')).toBeInTheDocument();
  });

  it('shows notes when present', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker({ notes: 'Near the creek.' })} />);
    expect(screen.getByText('Near the creek.')).toBeInTheDocument();
  });

  it('hides notes field when empty', () => {
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker({ notes: '' })} />);
    expect(screen.queryByText('Notes')).not.toBeInTheDocument();
  });

  it('calls onEdit with the marker when Edit clicked', () => {
    const onEdit = jest.fn();
    const m = makeMarker();
    render(<MarkerDetailPanel {...base} selectedMarker={m} onEdit={onEdit} />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(onEdit).toHaveBeenCalledWith(m);
  });

  it('calls onDelete with the marker id when Delete clicked', () => {
    const onDelete = jest.fn();
    render(<MarkerDetailPanel {...base} selectedMarker={makeMarker({ id: 42 })} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalledWith(42);
  });
});
