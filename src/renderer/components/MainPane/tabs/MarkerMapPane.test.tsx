import React, { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkerMapPane from './MarkerMapPane';

const baseProps = {
  mode: 'idle' as const,
  hasLatLng: false,
  showAll: false,
  hoverCoords: null,
  mapContainerRef: createRef<HTMLDivElement>(),
  onToggleShowAll: jest.fn(),
};

describe('MarkerMapPane', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "Click the map" banner in add mode with no location', () => {
    render(<MarkerMapPane {...baseProps} mode="add" hasLatLng={false} />);
    expect(screen.getByText(/click the map to place this marker/i)).toBeInTheDocument();
  });

  it('no placement banner in add mode when location set', () => {
    render(<MarkerMapPane {...baseProps} mode="add" hasLatLng />);
    expect(screen.queryByText(/click the map/i)).not.toBeInTheDocument();
  });

  it('shows "Click map or drag pin" banner in edit mode', () => {
    render(<MarkerMapPane {...baseProps} mode="edit" />);
    expect(screen.getByText(/click map or drag pin/i)).toBeInTheDocument();
  });

  it('no banner in idle mode', () => {
    render(<MarkerMapPane {...baseProps} mode="idle" />);
    expect(screen.queryByText(/click/i)).not.toBeInTheDocument();
  });

  it('shows hover coords when provided', () => {
    render(<MarkerMapPane {...baseProps} hoverCoords={{ lat: 44.1234, lng: -71.5678 }} />);
    expect(screen.getByText(/44\.1234/)).toBeInTheDocument();
    expect(screen.getByText(/71\.5678/)).toBeInTheDocument();
  });

  it('hides hover coords when null', () => {
    render(<MarkerMapPane {...baseProps} hoverCoords={null} />);
    expect(screen.queryByText(/°N/)).not.toBeInTheDocument();
  });

  it('toggle button has "active" class when showAll=true', () => {
    render(<MarkerMapPane {...baseProps} showAll />);
    expect(screen.getByRole('button', { name: /all shelters/i })).toHaveClass('active');
  });

  it('toggle button lacks "active" class when showAll=false', () => {
    render(<MarkerMapPane {...baseProps} showAll={false} />);
    expect(screen.getByRole('button', { name: /all shelters/i })).not.toHaveClass('active');
  });

  it('calls onToggleShowAll when toggle button clicked', () => {
    const onToggleShowAll = jest.fn();
    render(<MarkerMapPane {...baseProps} onToggleShowAll={onToggleShowAll} />);
    fireEvent.click(screen.getByRole('button', { name: /all shelters/i }));
    expect(onToggleShowAll).toHaveBeenCalledTimes(1);
  });

  it('renders the map container div', () => {
    render(<MarkerMapPane {...baseProps} />);
    expect(document.querySelector('.mm-map')).toBeInTheDocument();
  });
});
