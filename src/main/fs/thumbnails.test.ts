jest.mock('fs');
jest.mock('electron');
jest.mock('../logger', () => ({ log: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));

import fs from 'fs';
import { nativeImage } from 'electron';
import { getThumbnailPath, purgeThumbnailsForSource, scanThumbnails, applyThumbnailScan } from './thumbnails';

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedNativeImage = nativeImage as unknown as {
  createThumbnailFromPath: jest.Mock;
};

describe('getThumbnailPath', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.statSync.mockReturnValue({ mtimeMs: 1000 } as fs.Stats);
    mockedFs.mkdirSync.mockImplementation(() => undefined as unknown as string);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
  });

  it('generates and caches a thumbnail on cache miss', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = await getThumbnailPath('/shelters/foo/photos/bar-123.jpg', 'grid');

    expect(mockedNativeImage.createThumbnailFromPath).toHaveBeenCalledWith(
      '/shelters/foo/photos/bar-123.jpg',
      { width: 240, height: 240 },
    );
    expect(mockedFs.writeFileSync).toHaveBeenCalled();
    expect(result).toMatch(/bar-123-1000\.png$/);
    expect(result).toContain('photo-thumbnails');
    expect(result).toContain('grid');
  });

  it('returns the cached file path on cache hit without regenerating', async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const result = await getThumbnailPath('/shelters/foo/photos/bar-123.jpg', 'preview');

    expect(mockedNativeImage.createThumbnailFromPath).not.toHaveBeenCalled();
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    expect(result).toMatch(/bar-123-1000\.png$/);
    expect(result).toContain('preview');
  });

  it('uses the preview size constants for the preview size class', async () => {
    mockedFs.existsSync.mockReturnValue(false);

    await getThumbnailPath('/shelters/foo/photos/bar-123.jpg', 'preview');

    expect(mockedNativeImage.createThumbnailFromPath).toHaveBeenCalledWith(
      '/shelters/foo/photos/bar-123.jpg',
      { width: 800, height: 600 },
    );
  });

  it('returns null and writes no file when generation fails', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedNativeImage.createThumbnailFromPath.mockRejectedValueOnce(new Error('decode failed'));

    const result = await getThumbnailPath('/shelters/foo/photos/corrupt.jpg', 'grid');

    expect(result).toBeNull();
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns null when the source file cannot be stat-ed', async () => {
    mockedFs.statSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = await getThumbnailPath('/shelters/foo/photos/missing.jpg', 'grid');

    expect(result).toBeNull();
  });

  it('regenerates when the source file mtime changes (cache invalidation)', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockedFs.statSync.mockReturnValue({ mtimeMs: 1000 } as fs.Stats);
    await getThumbnailPath('/shelters/foo/photos/bar-123.jpg', 'grid');
    expect(mockedNativeImage.createThumbnailFromPath).toHaveBeenCalledTimes(1);

    mockedFs.statSync.mockReturnValue({ mtimeMs: 2000 } as fs.Stats);
    mockedFs.existsSync.mockReturnValue(false);
    const result = await getThumbnailPath('/shelters/foo/photos/bar-123.jpg', 'grid');

    expect(mockedNativeImage.createThumbnailFromPath).toHaveBeenCalledTimes(2);
    expect(result).toMatch(/bar-123-2000\.png$/);
  });
});

describe('purgeThumbnailsForSource', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes all cached files (any mtime) matching the source basename, across both size dirs', () => {
    (mockedFs.readdirSync as jest.Mock).mockImplementation((dir: string) => {
      const d = String(dir);
      if (d.includes('/grid')) return ['bar-123-1000.png', 'bar-123-2000.png', 'other-99.png'];
      if (d.includes('/preview')) return ['bar-123-1000.png'];
      return [];
    });
    mockedFs.unlinkSync.mockImplementation(() => undefined);

    const purged = purgeThumbnailsForSource('/shelters/foo/photos/bar-123.jpg');

    expect(purged).toBe(3);
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('grid/bar-123-1000.png'));
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('grid/bar-123-2000.png'));
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('preview/bar-123-1000.png'));
    expect(mockedFs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('other-99.png'));
  });

  it('returns 0 and does not throw when the cache directory does not exist yet', () => {
    (mockedFs.readdirSync as jest.Mock).mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    expect(() => purgeThumbnailsForSource('/shelters/foo/photos/nope.jpg')).not.toThrow();
    expect(purgeThumbnailsForSource('/shelters/foo/photos/nope.jpg')).toBe(0);
  });
});

