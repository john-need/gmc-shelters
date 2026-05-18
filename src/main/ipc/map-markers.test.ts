import { ipcMain } from 'electron';
import { registerMapMarkerHandlers } from './map-markers';
import { getMarkerById, getMarkersByShelter, insertMapMarker, updateMapMarker, deleteMapMarker } from '../db/map-markers';
import { getShelterById } from '../db/shelters';
import type { MapMarker, Shelter } from '../../shared/ipc-types';

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn() },
}));
jest.mock('../db/connection', () => ({ getDb: jest.fn().mockReturnValue({
  prepare: jest.fn().mockReturnValue({ run: jest.fn() }),
}) }));
jest.mock('../logger', () => ({ log: { info: jest.fn(), error: jest.fn() } }));
jest.mock('../db/map-markers');
jest.mock('../db/shelters');

function getHandler(channel: string) {
  const calls = (ipcMain.handle as jest.Mock).mock.calls;
  const call = calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`Handler for "${channel}" not registered`);
  return call[1];
}

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 10, name: 'Test', slug: 'test', start_year: 1960, end_year: 1990,
    description: '', longitude: -71, latitude: 44, default_photo_id: null,
    is_gmc: false, architecture: '', built_by: '', notes: '', created: '2020-01-01',
    updated: '2020-01-01', is_extant: false, category: '', show_on_web: false,
    ...overrides,
  };
}

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.1, longitude: -71.5, name: 'A',
    start_year: 1960, end_year: 1990, change_type: 'Original', notes: '',
    slug: 'test', is_extant: false, photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

const nullEvent = {} as Electron.IpcMainInvokeEvent;

beforeEach(() => {
  jest.clearAllMocks();
  registerMapMarkerHandlers();
});

describe('MAP_MARKERS_GET_BY_SHELTER', () => {
  it('returns markers sorted by start_year', async () => {
    const markers = [makeMarker({ id: 1, start_year: 1960 }), makeMarker({ id: 2, start_year: 1975 })];
    (getMarkersByShelter as jest.Mock).mockReturnValue(markers);
    const handler = getHandler('mapMarkers:getByShelter');
    const result = await handler(nullEvent, { shelterId: 10 });
    expect(result).toEqual(markers);
    expect(getMarkersByShelter).toHaveBeenCalledWith(10);
  });

  it('returns empty array when shelter has no markers', async () => {
    (getMarkersByShelter as jest.Mock).mockReturnValue([]);
    const handler = getHandler('mapMarkers:getByShelter');
    const result = await handler(nullEvent, { shelterId: 99 });
    expect(result).toEqual([]);
  });
});

describe('MAP_MARKERS_CREATE', () => {
  const validInput = {
    shelter_id: 10,
    latitude: 44.0,
    longitude: -71.0,
    name: 'New',
    start_year: 1960,
    end_year: 1990,
    change_type: 'Original' as const,
    notes: '',
  };

  beforeEach(() => {
    (getShelterById as jest.Mock).mockReturnValue(makeShelter());
    (getMarkersByShelter as jest.Mock).mockReturnValue([]);
    (insertMapMarker as jest.Mock).mockReturnValue(makeMarker());
  });

  it('rejects when latitude is missing', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, latitude: null })).rejects.toThrow(/latitude/i);
  });

  it('rejects when latitude is out of range', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, latitude: 91 })).rejects.toThrow(/latitude/i);
  });

  it('rejects when longitude is out of range', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, longitude: -181 })).rejects.toThrow(/longitude/i);
  });

  it('rejects when start_year is before shelter start_year', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, start_year: 1950 })).rejects.toThrow(/start_year/i);
  });

  it('rejects when start_year is after shelter end_year', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, start_year: 1995 })).rejects.toThrow(/start_year/i);
  });

  it('rejects when start_year duplicates an existing marker', async () => {
    (getMarkersByShelter as jest.Mock).mockReturnValue([makeMarker({ start_year: 1960, end_year: 1990 })]);
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, validInput)).rejects.toThrow(/duplicate|start_year/i);
  });

  it('rejects when marker would create a gap', async () => {
    (getMarkersByShelter as jest.Mock).mockReturnValue([makeMarker({ start_year: 1960, end_year: 1975 })]);
    const handler = getHandler('mapMarkers:create');
    // Trying to add 1980–1990 leaves gap 1975–1980
    await expect(handler(nullEvent, { ...validInput, start_year: 1980, end_year: 1990 })).rejects.toThrow(/gap|not covered/i);
  });

  it('rejects when marker would create an overlap', async () => {
    (getMarkersByShelter as jest.Mock).mockReturnValue([makeMarker({ start_year: 1960, end_year: 1975 })]);
    const handler = getHandler('mapMarkers:create');
    // 1970–1990 overlaps with existing 1960–1975
    await expect(handler(nullEvent, { ...validInput, start_year: 1970, end_year: 1990 })).rejects.toThrow(/overlap/i);
  });

  it('accepts valid marker with no gap', async () => {
    const handler = getHandler('mapMarkers:create');
    const result = await handler(nullEvent, validInput);
    expect(result).toMatchObject({ id: 1 });
    expect(insertMapMarker).toHaveBeenCalled();
  });

  it('accepts null end_year when shelter is_extant and marker is last', async () => {
    (getShelterById as jest.Mock).mockReturnValue(makeShelter({ is_extant: true, end_year: null }));
    (getMarkersByShelter as jest.Mock).mockReturnValue([]);
    const handler = getHandler('mapMarkers:create');
    const result = await handler(nullEvent, { ...validInput, end_year: null });
    expect(result).toBeDefined();
  });

  it('rejects null end_year when shelter is not extant', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, end_year: null })).rejects.toThrow(/end_year/i);
  });
});

