jest.mock('electron');
jest.mock('../db/photos');
jest.mock('../db/shelters');
jest.mock('../fs/photos');
jest.mock('../fs/thumbnails');
jest.mock('../db/connection');
jest.mock('fs/promises');

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fsp from 'fs/promises';
import * as dbPhotos from '../db/photos';
import * as dbShelters from '../db/shelters';
import * as fsPhotos from '../fs/photos';
import * as fsThumbnails from '../fs/thumbnails';
import { getDb } from '../db/connection';
import { registerPhotoHandlers } from './photos';
import { CHANNELS } from '@shared/ipc-types';
import type { ReconcileApplyInput, ReconcileScanResult, ReconcileApplyResult } from '@shared/ipc-types';

function getHandler<T = unknown>(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => T;
}

beforeEach(() => {
  jest.clearAllMocks();
  (fsThumbnails.scanThumbnails as jest.Mock).mockReturnValue({ missing: [], orphaned: [] });
  (fsThumbnails.applyThumbnailScan as jest.Mock).mockResolvedValue({ generated: 0, purged: 0 });
  registerPhotoHandlers();
});

describe('ipc/photos', () => {
  it('registers all photo channels', () => {
    const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
    expect(registered).toContain(CHANNELS.PHOTOS_GET_BY_SHELTER);
    expect(registered).toContain(CHANNELS.PHOTOS_UPDATE);
    expect(registered).toContain(CHANNELS.PHOTOS_DELETE);
    expect(registered).toContain(CHANNELS.PHOTOS_SET_DEFAULT);
    expect(registered).toContain(CHANNELS.PHOTOS_REORDER);
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

  it('PHOTOS_DELETE purges the deleted photo\'s cached thumbnails', async () => {
    const mockPrepare = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({ shelter_id: 2, file_name: 'shot.jpg' }),
    });
    (getDb as jest.Mock).mockReturnValue({ prepare: mockPrepare });
    (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 2, slug: 'my-shelter' });
    (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);
    (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/shelters/my-shelter/photos/shot.jpg');

    const handler = getHandler(CHANNELS.PHOTOS_DELETE);
    await handler(null, { id: 10, sheltersRoot: '/base/shelters' });

    expect(fsPhotos.photoFilePath).toHaveBeenCalledWith('my-shelter', 'shot.jpg', '/base/shelters');
    expect(fsThumbnails.purgeThumbnailsForSource).toHaveBeenCalledWith('/base/shelters/my-shelter/photos/shot.jpg');
  });

  it('PHOTOS_DELETE does not throw if thumbnail purge fails', async () => {
    const mockPrepare = jest.fn().mockReturnValue({
      get: jest.fn().mockReturnValue({ shelter_id: 2, file_name: 'shot.jpg' }),
    });
    (getDb as jest.Mock).mockReturnValue({ prepare: mockPrepare });
    (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 2, slug: 'my-shelter' });
    (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);
    (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/shelters/my-shelter/photos/shot.jpg');
    (fsThumbnails.purgeThumbnailsForSource as jest.Mock).mockImplementation(() => { throw new Error('boom'); });

    const handler = getHandler(CHANNELS.PHOTOS_DELETE);
    await expect(handler(null, { id: 10, sheltersRoot: '/base/shelters' })).resolves.toBeUndefined();
    expect(dbPhotos.deletePhoto).toHaveBeenCalledWith(10);
  });

  describe('PHOTOS_MOVE', () => {
    function mockPhotoLookup(row: { shelter_id: number; file_name: string } | undefined) {
      const mockPrepare = jest.fn().mockReturnValue({ get: jest.fn().mockReturnValue(row) });
      (getDb as jest.Mock).mockReturnValue({ prepare: mockPrepare });
    }

    it('copies the file, runs the db move, deletes the old file, and returns the updated photo', async () => {
      mockPhotoLookup({ shelter_id: 2, file_name: 'source-shelter/photos/shot.jpg' });
      (dbShelters.getShelterById as jest.Mock).mockImplementation((id: number) =>
        id === 2 ? { id: 2, slug: 'source-shelter' } : { id: 3, slug: 'target-shelter' });
      (fsPhotos.movePhotoFile as jest.Mock).mockResolvedValue('target-shelter/photos/shot.jpg');
      (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/shelters/source-shelter/photos/shot.jpg');
      (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);
      const movedPhoto = { id: 10, shelter_id: 3, file_name: 'target-shelter/photos/shot.jpg' };
      (dbPhotos.movePhotoToShelter as jest.Mock).mockReturnValue(movedPhoto);

      const handler = getHandler(CHANNELS.PHOTOS_MOVE);
      const result = await handler(null, { photoId: 10, targetShelterId: 3, sheltersRoot: '/base/shelters' });

      expect(fsPhotos.movePhotoFile).toHaveBeenCalledWith('source-shelter', 'source-shelter/photos/shot.jpg', 'target-shelter', '/base/shelters');
      expect(dbPhotos.movePhotoToShelter).toHaveBeenCalledWith(10, 3, 'target-shelter/photos/shot.jpg');
      expect(fsPhotos.deletePhotoFile).toHaveBeenCalledWith('source-shelter', 'source-shelter/photos/shot.jpg', '/base/shelters');
      expect(result).toBe(movedPhoto);
    });

    it('purges stale thumbnails for the old path when the filename changed', async () => {
      mockPhotoLookup({ shelter_id: 2, file_name: 'source-shelter/photos/shot.jpg' });
      (dbShelters.getShelterById as jest.Mock).mockImplementation((id: number) =>
        id === 2 ? { id: 2, slug: 'source-shelter' } : { id: 3, slug: 'target-shelter' });
      (fsPhotos.movePhotoFile as jest.Mock).mockResolvedValue('target-shelter/photos/shot-123.jpg');
      (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/shelters/source-shelter/photos/shot.jpg');
      (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);
      (dbPhotos.movePhotoToShelter as jest.Mock).mockReturnValue({ id: 10, shelter_id: 3, file_name: 'target-shelter/photos/shot-123.jpg' });

      const handler = getHandler(CHANNELS.PHOTOS_MOVE);
      await handler(null, { photoId: 10, targetShelterId: 3, sheltersRoot: '/base/shelters' });

      expect(fsThumbnails.purgeThumbnailsForSource).toHaveBeenCalledWith('/base/shelters/source-shelter/photos/shot.jpg');
    });

    it('does not purge thumbnails when the filename is unchanged', async () => {
      mockPhotoLookup({ shelter_id: 2, file_name: 'source-shelter/photos/shot.jpg' });
      (dbShelters.getShelterById as jest.Mock).mockImplementation((id: number) =>
        id === 2 ? { id: 2, slug: 'source-shelter' } : { id: 3, slug: 'target-shelter' });
      (fsPhotos.movePhotoFile as jest.Mock).mockResolvedValue('target-shelter/photos/shot.jpg');
      (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);
      (dbPhotos.movePhotoToShelter as jest.Mock).mockReturnValue({ id: 10, shelter_id: 3, file_name: 'target-shelter/photos/shot.jpg' });

      const handler = getHandler(CHANNELS.PHOTOS_MOVE);
      await handler(null, { photoId: 10, targetShelterId: 3, sheltersRoot: '/base/shelters' });

      expect(fsThumbnails.purgeThumbnailsForSource).not.toHaveBeenCalled();
    });

    it('on db failure, deletes the copied file at the target and rejects without touching the source file', async () => {
      mockPhotoLookup({ shelter_id: 2, file_name: 'source-shelter/photos/shot.jpg' });
      (dbShelters.getShelterById as jest.Mock).mockImplementation((id: number) =>
        id === 2 ? { id: 2, slug: 'source-shelter' } : { id: 3, slug: 'target-shelter' });
      (fsPhotos.movePhotoFile as jest.Mock).mockResolvedValue('target-shelter/photos/shot.jpg');
      (fsPhotos.deletePhotoFile as jest.Mock).mockResolvedValue(undefined);
      (dbPhotos.movePhotoToShelter as jest.Mock).mockImplementation(() => { throw new Error('db boom'); });

      const handler = getHandler(CHANNELS.PHOTOS_MOVE);
      await expect(handler(null, { photoId: 10, targetShelterId: 3, sheltersRoot: '/base/shelters' })).rejects.toThrow('db boom');

      expect(fsPhotos.deletePhotoFile).toHaveBeenCalledWith('target-shelter', 'target-shelter/photos/shot.jpg', '/base/shelters');
      expect(fsPhotos.deletePhotoFile).not.toHaveBeenCalledWith('source-shelter', expect.anything(), expect.anything());
    });

    it('throws when the photo is not found', async () => {
      mockPhotoLookup(undefined);
      const handler = getHandler(CHANNELS.PHOTOS_MOVE);
      await expect(handler(null, { photoId: 999, targetShelterId: 3, sheltersRoot: '/base/shelters' })).rejects.toThrow();
    });
  });

  it('PHOTOS_SET_DEFAULT calls setDefaultPhoto', () => {
    const handler = getHandler(CHANNELS.PHOTOS_SET_DEFAULT);
    handler(null, { shelterId: 3, photoId: 7 });
    expect(dbPhotos.setDefaultPhoto).toHaveBeenCalledWith(3, 7);
  });

  it('PHOTOS_REORDER calls reorderPhotos', () => {
    const handler = getHandler(CHANNELS.PHOTOS_REORDER);
    handler(null, { shelterId: 3, photoIds: [9, 7, 8] });
    expect(dbPhotos.reorderPhotos).toHaveBeenCalledWith(3, [9, 7, 8]);
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

  describe('PHOTOS_EXPORT', () => {
    it('copies the photo to the chosen path using the title as the default name', async () => {
      (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/test-shelter/photos/shot.jpg');
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 1 });
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({ canceled: false, filePath: '/Users/me/Desktop/Town Hall.jpg' });

      const handler = getHandler(CHANNELS.PHOTOS_EXPORT);
      const result = await handler({ sender: {} }, { slug: 'test-shelter', fileName: 'shot.jpg', title: 'Town Hall', sheltersRoot: '/base' });

      expect(fsPhotos.photoFilePath).toHaveBeenCalledWith('test-shelter', 'shot.jpg', '/base');
      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        { id: 1 },
        expect.objectContaining({ defaultPath: 'Town Hall.jpg' }),
      );
      expect(fsp.copyFile).toHaveBeenCalledWith('/base/test-shelter/photos/shot.jpg', '/Users/me/Desktop/Town Hall.jpg');
      expect(result).toBe('/Users/me/Desktop/Town Hall.jpg');
    });

    it('falls back to the file basename when no title is set', async () => {
      (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/test-shelter/photos/shot-123.jpg');
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 1 });
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({ canceled: false, filePath: '/out/shot-123.jpg' });

      const handler = getHandler(CHANNELS.PHOTOS_EXPORT);
      await handler({ sender: {} }, { slug: 'test-shelter', fileName: 'shot-123.jpg', title: '', sheltersRoot: '/base' });

      expect(dialog.showSaveDialog).toHaveBeenCalledWith(
        { id: 1 },
        expect.objectContaining({ defaultPath: 'shot-123.jpg' }),
      );
    });

    it('does not copy when the user cancels', async () => {
      (fsPhotos.photoFilePath as jest.Mock).mockReturnValue('/base/test-shelter/photos/shot.jpg');
      (BrowserWindow.fromWebContents as jest.Mock).mockReturnValue({ id: 1 });
      (dialog.showSaveDialog as jest.Mock).mockResolvedValue({ canceled: true, filePath: undefined });

      const handler = getHandler(CHANNELS.PHOTOS_EXPORT);
      const result = await handler({ sender: {} }, { slug: 'test-shelter', fileName: 'shot.jpg', title: 'Town Hall', sheltersRoot: '/base' });

      expect(fsp.copyFile).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  it('PHOTOS_READ_FILE_METADATA calls readPhotoFileMetadata and returns result', async () => {
    const tags = [{ group: 'EXIF', key: 'Title', label: 'Title', value: 'Hall', writable: true }];
    (fsPhotos.readPhotoFileMetadata as jest.Mock).mockResolvedValue(tags);

    const handler = getHandler(CHANNELS.PHOTOS_READ_FILE_METADATA);
    const result = await handler(null, { slug: 'my-shelter', fileName: 'shot.jpg', sheltersRoot: '/base' });

    expect(fsPhotos.readPhotoFileMetadata).toHaveBeenCalledWith('my-shelter', 'shot.jpg', '/base');
    expect(result).toBe(tags);
  });

  it('PHOTOS_WRITE_FILE_METADATA calls writePhotoFileMetadata and resolves', async () => {
    (fsPhotos.writePhotoFileMetadata as jest.Mock).mockResolvedValue(undefined);

    const handler = getHandler(CHANNELS.PHOTOS_WRITE_FILE_METADATA);
    await handler(null, { slug: 'my-shelter', fileName: 'shot.jpg', sheltersRoot: '/base', tags: { Title: 'New' } });

    expect(fsPhotos.writePhotoFileMetadata).toHaveBeenCalledWith('my-shelter', 'shot.jpg', '/base', { Title: 'New' });
  });

  describe('PHOTOS_RECONCILE_SCAN', () => {
    it('registers the scan channel', () => {
      const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
      expect(registered).toContain(CHANNELS.PHOTOS_RECONCILE_SCAN);
    });

    it('returns untracked files (on disk, not in DB)', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue(['new-file.jpg', 'another.png']);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.untrackedFiles).toHaveLength(2);
      expect(result.untrackedFiles[0].fileName).toBe('test-shelter/photos/new-file.jpg');
      expect(result.orphanedRecords).toHaveLength(0);
    });

    it('returns untracked files from shelter root directory', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue([]);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue(['root-photo.jpg']);

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.untrackedFiles).toHaveLength(1);
      expect(result.untrackedFiles[0].fileName).toBe('test-shelter/root-photo.jpg');
      expect(result.orphanedRecords).toHaveLength(0);
    });

    it('returns orphaned records (in DB, not on disk)', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 10, file_name: 'test-shelter/photos/missing.jpg', title: 'Gone Photo' },
      ]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue([]);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);
      (fsp.access as jest.Mock).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.orphanedRecords).toHaveLength(1);
      expect(result.orphanedRecords[0].id).toBe(10);
      expect(result.orphanedRecords[0].fileName).toBe('missing.jpg');
      expect(result.untrackedFiles).toHaveLength(0);
    });

    it('returns empty lists when in sync', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 5, file_name: 'test-shelter/photos/synced.jpg', title: 'Synced' },
      ]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue(['synced.jpg']);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.untrackedFiles).toHaveLength(0);
      expect(result.orphanedRecords).toHaveLength(0);
    });

    it('handles missing photos directory gracefully', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue([]);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.untrackedFiles).toHaveLength(0);
      expect(result.orphanedRecords).toHaveLength(0);
    });

    it('detects orphaned records stored without photos/ subdirectory (legacy paths)', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 20, file_name: 'test-shelter/present-directly.jpg', title: 'Direct' },
        { id: 21, file_name: 'test-shelter/gone-directly.jpg', title: 'Gone Direct' },
      ]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue([]);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);
      (fsp.access as jest.Mock)
        .mockResolvedValueOnce(undefined)        // id 20 exists
        .mockRejectedValueOnce(new Error('ENOENT')); // id 21 gone

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.orphanedRecords).toHaveLength(1);
      expect(result.orphanedRecords[0].id).toBe(21);
    });

    it('reports missing/orphaned thumbnail counts from scanThumbnails, without writing anything', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 5, file_name: 'test-shelter/photos/synced.jpg', title: 'Synced' },
      ]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue(['synced.jpg']);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);
      (fsp.access as jest.Mock).mockResolvedValue(undefined);
      (fsThumbnails.scanThumbnails as jest.Mock).mockReturnValue({
        missing: [{ sourcePath: '/shelters/test-shelter/photos/synced.jpg', sizeClass: 'preview' }],
        orphaned: ['/tmp/photo-thumbnails/grid/synced-500.png'],
      });

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(fsThumbnails.scanThumbnails).toHaveBeenCalledWith(
        ['/shelters/test-shelter/photos/synced.jpg'],
        [],
      );
      expect(result.missingThumbnailCount).toBe(1);
      expect(result.orphanedThumbnails).toEqual(['synced-500.png']);
      expect(fsThumbnails.applyThumbnailScan).not.toHaveBeenCalled();
    });

    it('passes gone-record basenames to scanThumbnails for shelter-scoped orphan detection', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 10, file_name: 'test-shelter/photos/missing.jpg', title: 'Gone Photo' },
      ]);
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue([]);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);
      (fsp.access as jest.Mock).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
      (fsThumbnails.scanThumbnails as jest.Mock).mockReturnValue({ missing: [], orphaned: [] });

      const handler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      await handler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(fsThumbnails.scanThumbnails).toHaveBeenCalledWith([], ['missing.jpg']);
    });
  });

  describe('PHOTOS_RECONCILE_APPLY', () => {
    it('registers the apply channel', () => {
      const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
      expect(registered).toContain(CHANNELS.PHOTOS_RECONCILE_APPLY);
    });

    it('inserts selected files with filename-as-title', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      const newPhoto = { id: 99, file_name: 'test-shelter/photos/new.jpg', shelter_id: 1 };
      (dbPhotos.insertPhoto as jest.Mock).mockReturnValue(newPhoto);

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: ['test-shelter/photos/new.jpg'], recordIdsToDelete: [],
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      const result = await handler(null, input);

      expect(dbPhotos.insertPhoto).toHaveBeenCalledWith(1, 'test-shelter/photos/new.jpg', 'new');
      expect(result.added).toBe(1);
      expect(result.deleted).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('inserts root-level untracked files with correct relative path', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      const newPhoto = { id: 100, file_name: 'test-shelter/root-photo.jpg', shelter_id: 1 };
      (dbPhotos.insertPhoto as jest.Mock).mockReturnValue(newPhoto);

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: ['test-shelter/root-photo.jpg'], recordIdsToDelete: [],
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      const result = await handler(null, input);

      expect(dbPhotos.insertPhoto).toHaveBeenCalledWith(1, 'test-shelter/root-photo.jpg', 'root-photo');
      expect(result.added).toBe(1);
    });

    it('deletes selected orphaned records', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.clearDefaultPhoto as jest.Mock).mockReturnValue(undefined);

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: [], recordIdsToDelete: [10, 11],
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      const result = await handler(null, input);

      expect(dbPhotos.clearDefaultPhoto).toHaveBeenCalledWith(1, 10);
      expect(dbPhotos.clearDefaultPhoto).toHaveBeenCalledWith(1, 11);
      expect(dbPhotos.deletePhoto).toHaveBeenCalledWith(10);
      expect(dbPhotos.deletePhoto).toHaveBeenCalledWith(11);
      expect(result.deleted).toBe(2);
      expect(result.added).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('collects failures best-effort without throwing', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.insertPhoto as jest.Mock)
        .mockReturnValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('DB error'));

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: ['test-shelter/photos/ok.jpg', 'test-shelter/photos/bad.jpg'], recordIdsToDelete: [],
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      const result = await handler(null, input);

      expect(result.added).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.failures[0].item).toBe('test-shelter/photos/bad.jpg');
      expect(() => handler(null, input)).not.toThrow();
    });

    it('never throws even on total failure', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue(null);

      const input: ReconcileApplyInput = {
        shelterId: 99, sheltersRoot: '/shelters',
        filesToAdd: ['shelter-99/photos/x.jpg'], recordIdsToDelete: [],
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      await expect(handler(null, input)).resolves.toBeDefined();
    });

    it('always generates missing thumbnails for the shelter, regardless of purgeOrphanedThumbnails', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 5, file_name: 'test-shelter/photos/synced.jpg' },
      ]);
      (fsThumbnails.scanThumbnails as jest.Mock).mockReturnValue({
        missing: [{ sourcePath: '/shelters/test-shelter/photos/synced.jpg', sizeClass: 'grid' }],
        orphaned: ['/tmp/photo-thumbnails/preview/old-1.png'],
      });
      (fsThumbnails.applyThumbnailScan as jest.Mock).mockResolvedValue({ generated: 1, purged: 0 });

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: [], recordIdsToDelete: [], purgeOrphanedThumbnails: false,
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      const result = await handler(null, input);

      expect(fsThumbnails.applyThumbnailScan).toHaveBeenCalledWith(
        [{ sourcePath: '/shelters/test-shelter/photos/synced.jpg', sizeClass: 'grid' }],
        ['/tmp/photo-thumbnails/preview/old-1.png'],
        false,
      );
      expect(result.thumbnailsGenerated).toBe(1);
      expect(result.thumbnailsPurged).toBe(0);
    });

    it('purges orphaned thumbnails when purgeOrphanedThumbnails is true', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([]);
      (fsThumbnails.scanThumbnails as jest.Mock).mockReturnValue({ missing: [], orphaned: ['/tmp/x.png'] });
      (fsThumbnails.applyThumbnailScan as jest.Mock).mockResolvedValue({ generated: 0, purged: 1 });

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: [], recordIdsToDelete: [], purgeOrphanedThumbnails: true,
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      const result = await handler(null, input);

      expect(fsThumbnails.applyThumbnailScan).toHaveBeenCalledWith([], ['/tmp/x.png'], true);
      expect(result.thumbnailsPurged).toBe(1);
    });

    it('includes the file basenames of records being deleted in the thumbnail orphan scan', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValue([
        { id: 10, file_name: 'test-shelter/photos/gone.jpg' },
      ]);
      (fsThumbnails.scanThumbnails as jest.Mock).mockReturnValue({ missing: [], orphaned: [] });
      (fsThumbnails.applyThumbnailScan as jest.Mock).mockResolvedValue({ generated: 0, purged: 0 });

      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters',
        filesToAdd: [], recordIdsToDelete: [10],
      };
      const handler = getHandler<ReconcileApplyResult>(CHANNELS.PHOTOS_RECONCILE_APPLY);
      await handler(null, input);

      expect(fsThumbnails.scanThumbnails).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(['gone.jpg']),
      );
    });
  });

  describe('PHOTOS_RECONCILE_SCAN rerun safety', () => {
    it('does not list previously registered files after apply', async () => {
      (dbShelters.getShelterById as jest.Mock).mockReturnValue({ id: 1, slug: 'test-shelter' });
      (fsPhotos.listPhotosDir as jest.Mock).mockResolvedValue(['registered.jpg']);
      (fsPhotos.listShelterRootImages as jest.Mock).mockResolvedValue([]);
      (fsp.access as jest.Mock).mockResolvedValue(undefined);

      (dbPhotos.getPhotosByShelter as jest.Mock).mockReturnValueOnce([
        { id: 5, file_name: 'test-shelter/photos/registered.jpg', title: 'Registered' },
      ]);

      const scanHandler = getHandler<ReconcileScanResult>(CHANNELS.PHOTOS_RECONCILE_SCAN);
      const result = await scanHandler(null, { shelterId: 1, sheltersRoot: '/shelters' });

      expect(result.untrackedFiles).toHaveLength(0);
    });
  });
});
