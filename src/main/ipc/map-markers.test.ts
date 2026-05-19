import { ipcMain } from 'electron';
import { registerMapMarkerHandlers } from './map-markers';
import { getMarkerById, getMarkersByShelter, insertMapMarker, updateMapMarker, deleteMapMarker, recomputeEndYears } from '../db/map-markers';
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
    description: '', default_photo_id: null,
    is_gmc: false, architecture: '', built_by: '', notes: '', created: '2020-01-01',
    updated: '2020-01-01', is_extant: false, category: '', show_on_web: false,
    ...overrides,
  };
}

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.1, longitude: -71.5, name: 'A',
    start_year: 1960, end_year: 1990, change_type: 'Original', notes: '',
    is_extant: false, photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

const nullEvent = {} as Electron.IpcMainInvokeEvent;

beforeEach(() => {
  jest.clearAllMocks();
  registerMapMarkerHandlers();
});

describe('MAP_MARKERS_GET_BY_SHELTER', () => {
  it('returns markers for a shelter', async () => {
    const markers = [makeMarker({ id: 1 }), makeMarker({ id: 2 })];
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
    name: 'Spring',
    start_year: 1965,
    change_type: 'Original' as const,
    notes: '',
  };

  const shelter = makeShelter({ start_year: 1960, end_year: 1990, is_extant: false });
  const resultMarkers = [makeMarker()];

  beforeEach(() => {
    (getShelterById as jest.Mock).mockReturnValue(shelter);
    (insertMapMarker as jest.Mock).mockReturnValue(undefined);
    (recomputeEndYears as jest.Mock).mockReturnValue(undefined);
    (getMarkersByShelter as jest.Mock).mockReturnValue(resultMarkers);
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

  it('rejects when shelter not found', async () => {
    (getShelterById as jest.Mock).mockReturnValue(null);
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, validInput)).rejects.toThrow(/shelter/i);
  });

  it('rejects when start_year is before shelter start_year', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, start_year: 1950 })).rejects.toThrow(/start_year/i);
  });

  it('rejects when start_year is after shelter end_year for non-extant shelter', async () => {
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, { ...validInput, start_year: 1995 })).rejects.toThrow(/start_year/i);
  });

  it('accepts marker with start_year within shelter range', async () => {
    const handler = getHandler('mapMarkers:create');
    const result = await handler(nullEvent, validInput);
    expect(Array.isArray(result)).toBe(true);
    expect(insertMapMarker).toHaveBeenCalled();
    expect(recomputeEndYears).toHaveBeenCalled();
  });

  it('rejects duplicate start_year', async () => {
    (getMarkersByShelter as jest.Mock)
      .mockReturnValueOnce([makeMarker({ start_year: 1965 })])
      .mockReturnValue([makeMarker({ start_year: 1965 })]);
    const handler = getHandler('mapMarkers:create');
    await expect(handler(nullEvent, validInput)).rejects.toThrow(/marker already starts/i);
  });
});

describe('MAP_MARKERS_UPDATE', () => {
  const validInput = {
    latitude: 44.5,
    longitude: -71.5,
    name: 'Updated Spring',
    change_type: 'Moved' as const,
    notes: '',
  };

  beforeEach(() => {
    (updateMapMarker as jest.Mock).mockReturnValue(makeMarker({ name: 'Updated Spring' }));
  });

  it('rejects coordinate out of range', async () => {
    const handler = getHandler('mapMarkers:update');
    await expect(handler(nullEvent, { id: 3, input: { ...validInput, latitude: 100 } })).rejects.toThrow(/latitude/i);
  });

  it('accepts valid edit and returns updated marker', async () => {
    const handler = getHandler('mapMarkers:update');
    const result = await handler(nullEvent, { id: 3, input: validInput });
    expect(result).toMatchObject({ name: 'Updated Spring' });
  });
});

describe('MAP_MARKERS_DELETE', () => {
  const existing = makeMarker({ id: 7, shelter_id: 10 });
  const shelter = makeShelter();

  beforeEach(() => {
    (getMarkerById as jest.Mock).mockReturnValue(existing);
    (getShelterById as jest.Mock).mockReturnValue(shelter);
    (deleteMapMarker as jest.Mock).mockReturnValue(undefined);
    (recomputeEndYears as jest.Mock).mockReturnValue(undefined);
    (getMarkersByShelter as jest.Mock).mockReturnValue([]);
  });

  it('deletes the marker and returns remaining markers array', async () => {
    const handler = getHandler('mapMarkers:delete');
    const result = await handler(nullEvent, { id: 7 });
    expect(deleteMapMarker).toHaveBeenCalledWith(expect.anything(), 7);
    expect(recomputeEndYears).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws when marker not found', async () => {
    (getMarkerById as jest.Mock).mockReturnValue(null);
    const handler = getHandler('mapMarkers:delete');
    await expect(handler(nullEvent, { id: 999 })).rejects.toThrow(/not found/i);
  });
});
