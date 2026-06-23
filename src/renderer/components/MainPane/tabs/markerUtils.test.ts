import { computePreviewEndYear, emptyForm, markerToForm } from './markerUtils';
import type { MapMarker, Shelter } from '../../../../shared/ipc-types';

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.0, longitude: -71.5,
    name: 'Site A', start_year: 1960, end_year: 1975,
    change_type: 'Original', notes: '', is_extant: false,
    photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 10, name: 'Test', slug: 'test', start_year: 1950, end_year: 2000,
    description: '', default_photo_id: null, is_gmc: false, is_extant: false,
    architecture: '', built_by: '', notes: '', created: '2020-01-01', updated: '2020-01-01',
    category: '', show_on_web: false, history: null,
    ...overrides,
  };
}

describe('computePreviewEndYear', () => {
  it('returns next.start_year - 1 when a later marker exists', () => {
    const markers = [makeMarker({ start_year: 1960 }), makeMarker({ id: 2, start_year: 1975 })];
    expect(computePreviewEndYear(markers, 1960, makeShelter())).toBe(1974);
  });

  it('returns null when no next marker and shelter is extant', () => {
    expect(computePreviewEndYear([makeMarker({ start_year: 1960 })], 1960, makeShelter({ is_extant: true }))).toBeNull();
  });

  it('returns shelter.end_year when no next marker and shelter is not extant', () => {
    expect(computePreviewEndYear([makeMarker({ start_year: 1960 })], 1960, makeShelter({ is_extant: false, end_year: 2000 }))).toBe(2000);
  });
});

describe('emptyForm', () => {
  it('returns blank fields with Original change type', () => {
    const f = emptyForm();
    expect(f.name).toBe('');
    expect(f.latitude).toBe('');
    expect(f.longitude).toBe('');
    expect(f.start_year).toBe('');
    expect(f.changeTypeBase).toBe('Original');
    expect(f.notes).toBe('');
  });
});

describe('markerToForm', () => {
  it('converts marker fields to string form state', () => {
    const m = makeMarker({ name: 'A', latitude: 44.1, longitude: -71.6, start_year: 1960, change_type: 'Moved', notes: 'note' });
    const f = markerToForm(m);
    expect(f.name).toBe('A');
    expect(f.latitude).toBe('44.1');
    expect(f.longitude).toBe('-71.6');
    expect(f.start_year).toBe('1960');
    expect(f.changeTypeBase).toBe('Moved');
    expect(f.notes).toBe('note');
  });
});
