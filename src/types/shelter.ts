/** Raw row shape of the `shelters` table (`SELECT * FROM shelters`). */
import { Photo } from "./photo";
import { Source } from "./source";
import {MapMarker} from "./map-marker";
import {Builder} from "./builder";
import {Architecture} from "@shared/ipc-types";
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
  architecture: Architecture;
  builder: Builder;
  notes: string | null;
  created: string;
  updated: string;
  category: ShelterCategory;
  showOnWeb: Boolean;
  history: string | null;
  photos: Photo[];
  sources: Source[];
  mapMarkers: MapMarker[];
}
