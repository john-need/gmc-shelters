import type { MapMarker } from '../types/map-marker';

/** Raw `map_markers` row shape, as returned by `SELECT * FROM map_markers`. */
export interface MapMarkerRow {
  id: number;
  shelter_id: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  end_year: number | null;
  change_type: string;
  notes: string;
  is_extant: number;
  photo_id: number | null;
  created: string;
  updated: string;
}

export function makeMapMarker(row: MapMarkerRow): MapMarker {
  return {
    id: row.id,
    shelterId: row.shelter_id,
    latitude: row.latitude,
    longitude: row.longitude,
    name: row.name,
    startYear: row.start_year,
    endYear: row.end_year,
    changeType: row.change_type,
    notes: row.notes,
    isExtant: Boolean(row.is_extant),
    photoId: row.photo_id,
    created: row.created,
    updated: row.updated,
  };
}
