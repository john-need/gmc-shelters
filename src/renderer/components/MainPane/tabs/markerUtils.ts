import type { MapMarker, Shelter } from '../../../../shared/ipc-types';

export interface FormState {
  name: string;
  latitude: string;
  longitude: string;
  start_year: string;
  changeTypeBase: string;
  notes: string;
}

export function emptyForm(): FormState {
  return { name: '', latitude: '', longitude: '', start_year: '', changeTypeBase: 'Original', notes: '' };
}

export function markerToForm(m: MapMarker): FormState {
  return {
    name: m.name,
    latitude: String(m.latitude),
    longitude: String(m.longitude),
    start_year: String(m.start_year),
    changeTypeBase: m.change_type,
    notes: m.notes,
  };
}

export function computePreviewEndYear(
  markers: MapMarker[],
  startYear: number,
  shelter: Shelter,
): number | null {
  const next = markers.find((m) => m.start_year > startYear);
  if (next) return next.start_year - 1;
  return shelter.is_extant ? null : shelter.end_year;
}
