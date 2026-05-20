jest.mock('electron');
jest.mock('../db/photos');
jest.mock('../db/shelters');
jest.mock('../fs/photos');
jest.mock('../db/connection');

import { ipcMain } from 'electron';
import * as dbPhotos from '../db/photos';
import * as dbShelters from '../db/shelters';
import * as fsPhotos from '../fs/photos';
import { getDb } from '../db/connection';
import { registerPhotoHandlers } from './photos';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

beforeEach(() => {
  jest.clearAllMocks();
  registerPhotoHandlers();
});

describe('ipc/photos', () => {
  it('registers all photo channels', () => {
    const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
    expect(registered).toContain(CHANNELS.PHOTOS_GET_BY_SHELTER);
    expect(registered).toContain(CHANNELS.PHOTOS_UPDATE);
    expect(registered).toContain(CHANNELS.PHOTOS_DELETE);
    expect(registered).toContain(CHANNELS.PHOTOS_SET_DEFAULT);
    expect(registered).toContain(CHANNELS.PHOTOS_UPLOAD);
    expect(registered).toContain(CHANNELS.PHOTOS_READ_METADATA);
  });

  it('PHOTOS_GET_BY_SHELTER calls getPhotosByShelter', () => {
    const photos = [{ id: 1, file_name: 'a.jpg' }];
    (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue(photos);
    const handler = getHandler(CHANNELS.PHOTOS_GET_BY_SHELTER);
    const result = handler(null, { shelterId: 5 });
    expect(dbPhotos.getPhotosByShelter).toHaveBeenCalledWith(5);
    expect(result).toBe(photos);
  });

  it('PHOTOS_UPDATE calls updatePhoto, transformPhoto and writePhotoXmp', async () => {
    const photo = { id: 1, title: 'Updated', shelter_id: 2, file_name: 'test.jpg' };
    const input = { ...photo, sheltersRoot: '/base/shelters', rotation: 90 };
    (dbPhotos.updatePhoto as jest.Mock).mockReturnValue(photo);
    (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 2, slug: 'my-shelter' });
    (fsPhotos.writePhotoXmp as jest.Mock).mockResolvedValue(undefined);
    (fsPhotos.transformPhoto as jest.Mock).mockResolvedValue(undefined);
    (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/shelters/test.jpg');

    const handler = getHandler(CHANNELS.PHOTOS_UPDATE);
    const result = await handler(null, input);

    expect(dbPhotos.updatePhoto).toHaveBeenCalledWith(input);
    expect(fsPhotos.transformPhoto).toHaveBeenCalledWith('/base/shelters/test.jpg', {
      rotation: 90,
      flipped: undefined,
      crop: undefined,
    });
    expect(fsPhotos.writePhotoXmp).toHaveBeenCalledWith(photo, '/base/shelters', 'my-shelter');
    expect(result).toBe(photo);
  });

  it('PHOTOS_DELETE fetches photo and deletes file and record', async () => {
    const mockPrepare = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({ shelter_id: 2, file_name: 'shot.jpg' }),
    });
    (getDb as jest.Mock).mockReturnValue({ prepare: mockPrepare });
    (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 2, slug: 'my-shelter' });
    (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);

    const handler = getHandler(CHANNELS.PHOTOS_DELETE);
    await handler(null, { id: 10, sheltersRoot: '/base/shelters' });

    expect(fsPhotos.deletePhotoFile).toHaveBeenCalledWith('my-shelter', 'shot.jpg', '/base/shelters');
    expect(dbPhotos.deletePhoto).toHaveBeenCalledWith(10);
  });

  it('PHOTOS_SET_DEFAULT calls setDefaultPhoto', () => {
    const handler = getHandler(CHANNELS.PHOTOS_SET_DEFAULT);
    handler(null, { shelterId: 3, photoId: 7 });
    expect(dbPhotos.setDefaultPhoto).toHaveBeenCalledWith(3, 7);
  });

  it('PHOTOS_UPLOAD copies file and inserts photo record', async () => {
    (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
    (fsPhotos.copyPhotoToShelter as jest.Mock).mockResolvedValue('shot-123.jpg');
    const photo = { id: 1, file_name: 'test-shelter/photos/shot-123.jpg', shelter_id: 1 };
    (dbPhotos.insertPhoto as jest.Mock).mockReturnValue(photo);

    const handler = getHandler(CHANNELS.PHOTOS_UPLOAD);
    const result = await handler(null, { shelterId: 1, sourcePath: '/tmp/shot.jpg', sheltersRoot: '/base/shelters', title: 'My Photo' });

    expect(fsPhotos.copyPhotoToShelter).toHaveBeenCalledWith('/tmp/shot.jpg', 'test-shelter', '/base/shelters');
    expect(dbPhotos.insertPhoto).toHaveBeenCalledWith(1, 'test-shelter/photos/shot-123.jpg', 'My Photo');
    expect(result).toBe(photo);
  });

  it('PHOTOS_UPLOAD throws when shelter not found', async () => {
    (dbShelters.getShelterById as jest.Mock).mockReturnValue(null);
    const handler = getHandler(CHANNELS.PHOTOS_UPLOAD);
    await expect(handler(null, { shelterId: 99, sourcePath: '/tmp/x.jpg' })).rejects.toThrow('Shelter 99 not found');
  });

  it('PHOTOS_READ_METADATA calls readPhotoXmp', async () => {
    const metadata = { title: 'From File' };
    (fsPhotos.readPhotoXmp as jest.Mock).mockResolvedValue(metadata);

    const handler = getHandler(CHANNELS.PHOTOS_READ_METADATA);
    const result = await handler(null, { slug: 'my-shelter', fileName: 'shot.jpg', sheltersRoot: '/base' });

    expect(fsPhotos.readPhotoXmp).toHaveBeenCalledWith('my-shelter', 'shot.jpg', '/base');
    expect(result).toBe(metadata);
  });
});
