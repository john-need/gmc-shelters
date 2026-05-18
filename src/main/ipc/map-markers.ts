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
import type { MapMarker, MapMarkerInput, DeleteMarkerOptions, DeleteMarkerResult, Shelter } from '../../shared/ipc-types';

function validateCoordinates(lat: number | null | undefined, lon: number | null | undefined): void {
  if (lat == null || typeof lat !== 'number') throw new Error('latitude is required');
  if (lat < -90 || lat > 90) throw new Error('latitude must be between -90 and 90');
  if (lon == null || typeof lon !== 'number') throw new Error('longitude is required');
  if (lon < -180 || lon > 180) throw new Error('longitude must be between -180 and 180');
}

function validateStartYear(startYear: number, shelter: Shelter, othersStartYears: number[], excludeId?: number): void {
  if (startYear < shelter.start_year) {
    throw new Error(`start_year must be ≥ shelter start_year (${shelter.start_year})`);
  }
  if (!shelter.is_extant && shelter.end_year != null && startYear > shelter.end_year) {
    throw new Error(`start_year must be ≤ shelter end_year (${shelter.end_year})`);
  }
  if (othersStartYears.includes(startYear)) {
    throw new Error(`duplicate start_year: another marker already uses ${startYear} for this shelter`);
  }
}

function validateEndYear(endYear: number | null, shelter: Shelter, isLastMarker: boolean): void {
  if (endYear == null) {
    if (!shelter.is_extant) throw new Error('end_year is required when shelter is not extant');
    if (!isLastMarker) throw new Error('end_year may only be null for the last marker of an extant shelter');
  }
}

export function validateCoverage(markers: MapMarker[], shelter: Shelter): string | null {
  if (markers.length === 0) return null;
  const sorted = [...markers].sort((a, b) => a.start_year - b.start_year);

  if (sorted[0].start_year !== shelter.start_year) {
    return `Year ${shelter.start_year} is not covered — first marker starts at ${sorted[0].start_year}`;
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr.end_year == null) {
      return `Marker "${curr.name}" has no end_year but is not the last marker`;
    }
    if (curr.end_year < next.start_year) {
      return `Gap: years ${curr.end_year}–${next.start_year} are not covered`;
    }
    if (curr.end_year > next.start_year) {
      return `Overlap: markers "${curr.name}" (–${curr.end_year}) and "${next.name}" (${next.start_year}–) overlap`;
    }
  }

  const last = sorted[sorted.length - 1];
  if (shelter.is_extant) return null;
  if (last.end_year !== shelter.end_year) {
    return `Last marker ends at ${last.end_year} but shelter ends at ${shelter.end_year}`;
  }
  return null;
}

export function registerMapMarkerHandlers(): void {
  ipcMain.handle(
    CHANNELS.MAP_MARKERS_GET_BY_SHELTER,
    (_e, { shelterId }: { shelterId: number }) => getMarkersByShelter(shelterId),
  );

  ipcMain.handle(
    CHANNELS.MAP_MARKERS_CREATE,
    async (_e, input: MapMarkerInput) => {
      validateCoordinates(input.latitude, input.longitude);

      const shelter = getShelterById(input.shelter_id);
      if (!shelter) throw new Error(`Shelter ${input.shelter_id} not found`);

      const existing = getMarkersByShelter(input.shelter_id);
      const existingStartYears = existing.map((m) => m.start_year);

      validateStartYear(input.start_year, shelter, existingStartYears);

      const sortedAfter = [...existing].sort((a, b) => a.start_year - b.start_year);
      const isLast = sortedAfter.length === 0 || input.start_year > sortedAfter[sortedAfter.length - 1].start_year;
      validateEndYear(input.end_year, shelter, isLast);

      const proposed: MapMarker = {
        id: -1,
        shelter_id: input.shelter_id,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        start_year: input.start_year,
        end_year: input.end_year,
        change_type: input.change_type,
        notes: input.notes,
        slug: shelter.slug,
        is_extant: shelter.is_extant,
        photo_id: shelter.default_photo_id,
        created: '',
        updated: '',
      };

      const coverageError = validateCoverage([...existing, proposed], shelter);
      if (coverageError) throw new Error(coverageError);

      const db = getDb();
      return insertMapMarker(db, input, shelter);
    },
  );

  ipcMain.handle(
    CHANNELS.MAP_MARKERS_UPDATE,
    async (_e, { id, input }: { id: number; input: MapMarkerInput }) => {
      validateCoordinates(input.latitude, input.longitude);

      const shelter = getShelterById(input.shelter_id);
      if (!shelter) throw new Error(`Shelter ${input.shelter_id} not found`);

      const existing = getMarkersByShelter(input.shelter_id);
      const others = existing.filter((m) => m.id !== id);
      const existingStartYears = others.map((m) => m.start_year);

      validateStartYear(input.start_year, shelter, existingStartYears, id);

      const sortedOthers = [...others].sort((a, b) => a.start_year - b.start_year);
      const isLast = sortedOthers.length === 0 || input.start_year > sortedOthers[sortedOthers.length - 1].start_year;
      validateEndYear(input.end_year, shelter, isLast);

      const proposed: MapMarker = {
        id,
        shelter_id: input.shelter_id,
        latitude: input.latitude,
        longitude: input.longitude,
        name: input.name,
        start_year: input.start_year,
        end_year: input.end_year,
        change_type: input.change_type,
        notes: input.notes,
        slug: shelter.slug,
        is_extant: shelter.is_extant,
        photo_id: shelter.default_photo_id,
        created: '',
        updated: '',
      };

      const coverageError = validateCoverage([...others, proposed], shelter);
      if (coverageError) throw new Error(coverageError);

      const db = getDb();
      return updateMapMarker(db, id, input);
    },
  );

  ipcMain.handle(
    CHANNELS.MAP_MARKERS_DELETE,
    async (_e, { id, opts }: { id: number; opts: DeleteMarkerOptions }): Promise<undefined | DeleteMarkerResult> => {
      const marker = getMarkerById(id);
      if (!marker) throw new Error(`Map marker ${id} not found`);

      const shelter = getShelterById(marker.shelter_id);
      if (!shelter) throw new Error(`Shelter not found`);

      const remaining = getMarkersByShelter(marker.shelter_id).filter((m) => m.id !== id);

      if (!opts?.confirmed) {
        const coverageError = validateCoverage(remaining, shelter);
        if (coverageError) {
          return { gapWarning: true, uncoveredRange: coverageError };
        }
      }

      const db = getDb();
      deleteMapMarker(db, id);
      return undefined;
    },
  );
}
