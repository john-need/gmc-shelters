import type { MapMarker, Shelter } from '../../../../shared/ipc-types';

export interface FormState {
  name: string;
  latitude: string;
  longitude: string;
  start_year: string;
  end_year: string;
  changeTypeBase: string;
  notes: string;
}

export function emptyForm(): FormState {
  return { name: '', latitude: '', longitude: '', start_year: '', end_year: '', changeTypeBase: 'Original', notes: '' };
}

export function markerToForm(m: MapMarker): FormState {
  return {
    name: m.name,
    latitude: String(m.latitude),
    longitude: String(m.longitude),
    start_year: String(m.start_year),
    end_year: m.end_year != null ? String(m.end_year) : '',
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

interface YearRange { id?: number; start_year: number; end_year: number | null }

/**
 * Checks whether saving `pending` (in place of `excludeId`, if editing) would leave a
 * year within the shelter's lifespan with no marker covering it. Returns a human-readable
 * description of the first gap found, or null if the timeline stays contiguous.
 */
export function findYearGap(
  markers: YearRange[],
  pending: YearRange,
  excludeId: number | null,
  shelter: Pick<Shelter, 'start_year' | 'end_year' | 'is_extant'>,
): string | null {
  const list = [...markers.filter((m) => m.id !== excludeId), pending].sort((a, b) => a.start_year - b.start_year);

  const first = list[0];
  if (first.start_year > shelter.start_year) {
    return `No marker covers ${shelter.start_year}–${first.start_year - 1}.`;
  }

  for (let i = 0; i < list.length - 1; i++) {
    const cur = list[i];
    const next = list[i + 1];
    if (cur.end_year != null && cur.end_year + 1 < next.start_year) {
      return `No marker covers ${cur.end_year + 1}–${next.start_year - 1}.`;
    }
  }

  const last = list[list.length - 1];
  if (!shelter.is_extant && shelter.end_year != null && last.end_year != null && last.end_year < shelter.end_year) {
    return `No marker covers ${last.end_year + 1}–${shelter.end_year}.`;
  }

  return null;
}
