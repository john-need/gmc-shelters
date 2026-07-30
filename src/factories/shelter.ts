import type { Shelter } from '../types/shelter';
import type { Architecture } from '../types/architecture';
import type { Builder } from '../types/builder';
import type { ShelterCategory } from '../types/shelter-category';
import type { Photo } from '../types/photo';
import type { Source } from '../types/source';
import type { MapMarker } from '../types/map-marker';

/** Raw `shelters` row shape, as returned by `SELECT * FROM shelters` — no relations. */
export interface ShelterRow {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  description: string | null;
  slug: string;
  default_photo_id: number | null;
  is_gmc: number;
  notes: string | null;
  created: string;
  updated: string;
  show_on_web: number;
  history: string | null;
}

/** Relations aren't shelters-table columns — the caller fetches and normalizes them separately. */
export interface ShelterRelations {
  architecture: Architecture | null;
  builder: Builder | null;
  category: ShelterCategory | null;
  photos: Photo[];
  sources: Source[];
  mapMarkers: MapMarker[];
}

export function makeShelter(row: ShelterRow, relations: ShelterRelations): Shelter {
  return {
    id: row.id,
    name: row.name,
    startYear: row.start_year,
    endYear: row.end_year,
    description: row.description,
    slug: row.slug,
    defaultPhotoId: row.default_photo_id,
    isGMC: Boolean(row.is_gmc),
    notes: row.notes,
    created: row.created,
    updated: row.updated,
    showOnWeb: Boolean(row.show_on_web),
    history: row.history,
    architecture: relations.architecture,
    builder: relations.builder,
    category: relations.category,
    photos: relations.photos,
    sources: relations.sources,
    mapMarkers: relations.mapMarkers,
  };
}
