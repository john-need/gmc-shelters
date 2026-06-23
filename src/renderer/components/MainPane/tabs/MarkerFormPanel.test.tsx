import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import MarkerFormPanel from './MarkerFormPanel';
import { emptyForm } from './markerUtils';

const baseProps = {
  mode: 'add' as const,
  editingMarker: undefined,
  form: emptyForm(),
  setForm: jest.fn(),
  errorMsg: null,
  endYearDisplay: '—',
  canSave: false,
  saving: false,
  shelterStartYear: 1950,
  shelterEndYear: 2000,
  onSave: jest.fn(),
};

describe('MarkerFormPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows "New marker" title in add mode', () => {
    render(<MarkerFormPanel {...baseProps} />);
    expect(screen.getByText('New marker')).toBeInTheDocument();
  });

  it('shows marker name as title in edit mode', () => {
    render(<MarkerFormPanel {...baseProps} mode="edit" editingMarker={{ id: 1, shelter_id: 10, name: 'Old Site', latitude: 44, longitude: -71, start_year: 1960, end_year: 1975, change_type: 'Original', notes: '', is_extant: false, photo_id: null, created: '', updated: '' }} />);
    expect(screen.getByText('Old Site')).toBeInTheDocument();
  });

  it('shows "Edit marker" when editing marker has no name', () => {
    render(<MarkerFormPanel {...baseProps} mode="edit" editingMarker={{ id: 1, shelter_id: 10, name: '', latitude: 44, longitude: -71, start_year: 1960, end_year: 1975, change_type: 'Original', notes: '', is_extant: false, photo_id: null, created: '', updated: '' }} />);
    expect(screen.getByText('Edit marker')).toBeInTheDocument();
  });

  it('shows error message when errorMsg is set', () => {
    render(<MarkerFormPanel {...baseProps} errorMsg="Bad coordinates" />);
    expect(screen.getByText('Bad coordinates')).toBeInTheDocument();
  });

  it('Save button disabled when canSave=false', () => {
    render(<MarkerFormPanel {...baseProps} canSave={false} />);
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('Save button enabled when canSave=true', () => {
    render(<MarkerFormPanel {...baseProps} canSave />);
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled();
  });

  it('calls onSave when Save clicked', () => {
    const onSave = jest.fn();
    render(<MarkerFormPanel {...baseProps} canSave onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows "Saving…" when saving=true', () => {
    render(<MarkerFormPanel {...baseProps} canSave saving />);
    expect(screen.getByRole('button', { name: /saving/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
  });

  it('start_year input editable in add mode', () => {
    render(<MarkerFormPanel {...baseProps} mode="add" />);
    const input = screen.getByRole('spinbutton', { name: /start year/i });
    expect(input).not.toBeDisabled();
  });

  it('start_year input disabled in edit mode', () => {
    render(<MarkerFormPanel {...baseProps} mode="edit" />);
    expect(screen.getByTitle(/start year cannot be changed/i)).toBeDisabled();
  });

  it('shows lat/lng hint when both set in add mode', () => {
    render(<MarkerFormPanel {...baseProps} form={{ ...emptyForm(), latitude: '44.0', longitude: '-71.5' }} />);
    expect(screen.getByText('Location set')).toBeInTheDocument();
  });

  it('shows "Click map" hint when lat/lng empty in add mode', () => {
    render(<MarkerFormPanel {...baseProps} />);
    expect(screen.getByText(/click map to set location/i)).toBeInTheDocument();
  });

  it('lat input calls setForm on change', () => {
    const setForm = jest.fn();
    render(<MarkerFormPanel {...baseProps} setForm={setForm} />);
    fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '44.5' } });
    expect(setForm).toHaveBeenCalled();
  });
});
