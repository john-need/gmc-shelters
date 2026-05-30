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
  readPhotoFileMetadata,
  writePhotoFileMetadata,
  transformPhoto,
} from './photos';
import type { FileMetadataTag } from '../../shared/ipc-types';
import type { Photo } from '../../shared/ipc-types';

import sharp from 'sharp';

const mockExifToolInstance = (ExifTool as jest.Mock).mock.results[0].value;

beforeEach(() => {
  jest.clearAllMocks();
  (app.getAppPath as jest.Mock).mockReturnValue('/base');
});

describe('listPhotosDir', () => {
  it('returns bare image filenames from the photos directory', async () => {
    (fsp.readdir as jest.Mock).mockResolvedValue(['a.jpg', 'b.PNG', 'c.tiff', 'd.txt', '.DS_Store']);
    const { listPhotosDir } = await import('./photos');
    const result = await listPhotosDir('test-shelter', '/abs/shelters');
    expect(result).toEqual(['a.jpg', 'b.PNG', 'c.tiff']);
    expect(fsp.readdir).toHaveBeenCalledWith('/abs/shelters/test-shelter/photos');
  });

  it('is case-insensitive on extension', async () => {
    (fsp.readdir as jest.Mock).mockResolvedValue(['img.JPG', 'photo.WebP', 'file.TIF']);
    const { listPhotosDir } = await import('./photos');
    const result = await listPhotosDir('slug', '/root');
    expect(result).toHaveLength(3);
  });

  it('returns empty array when directory does not exist', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    (fsp.readdir as jest.Mock).mockRejectedValue(err);
    const { listPhotosDir } = await import('./photos');
    const result = await listPhotosDir('missing-shelter', '/root');
    expect(result).toEqual([]);
  });

  it('filters out non-image files', async () => {
    (fsp.readdir as jest.Mock).mockResolvedValue(['readme.md', 'video.mp4', 'photo.jpeg']);
    const { listPhotosDir } = await import('./photos');
    const result = await listPhotosDir('slug', '/root');
    expect(result).toEqual(['photo.jpeg']);
  });
});

describe('listShelterRootImages', () => {
  it('returns image filenames from the shelter root (files only)', async () => {
    (fsp.readdir as jest.Mock).mockResolvedValue([
      { name: 'old-photo.jpg', isFile: () => true },
      { name: 'photos', isFile: () => false },
      { name: 'readme.txt', isFile: () => true },
    ]);
    const { listShelterRootImages } = await import('./photos');
    const result = await listShelterRootImages('test-shelter', '/abs/shelters');
    expect(result).toEqual(['old-photo.jpg']);
    expect(fsp.readdir).toHaveBeenCalledWith('/abs/shelters/test-shelter', { withFileTypes: true });
  });

  it('excludes directories like the photos/ subdir', async () => {
    (fsp.readdir as jest.Mock).mockResolvedValue([
      { name: 'photos', isFile: () => false },
      { name: 'data', isFile: () => false },
    ]);
    const { listShelterRootImages } = await import('./photos');
    const result = await listShelterRootImages('slug', '/root');
    expect(result).toEqual([]);
  });

  it('returns empty array when directory does not exist', async () => {
    const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    (fsp.readdir as jest.Mock).mockRejectedValue(err);
    const { listShelterRootImages } = await import('./photos');
    const result = await listShelterRootImages('missing-shelter', '/root');
    expect(result).toEqual([]);
  });

  it('is case-insensitive on extension', async () => {
    (fsp.readdir as jest.Mock).mockResolvedValue([
      { name: 'img.JPG', isFile: () => true },
      { name: 'scan.TIF', isFile: () => true },
      { name: 'note.PDF', isFile: () => true },
    ]);
    const { listShelterRootImages } = await import('./photos');
    const result = await listShelterRootImages('slug', '/root');
    expect(result).toEqual(['img.JPG', 'scan.TIF']);
  });
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
      await ensureShelterDir('my-shelter', 'shelters');
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

describe('readPhotoFileMetadata', () => {
  it('calls exiftool.read with resolved file path', async () => {
    mockExifToolInstance.read.mockResolvedValue({ Title: 'Hall', Make: 'Canon' });
    await readPhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters');
    expect(mockExifToolInstance.read).toHaveBeenCalledWith('/abs/shelters/shot.jpg');
  });

  it('returns FileMetadataTag[] with group, key, label, value, writable', async () => {
    mockExifToolInstance.read.mockResolvedValue({ Title: 'Hall' });
    const result = await readPhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters');
    expect(Array.isArray(result)).toBe(true);
    const tag = result.find((t: FileMetadataTag) => t.key === 'Title');
    expect(tag).toBeDefined();
    expect(tag).toMatchObject({ key: 'Title', value: 'Hall', writable: true });
    expect(typeof tag!.group).toBe('string');
    expect(typeof tag!.label).toBe('string');
  });

  it('marks File-system intrinsic tags as writable: false', async () => {
    mockExifToolInstance.read.mockResolvedValue({
      FileSize: '1234 kB',
      ImageWidth: 3024,
      Title: 'Hall',
    });
    const result = await readPhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters');
    const fileSize = result.find((t: FileMetadataTag) => t.key === 'FileSize');
    const imgWidth = result.find((t: FileMetadataTag) => t.key === 'ImageWidth');
    const title = result.find((t: FileMetadataTag) => t.key === 'Title');
    expect(fileSize!.writable).toBe(false);
    expect(imgWidth!.writable).toBe(false);
    expect(title!.writable).toBe(true);
  });

  it('marks Identifier tag as writable: false', async () => {
    mockExifToolInstance.read.mockResolvedValue({ Identifier: '42', Title: 'Hall' });
    const result = await readPhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters');
    const id = result.find((t: FileMetadataTag) => t.key === 'Identifier');
    expect(id!.writable).toBe(false);
  });

  it('excludes tags with null or undefined values', async () => {
    mockExifToolInstance.read.mockResolvedValue({ Title: 'Hall', Description: null, Notes: undefined });
    const result = await readPhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters');
    const keys = result.map((t: FileMetadataTag) => t.key);
    expect(keys).toContain('Title');
    expect(keys).not.toContain('Description');
    expect(keys).not.toContain('Notes');
  });

  it('throws when exiftool.read rejects', async () => {
    mockExifToolInstance.read.mockRejectedValue(new Error('file not found'));
    await expect(readPhotoFileMetadata('my-shelter', 'missing.jpg', '/abs/shelters')).rejects.toThrow('file not found');
  });
});

describe('writePhotoFileMetadata', () => {
  it('calls exiftool.write with resolved file path and tag map', async () => {
    mockExifToolInstance.write.mockResolvedValue({});
    await writePhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters', { Title: 'New Title' });
    expect(mockExifToolInstance.write).toHaveBeenCalledWith('/abs/shelters/shot.jpg', { Title: 'New Title' });
  });

  it('resolves void on success', async () => {
    mockExifToolInstance.write.mockResolvedValue({});
    const result = await writePhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters', { Title: 'X' });
    expect(result).toBeUndefined();
  });

  it('throws and logs on write error', async () => {
    const { log } = require('../logger');
    mockExifToolInstance.write.mockRejectedValue(new Error('write failed'));
    await expect(writePhotoFileMetadata('my-shelter', 'shot.jpg', '/abs/shelters', { Title: 'X' })).rejects.toThrow('write failed');
    expect(log.error).toHaveBeenCalled();
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
    expect(mockSharp.extract).toHaveBeenCalledWith({ left: 10, top: 10, width: 100, height: 100 });
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