describe('scanThumbnails', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports missing current-mtime thumbnails and orphaned stale/gone-record cache files, without writing anything', () => {
    mockedFs.statSync.mockReturnValue({ mtimeMs: 1000 } as fs.Stats);
    mockedFs.existsSync.mockImplementation((p: unknown) => String(p).includes('grid/a-1-1000.png'));
    (mockedFs.readdirSync as jest.Mock).mockImplementation((dir: string) => {
      const d = String(dir);
      if (d.includes('/grid')) return ['a-1-1000.png', 'a-1-500.png'];
      if (d.includes('/preview')) return ['old-photo-2000.png'];
      return [];
    });

    const result = scanThumbnails(['/shelters/foo/photos/a-1.jpg'], ['old-photo.jpg']);

    expect(result.missing).toEqual([
      { sourcePath: '/shelters/foo/photos/a-1.jpg', sizeClass: 'preview' },
    ]);
    expect(result.orphaned).toEqual(
      expect.arrayContaining([
        expect.stringContaining('grid/a-1-500.png'),
        expect.stringContaining('preview/old-photo-2000.png'),
      ]),
    );
    expect(result.orphaned).toHaveLength(2);
    expect(mockedNativeImage.createThumbnailFromPath).not.toHaveBeenCalled();
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
  });

  it('returns no missing/orphaned entries when everything is already in sync', () => {
    mockedFs.statSync.mockReturnValue({ mtimeMs: 1000 } as fs.Stats);
    mockedFs.existsSync.mockReturnValue(true);
    (mockedFs.readdirSync as jest.Mock).mockImplementation((dir: string) => {
      const d = String(dir);
      if (d.includes('/grid') || d.includes('/preview')) return ['a-1-1000.png'];
      return [];
    });

    const result = scanThumbnails(['/shelters/foo/photos/a-1.jpg'], []);

    expect(result.missing).toEqual([]);
    expect(result.orphaned).toEqual([]);
  });
});

describe('applyThumbnailScan', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFs.statSync.mockReturnValue({ mtimeMs: 1000 } as fs.Stats);
    mockedFs.mkdirSync.mockImplementation(() => undefined as unknown as string);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    mockedFs.existsSync.mockReturnValue(false);
  });

  it('generates every missing thumbnail and leaves orphaned files alone when purgeOrphaned is false', async () => {
    const missing = [{ sourcePath: '/shelters/foo/photos/a-1.jpg', sizeClass: 'grid' as const }];
    const orphaned = ['/tmp/photo-thumbnails/grid/a-1-500.png'];

    const result = await applyThumbnailScan(missing, orphaned, false);

    expect(result.generated).toBe(1);
    expect(mockedNativeImage.createThumbnailFromPath).toHaveBeenCalledTimes(1);
    expect(result.purged).toBe(0);
    expect(mockedFs.unlinkSync).not.toHaveBeenCalled();
  });

  it('purges orphaned files when purgeOrphaned is true', async () => {
    const orphaned = ['/tmp/photo-thumbnails/grid/a-1-500.png', '/tmp/photo-thumbnails/preview/old-2000.png'];

    const result = await applyThumbnailScan([], orphaned, true);

    expect(result.purged).toBe(2);
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(orphaned[0]);
    expect(mockedFs.unlinkSync).toHaveBeenCalledWith(orphaned[1]);
  });

  it('does not fail if an orphaned file was already removed by something else', async () => {
    mockedFs.unlinkSync.mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    const result = await applyThumbnailScan([], ['/tmp/photo-thumbnails/grid/gone.png'], true);

    expect(result.purged).toBe(0);
  });
});
