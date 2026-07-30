/** Raw row shape of the `map_markers` table (`SELECT * FROM map_markers`). */
export interface MapMarker {
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
