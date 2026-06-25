import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { getDb } from '../db/connection';
import {
  getMarkerById,
  getMarkersByShelter,
  insertMapMarker,
  updateMapMarker,
  deleteMapMarker,
} from '../db/map-markers';
import { getShelterById } from '../db/shelters';
import type { MapMarkerCreateInput, MapMarkerUpdateInput } from '../../shared/ipc-types';

function validateCoordinates(lat: number | null | undefined, lon: number | null | undefined): void {
  if (lat == null || typeof lat !== 'number') throw new Error('latitude is required');
  if (lat < -90 || lat > 90) throw new Error('latitude must be between -90 and 90');
  if (lon == null || typeof lon !== 'number') throw new Error('longitude is required');
  if (lon < -180 || lon > 180) throw new Error('longitude must be between -180 and 180');
}

function validateYearRange(startYear: number, endYear: number | null): void {
  if (endYear != null && endYear < startYear) {
    throw new Error('end_year must be ≥ start_year');
  }
}

export function registerMapMarkerHandlers(): void {
  ipcMain.handle(
    CHANNELS.MAP_MARKERS_GET_BY_SHELTER,
    (_e, { shelterId }: { shelterId: number }) => getMarkersByShelter(shelterId),
  );

  ipcMain.handle(
    CHANNELS.MAP_MARKERS_CREATE,
    async (_e, input: MapMarkerCreateInput) => {
      validateCoordinates(input.latitude, input.longitude);
      validateYearRange(input.start_year, input.end_year);

      const shelter = getShelterById(input.shelter_id);
      if (!shelter) throw new Error(`Shelter ${input.shelter_id} not found`);

      if (input.start_year < shelter.start_year) {
        throw new Error(`start_year must be ≥ shelter start_year (${shelter.start_year})`);
      }
      if (!shelter.is_extant && shelter.end_year != null && input.start_year > shelter.end_year) {
        throw new Error(`start_year must be ≤ shelter end_year (${shelter.end_year})`);
      }

      const existing = getMarkersByShelter(input.shelter_id);
      if (existing.some((m) => m.start_year === input.start_year)) {
        throw new Error(`A marker already starts at ${input.start_year} for this shelter`);
      }

      const db = getDb();
      insertMapMarker(db, input, shelter);
      return getMarkersByShelter(input.shelter_id);
    },
  );

  ipcMain.handle(
    CHANNELS.MAP_MARKERS_UPDATE,
    async (_e, { id, input }: { id: number; input: MapMarkerUpdateInput }) => {
      validateCoordinates(input.latitude, input.longitude);
      validateYearRange(input.start_year, input.end_year);

      const marker = getMarkerById(id);
      if (!marker) throw new Error(`Map marker ${id} not found`);
      const shelter = getShelterById(marker.shelter_id);
      if (!shelter) throw new Error(`Shelter not found`);

      if (input.start_year < shelter.start_year) {
        throw new Error(`start_year must be ≥ shelter start_year (${shelter.start_year})`);
      }
      if (!shelter.is_extant && shelter.end_year != null && input.start_year > shelter.end_year) {
        throw new Error(`start_year must be ≤ shelter end_year (${shelter.end_year})`);
      }

      const existing = getMarkersByShelter(marker.shelter_id);
      if (existing.some((m) => m.id !== id && m.start_year === input.start_year)) {
        throw new Error(`A marker already starts at ${input.start_year} for this shelter`);
      }

      const db = getDb();
      return updateMapMarker(db, id, input);
    },
  );

  ipcMain.handle(
    CHANNELS.MAP_MARKERS_DELETE,
    async (_e, { id }: { id: number }) => {
      const marker = getMarkerById(id);
      if (!marker) throw new Error(`Map marker ${id} not found`);

      const db = getDb();
      deleteMapMarker(db, id);
      return getMarkersByShelter(marker.shelter_id);
    },
  );
}
