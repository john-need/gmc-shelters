import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import sharp from 'sharp';

const THUMBNAIL_WIDTH = 120; // matches the existing `grid` thumbnail size class in src/main/fs/thumbnails.ts
const PER_IMAGE_TIMEOUT_MS = 5_000;

function cacheDir(): string {
  return path.join(app.getPath('userData'), 'research-thumbnails');
}

function cachePathForUrl(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(cacheDir(), `${hash}.jpg`);
}

/**
 * Fetches a web-research result's photo (if any), resizes it to a small
 * thumbnail, and caches it locally — never returns/exposes the original
 * external URL. Returns null (never throws) on any failure: network, non-2xx,
 * or an undecodable image.
 */
export async function fetchAndCacheImage(
  url: string,
  opts?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<string | null> {
  const cachePath = cachePathForUrl(url);
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? PER_IMAGE_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal } as RequestInit);
    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    const resized = await sharp(bytes).resize({ width: THUMBNAIL_WIDTH }).jpeg().toBuffer();

    fs.mkdirSync(cacheDir(), { recursive: true });
    fs.writeFileSync(cachePath, resized);
    return cachePath;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
