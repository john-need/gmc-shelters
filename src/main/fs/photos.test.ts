jest.mock('fs/promises');
jest.mock('electron');
jest.mock('../logger', () => ({ log: { info: jest.fn(), error: jest.fn() } }));

import * as fsp from 'fs/promises';
import { app } from 'electron';
import {
  photosDirForSlug,
  photoFilePath,
  copyPhotoToShelter,
  deletePhotoFile,
  ensureShelterDir,
} from './photos';

beforeEach(() => {
  jest.clearAllMocks();
  (app.getAppPath as jest.Mock).mockReturnValue('/base');
});

describe('fs/photos', () => {
  describe('photosDirForSlug', () => {
    it('returns path under app root', () => {
      expect(photosDirForSlug('my-shelter')).toBe('/base/shelters/my-shelter/photos');
    });
  });

  describe('photoFilePath', () => {
    it('appends filename to photos dir', () => {
      expect(photoFilePath('my-shelter', 'shot.jpg')).toBe('/base/shelters/my-shelter/photos/shot.jpg');
    });
  });

  describe('copyPhotoToShelter', () => {
    it('creates photos dir and copies file', async () => {
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsp.copyFile as jest.Mock).mockResolvedValue(undefined);
      const fileName = await copyPhotoToShelter('/src/image.jpg', 'my-shelter');
      expect(fsp.mkdir).toHaveBeenCalledWith('/base/shelters/my-shelter/photos', { recursive: true });
      expect(fsp.copyFile).toHaveBeenCalled();
      expect(fileName).toMatch(/^image-\d+\.jpg$/);
    });
  });

  describe('deletePhotoFile', () => {
    it('deletes the file', async () => {
      (fsp.unlink as jest.Mock).mockResolvedValue(undefined);
      await deletePhotoFile('my-shelter', 'shot.jpg');
      expect(fsp.unlink).toHaveBeenCalledWith('/base/shelters/my-shelter/photos/shot.jpg');
    });

    it('does not throw when file is already gone', async () => {
      (fsp.unlink as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      await expect(deletePhotoFile('my-shelter', 'gone.jpg')).resolves.not.toThrow();
    });
  });

  describe('ensureShelterDir', () => {
    it('creates shelter dir and photos subdir', async () => {
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined);
      await ensureShelterDir('my-shelter');
      expect(fsp.mkdir).toHaveBeenCalledWith('/base/shelters/my-shelter', { recursive: true });
      expect(fsp.mkdir).toHaveBeenCalledWith('/base/shelters/my-shelter/photos', { recursive: true });
    });
  });
});
