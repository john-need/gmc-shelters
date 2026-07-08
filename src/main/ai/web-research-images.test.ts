jest.mock('fs');
jest.mock('electron');

const mockSharp = {
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('resized-bytes')),
};
jest.mock('sharp', () => jest.fn(() => mockSharp));

import fs from 'fs';
import { app } from 'electron';
import { fetchAndCacheImage } from './web-research-images';

const mockedFs = fs as jest.Mocked<typeof fs>;

function fetchImplResolvingWith(body: ArrayBuffer, status = 200) {
  return jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: () => Promise.resolve(body),
  });
}

describe('ai/web-research-images fetchAndCacheImage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (app.getPath as jest.Mock).mockReturnValue('/tmp/userData');
    mockedFs.mkdirSync.mockImplementation(() => undefined as unknown as string);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
  });

  it('fetches, resizes, and caches a new image, returning its cache path', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const fetchImpl = fetchImplResolvingWith(new ArrayBuffer(8));

    const result = await fetchAndCacheImage('https://example.com/a.jpg', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(mockSharp.resize).toHaveBeenCalledWith(expect.objectContaining({ width: 120 }));
    expect(mockedFs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('research-thumbnails'), Buffer.from('resized-bytes'));
    expect(result).toContain('research-thumbnails');
    expect(result).toMatch(/\.jpg$/);
  });

  it('returns the cached path on a repeat call with the same URL, without fetching again', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    const fetchImpl = fetchImplResolvingWith(new ArrayBuffer(8));

    const result = await fetchAndCacheImage('https://example.com/a.jpg', { fetchImpl });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toContain('research-thumbnails');
  });

  it('returns null on a non-2xx fetch response, without throwing', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const fetchImpl = fetchImplResolvingWith(new ArrayBuffer(0), 404);

    const result = await fetchAndCacheImage('https://example.com/missing.jpg', { fetchImpl });

    expect(result).toBeNull();
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it('returns null when fetch throws, without throwing', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

    const result = await fetchAndCacheImage('https://example.com/a.jpg', { fetchImpl });

    expect(result).toBeNull();
  });

  it('returns null when sharp fails to decode the image, without throwing', async () => {
    mockedFs.existsSync.mockReturnValue(false);
    mockSharp.toBuffer.mockRejectedValueOnce(new Error('unsupported image format'));
    const fetchImpl = fetchImplResolvingWith(new ArrayBuffer(8));

    const result = await fetchAndCacheImage('https://example.com/a.jpg', { fetchImpl });

    expect(result).toBeNull();
  });
});
