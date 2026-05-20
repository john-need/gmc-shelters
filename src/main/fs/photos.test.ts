jest.mock('fs/promises');
jest.mock('electron');
jest.mock('../logger', () => ({ log: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('exiftool-vendored', () => {
  return {
    ExifTool: jest.fn().mockImplementation(() => ({
      write: jest.fn().mockResolvedValue({}),
      read: jest.fn().mockResolvedValue({}),
      end: jest.fn(),
    })),
  };
});
const mockSharp = {
  rotate: jest.fn().mockReturnThis(),
  flop: jest.fn().mockReturnThis(),
  extract: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('transformed')),
};
jest.mock('sharp', () => jest.fn(() => mockSharp));

import * as fsp from 'fs/promises';
import { app } from 'electron';
import { ExifTool } from 'exiftool-vendored';
import {
  photosDirForSlug,
  photoFilePath,
  copyPhotoToShelter,
  deletePhotoFile,
  ensureShelterDir,
  writePhotoXmp,
  readPhotoXmp,
  transformPhoto,
} from './photos';
import type { Photo } from '../../shared/ipc-types';

import sharp from 'sharp';

const mockExifToolInstance = (ExifTool as jest.Mock).mock.results[0].value;

beforeEach(() => {
  jest.clearAllMocks();
  (app.getAppPath as jest.Mock).mockReturnValue('/base');
});

describe('fs/photos', () => {
  describe('photosDirForSlug', () => {
    it('returns path under absolute sheltersRoot', () => {
      expect(photosDirForSlug('my-shelter', '/abs/shelters')).toBe('/abs/shelters/my-shelter/photos');
    });

    it('returns path under relative sheltersRoot resolved against appPath', () => {
      expect(photosDirForSlug('my-shelter', 'relative/shelters')).toBe('/base/relative/shelters/my-shelter/photos');
    });
  });

  describe('photoFilePath', () => {
    it('appends filename to sheltersRoot', () => {
      expect(photoFilePath('my-shelter', 'shot.jpg', '/abs/shelters')).toBe('/abs/shelters/shot.jpg');
    });

    it('strips redundant shelters/ prefix', () => {
      expect(photoFilePath('my-shelter', 'shelters/my-shelter/shot.jpg', '/base/shelters')).toBe('/base/shelters/my-shelter/shot.jpg');
    });
  });

  describe('copyPhotoToShelter', () => {
    it('creates photos dir and copies file', async () => {
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsp.copyFile as jest.Mock).mockResolvedValue(undefined);
      const fileName = await copyPhotoToShelter('/src/image.jpg', 'my-shelter', '/base/shelters');
      expect(fsp.mkdir).toHaveBeenCalledWith('/base/shelters/my-shelter/photos', { recursive: true });
      expect(fsp.copyFile).toHaveBeenCalled();
      expect(fileName).toMatch(/^image-\d+\.jpg$/);
    });
  });

  describe('deletePhotoFile', () => {
    it('deletes the file', async () => {
      (fsp.unlink as jest.Mock).mockResolvedValue(undefined);
      await deletePhotoFile('my-shelter', 'my-shelter/photos/shot.jpg', '/base/shelters');
      expect(fsp.unlink).toHaveBeenCalledWith('/base/shelters/my-shelter/photos/shot.jpg');
    });

    it('does not throw when file is already gone', async () => {
      (fsp.unlink as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      await expect(deletePhotoFile('my-shelter', 'gone.jpg', '/base/shelters')).resolves.not.toThrow();
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

describe('writePhotoXmp', () => {
  it('calls exiftool.write with correct mapping', async () => {
    const photo: any = {
      id: 6007,
      title: 'My Title',
      photographer: 'Author Name',
      date_taken: '2023-05-19',
      caption: 'A caption',
      alt_text: 'Accessibility text',
      description: 'Long description',
      notes: 'Some notes',
      file_name: 'test.jpg',
    };

    await writePhotoXmp(photo as Photo, '/abs/shelters', 'my-shelter');

    expect(mockExifToolInstance.write).toHaveBeenCalledWith(
      '/abs/shelters/test.jpg',
      expect.objectContaining({
        Title: 'My Title',
        Creator: 'Author Name',
        Identifier: '6007',
        Description: 'A caption',
      })
    );
  });
});

describe('readPhotoXmp', () => {
  it('reads and maps tags correctly', async () => {
    mockExifToolInstance.read.mockResolvedValue({
      Title: 'Read Title',
      Creator: ['Author 1', 'Author 2'],
      CreateDate: { rawValue: '2023:05:19 12:00:00' },
      Description: 'Read Caption',
      Headline: 'Read Alt',
      Subject: ['Tag1', 'Tag2'],
      Instructions: 'Read Notes',
    });

    const result = await readPhotoXmp('my-shelter', 'shot.jpg', '/abs/shelters');

    expect(result).toEqual({
      title: 'Read Title',
      photographer: 'Author 1, Author 2',
      date_taken: '2023:05:19 12:00:00',
      caption: 'Read Caption',
      alt_text: 'Read Alt',
      description: 'Tag1, Tag2',
      notes: 'Read Notes',
    });
  });
});

describe('transformPhoto', () => {
  it('applies transformations with sharp', async () => {
    const transform = {
      rotation: 90,
      flipped: true,
      crop: { x: 10, y: 10, width: 100, height: 100 },
    };
    (fsp.writeFile as jest.Mock).mockResolvedValue(undefined);

    await transformPhoto('/path/to/img.jpg', transform);

    expect(sharp).toHaveBeenCalledWith('/path/to/img.jpg');
    expect(mockSharp.rotate).toHaveBeenCalledWith(90);
    expect(mockSharp.flop).toHaveBeenCalled();
    expect(mockSharp.extract).toHaveBeenCalledWith(transform.crop);
    expect(fsp.writeFile).toHaveBeenCalledWith('/path/to/img.jpg', expect.any(Buffer));
  });

  it('skips missing transformations', async () => {
    jest.clearAllMocks();
    await transformPhoto('/path/to/img.jpg', { rotation: 90 });
    expect(mockSharp.rotate).toHaveBeenCalledWith(90);
    expect(mockSharp.flop).not.toHaveBeenCalled();
    expect(mockSharp.extract).not.toHaveBeenCalled();
  });
});
