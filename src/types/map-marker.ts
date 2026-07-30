/** Raw row shape of the `map_markers` table (`SELECT * FROM map_markers`). */
export interface MapMarker {
  id: number;
  shelterId: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  endYear: number | null;
  change_type: string;
  notes: string;
  isExtant: boolean;
  photoId: number | null;
  created: string;
  updated: string;
}
