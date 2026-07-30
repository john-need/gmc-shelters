/** Raw row shape of the `shelters` table (`SELECT * FROM shelters`). */
import { Photo } from "./photo";
import { Source } from "./source";
import {MapMarker} from "./map-marker";
import {Builder} from "./builder";
import {Architecture} from "./architecture";
import {ShelterCategory} from "./shelter-category";
export interface Shelter {
  id: number;
  name: string;
  startYear: number;
  endYear: number | null;
  description: string | null;
  slug: string;
  defaultPhotoId: number | null;
  isGMC: boolean;
  architecture: Architecture | null;
  builder: Builder | null;
  notes: string | null;
  created: string;
  updated: string;
  category: ShelterCategory | null;
  showOnWeb: Boolean;
  history: string | null;
  photos: Photo[];
  sources: Source[];
  mapMarkers: MapMarker[];
}
