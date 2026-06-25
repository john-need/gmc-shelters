jest.mock('electron');
jest.mock('../db/shelters');
jest.mock('../db/map-markers');
jest.mock('../fs/photos');
jest.mock('../fs/history');
jest.mock('../logger', () => ({ log: { info: jest.fn(), error: jest.fn() } }));

import { ipcMain } from 'electron';
import * as dbShelters from '../db/shelters';
import * as dbMapMarkers from '../db/map-markers';
import * as fsPhotos from '../fs/photos';
import * as fsHistory from '../fs/history';
import { registerShelterHandlers } from './shelters';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

beforeEach(() => {
  jest.clearAllMocks();
  registerShelterHandlers();
});

describe('ipc/shelters', () => {
  it('registers all shelter channels', () => {
    const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
    expect(registered).toContain(CHANNELS.SHELTERS_GET_ALL);
    expect(registered).toContain(CHANNELS.SHELTERS_GET_BY_ID);
    expect(registered).toContain(CHANNELS.SHELTERS_CREATE);
    expect(registered).toContain(CHANNELS.SHELTERS_UPDATE);
    expect(registered).toContain(CHANNELS.SHELTERS_DELETE);
    expect(registered).toContain(CHANNELS.SHELTERS_SET_HISTORY);
  });

  it('SHELTERS_GET_ALL calls getAllShelters', () => {
    const shelters = [{ id: 1, name: 'Test' }];
    (dbShelters.getAllShelters as jest.Mock).mockReturnValue(shelters);
    const handler = getHandler(CHANNELS.SHELTERS_GET_ALL);
    const result = handler(null);
    expect(dbShelters.getAllShelters).toHaveBeenCalled();
    expect(result).toBe(shelters);
  });

  it('SHELTERS_GET_BY_ID calls getShelterById with id', () => {
    const shelter = { id: 5, name: 'Test' };
    (dbShelters.getShelterById as jest.Mock).mockReturnValue(shelter);
    const handler = getHandler(CHANNELS.SHELTERS_GET_BY_ID);
    const result = handler(null, { id: 5 });
    expect(dbShelters.getShelterById).toHaveBeenCalledWith(5);
    expect(result).toBe(shelter);
  });

  it('SHELTERS_CREATE creates shelter, ensures dir, and writes initial history', async () => {
    const shelter = { id: 1, name: 'New Shelter', slug: 'new-shelter', start_year: 1970, history: 'new-shelter/new-shelter.md' };
    (dbShelters.createShelter as jest.Mock).mockReturnValue(shelter);
    (fsPhotos.ensureShelterDir as jest.Mock).mockResolvedValue(undefined);
    (fsHistory.writeHistory as jest.Mock).mockResolvedValue(undefined);

    const handler = getHandler(CHANNELS.SHELTERS_CREATE);
    const result = await handler(null, { name: 'New Shelter', start_year: 1970, category: 'lean-to', is_gmc: false, sheltersRoot: '/shelters' });

    expect(dbShelters.createShelter).toHaveBeenCalled();
    expect(fsPhotos.ensureShelterDir).toHaveBeenCalledWith('new-shelter', '/shelters');
    expect(fsHistory.writeHistory).toHaveBeenCalledWith(
      'new-shelter/new-shelter.md',
      expect.stringContaining('New Shelter'),
      '/shelters',
    );
    expect(result).toBe(shelter);
  });

  describe('SHELTERS_UPDATE', () => {
    it('calls updateShelter and syncs markers when the slug is unchanged', async () => {
      const before = { id: 1, slug: 'updated' };
      const shelter = { id: 1, name: 'Updated', slug: 'updated', is_extant: true, default_photo_id: 5 };
      (dbShelters.getShelterById as jest.Mock).mockReturnValue(before);
      (dbShelters.updateShelter as jest.Mock).mockReturnValue(shelter);
      (dbMapMarkers.syncMarkersFromShelter as jest.Mock).mockReturnValue(undefined);

      const handler = getHandler(CHANNELS.SHELTERS_UPDATE);
      const result = await handler(null, { shelter, sheltersRoot: '/shelters' });

      expect(dbShelters.updateShelter).toHaveBeenCalledWith(shelter);
      expect(fsPhotos.renameShelterDir).not.toHaveBeenCalled();
      expect(dbMapMarkers.syncMarkersFromShelter).toHaveBeenCalledWith(shelter);
      expect(result).toBe(shelter);
    });

    it('renames the shelter dir on disk when the slug changed', async () => {
      const before = { id: 1, slug: 'old-slug' };
      const shelter = { id: 1, name: 'Updated', slug: 'new-slug' };
      (dbShelters.getShelterById as jest.Mock).mockReturnValue(before);
      (dbShelters.updateShelter as jest.Mock).mockReturnValue(shelter);
      (fsPhotos.renameShelterDir as jest.Mock).mockResolvedValue(undefined);

      const handler = getHandler(CHANNELS.SHELTERS_UPDATE);
      const result = await handler(null, { shelter, sheltersRoot: '/shelters' });

      expect(fsPhotos.renameShelterDir).toHaveBeenCalledWith('old-slug', 'new-slug', '/shelters');
      expect(dbMapMarkers.syncMarkersFromShelter).toHaveBeenCalledWith(shelter);
      expect(result).toBe(shelter);
    });

    it('rolls back the DB slug change and rethrows if the disk rename fails', async () => {
      const before = { id: 1, slug: 'old-slug' };
      const shelter = { id: 1, name: 'Updated', slug: 'new-slug' };
      (dbShelters.getShelterById as jest.Mock).mockReturnValue(before);
      (dbShelters.updateShelter as jest.Mock).mockReturnValue(shelter);
      (fsPhotos.renameShelterDir as jest.Mock).mockRejectedValue(new Error('disk full'));

      const handler = getHandler(CHANNELS.SHELTERS_UPDATE);
      await expect(handler(null, { shelter, sheltersRoot: '/shelters' })).rejects.toThrow('disk full');

      expect(dbShelters.updateShelter).toHaveBeenCalledWith({ ...shelter, slug: 'old-slug' });
    });
  });

  it('SHELTERS_DELETE calls deleteShelter with id', () => {
    const handler = getHandler(CHANNELS.SHELTERS_DELETE);
    handler(null, { id: 3 });
    expect(dbShelters.deleteShelter).toHaveBeenCalledWith(3);
  });

  it('SHELTERS_SET_HISTORY calls setShelterHistory', () => {
    (dbShelters.setShelterHistory as jest.Mock).mockReturnValue(undefined);
    const handler = getHandler(CHANNELS.SHELTERS_SET_HISTORY);
    handler(null, { id: 7, history: 'other-slug/other-slug.md' });
    expect(dbShelters.setShelterHistory).toHaveBeenCalledWith(7, 'other-slug/other-slug.md');
  });
});