describe('MAP_MARKERS_UPDATE', () => {
  const existing = makeMarker({ id: 3, start_year: 1960, end_year: 1990 });
  const validInput = {
    shelter_id: 10,
    latitude: 44.5,
    longitude: -71.5,
    name: 'Updated',
    start_year: 1960,
    end_year: 1990,
    change_type: 'Relocated' as const,
    notes: '',
  };

  beforeEach(() => {
    (getShelterById as jest.Mock).mockReturnValue(makeShelter());
    (getMarkersByShelter as jest.Mock).mockReturnValue([existing]);
    (updateMapMarker as jest.Mock).mockReturnValue({ ...existing, ...validInput });
  });

  it('rejects coordinate out of range', async () => {
    const handler = getHandler('mapMarkers:update');
    await expect(handler(nullEvent, { id: 3, input: { ...validInput, latitude: 100 } })).rejects.toThrow(/latitude/i);
  });

  it('rejects start_year duplicate (excluding self)', async () => {
    (getMarkersByShelter as jest.Mock).mockReturnValue([
      makeMarker({ id: 3, start_year: 1960, end_year: 1975 }),
      makeMarker({ id: 5, start_year: 1975, end_year: 1990 }),
    ]);
    const handler = getHandler('mapMarkers:update');
    // Trying to set id=3 start_year to 1975 (same as id=5)
    await expect(handler(nullEvent, { id: 3, input: { ...validInput, start_year: 1975 } })).rejects.toThrow(/duplicate|start_year/i);
  });

  it('accepts valid edit', async () => {
    const handler = getHandler('mapMarkers:update');
    const result = await handler(nullEvent, { id: 3, input: validInput });
    expect(result).toMatchObject({ name: 'Updated' });
  });

  it('rejects gap-creating edit', async () => {
    (getMarkersByShelter as jest.Mock).mockReturnValue([
      makeMarker({ id: 3, start_year: 1960, end_year: 1990 }),
    ]);
    const handler = getHandler('mapMarkers:update');
    // Shrink end_year to 1975 — last marker no longer reaches shelter end 1990
    await expect(handler(nullEvent, { id: 3, input: { ...validInput, end_year: 1975 } })).rejects.toThrow(/gap|not covered|ends at/i);
  });
});

describe('MAP_MARKERS_DELETE', () => {
  const existing = makeMarker({ id: 7, shelter_id: 10, start_year: 1960, end_year: 1990 });

  beforeEach(() => {
    (getMarkerById as jest.Mock).mockReturnValue(existing);
    (getShelterById as jest.Mock).mockReturnValue(makeShelter());
    (getMarkersByShelter as jest.Mock).mockReturnValue([existing]);
    (deleteMapMarker as jest.Mock).mockReturnValue(undefined);
  });

  it('deletes marker when no gap would result', async () => {
    // After removing id=7, remaining is empty — shelter with just one marker
    (getMarkersByShelter as jest.Mock).mockReturnValue([existing]);
    const handler = getHandler('mapMarkers:delete');
    // single marker covers full shelter range — no gap when removed
    const result = await handler(nullEvent, { id: 7, opts: {} });
    // The remaining list after filtering is [] — shelter is_extant=false with end_year=1990
    // Coverage on [] won't fail (no markers to validate against)
    // Actually coverage on empty list returns null so no warning → delete proceeds
    expect(deleteMapMarker).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  it('returns gap warning without deleting when gap would result', async () => {
    const markerA = makeMarker({ id: 7, shelter_id: 10, start_year: 1960, end_year: 1975 });
    const markerB = makeMarker({ id: 8, shelter_id: 10, start_year: 1975, end_year: 1990 });
    (getMarkerById as jest.Mock).mockReturnValue(markerA);
    (getMarkersByShelter as jest.Mock).mockReturnValue([markerA, markerB]);
    const handler = getHandler('mapMarkers:delete');
    // Deleting id=7 (1960–1975) leaves only 1975–1990 — gap at 1960–1975
    const result = await handler(nullEvent, { id: 7, opts: {} });
    expect(deleteMapMarker).not.toHaveBeenCalled();
    expect(result).toMatchObject({ gapWarning: true });
  });

  it('deletes with confirmed=true even when gap would result', async () => {
    const markerA = makeMarker({ id: 7, shelter_id: 10, start_year: 1960, end_year: 1975 });
    const markerB = makeMarker({ id: 8, shelter_id: 10, start_year: 1975, end_year: 1990 });
    (getMarkerById as jest.Mock).mockReturnValue(markerA);
    (getMarkersByShelter as jest.Mock).mockReturnValue([markerA, markerB]);
    const handler = getHandler('mapMarkers:delete');
    const result = await handler(nullEvent, { id: 7, opts: { confirmed: true } });
    expect(deleteMapMarker).toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
