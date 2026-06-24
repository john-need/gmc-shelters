import fs from 'fs';
import path from 'path';
import { app, nativeImage } from 'electron';
import { log } from '../logger';

export type ThumbnailSizeClass = 'grid' | 'preview';

const SIZES: Record<ThumbnailSizeClass, { width: number; height: number }> = {
  grid: { width: 240, height: 240 },
  preview: { width: 800, height: 600 },
};

function cacheDir(sizeClass: ThumbnailSizeClass): string {
  return path.join(app.getPath('userData'), 'photo-thumbnails', sizeClass);
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function getThumbnailPath(
  sourcePath: string,
  sizeClass: ThumbnailSizeClass,
): Promise<string | null> {
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(sourcePath).mtimeMs;
  } catch (err) {
    log.warn(`[thumbnails] could not stat source file: ${sourcePath}`, err);
    return null;
  }

  const base = sanitize(path.basename(sourcePath, path.extname(sourcePath)));
  const dir = cacheDir(sizeClass);
  const thumbPath = path.join(dir, `${base}-${mtimeMs}.png`);

  if (fs.existsSync(thumbPath)) {
    return thumbPath;
  }

  try {
    fs.mkdirSync(dir, { recursive: true });
    const image = await nativeImage.createThumbnailFromPath(sourcePath, SIZES[sizeClass]);
    fs.writeFileSync(thumbPath, image.toPNG());
    log.info(`[thumbnails] generated ${sizeClass} thumbnail for ${sourcePath}`);
    return thumbPath;
  } catch (err) {
    log.warn(`[thumbnails] generation failed for ${sourcePath}`, err);
    return null;
  }
}

const SIZE_CLASSES: ThumbnailSizeClass[] = ['grid', 'preview'];

function basenamePrefix(sourcePath: string): string {
  return sanitize(path.basename(sourcePath, path.extname(sourcePath)));
}

function listCacheFiles(sizeClass: ThumbnailSizeClass): string[] {
  try {
    return fs.readdirSync(cacheDir(sizeClass)) as unknown as string[];
  } catch {
    return [];
  }
}

/** Deletes every cached file (any mtime) for one source photo, across both size classes. Used on photo delete. */
export function purgeThumbnailsForSource(sourcePath: string): number {
  const prefix = basenamePrefix(sourcePath);
  let purged = 0;
  for (const sizeClass of SIZE_CLASSES) {
    const dir = cacheDir(sizeClass);
    for (const file of listCacheFiles(sizeClass)) {
      if (file.startsWith(`${prefix}-`)) {
        try {
          fs.unlinkSync(path.join(dir, file));
          purged++;
        } catch (err) {
          log.warn(`[thumbnails] failed to purge ${file}`, err);
        }
      }
    }
  }
  return purged;
}

export interface ThumbnailScanResult {
  missing: Array<{ sourcePath: string; sizeClass: ThumbnailSizeClass }>;
  orphaned: string[];
}

/**
 * Read-only inspection for reconcile: which (photo, size class) pairs lack a
 * current-mtime cached thumbnail, and which cache files no longer correspond
 * to any current photo (stale-mtime leftovers from edits, or thumbnails for
 * gone-from-disk records). Never generates or deletes anything.
 */
export function scanThumbnails(existingSourcePaths: string[], goneFileNames: string[]): ThumbnailScanResult {
  const missing: ThumbnailScanResult['missing'] = [];
  const validFiles = new Set<string>();

  for (const sourcePath of existingSourcePaths) {
    let mtimeMs: number;
    try {
      mtimeMs = fs.statSync(sourcePath).mtimeMs;
    } catch {
      continue;
    }
    const prefix = basenamePrefix(sourcePath);
    for (const sizeClass of SIZE_CLASSES) {
      const expected = path.join(cacheDir(sizeClass), `${prefix}-${mtimeMs}.png`);
      validFiles.add(expected);
      if (!fs.existsSync(expected)) {
        missing.push({ sourcePath, sizeClass });
      }
    }
  }

  const prefixes = [
    ...existingSourcePaths.map(basenamePrefix),
    ...goneFileNames.map((f) => sanitize(path.basename(f, path.extname(f)))),
  ];

  const orphaned: string[] = [];
  for (const sizeClass of SIZE_CLASSES) {
    const dir = cacheDir(sizeClass);
    for (const file of listCacheFiles(sizeClass)) {
      const full = path.join(dir, file);
      if (prefixes.some((prefix) => file.startsWith(`${prefix}-`)) && !validFiles.has(full)) {
        orphaned.push(full);
      }
    }
  }

  return { missing, orphaned };
}

/** Applies a prior scanThumbnails() result: always generates missing thumbnails, purges orphaned files only if requested. */
export async function applyThumbnailScan(
  missing: ThumbnailScanResult['missing'],
  orphaned: string[],
  purgeOrphaned: boolean,
): Promise<{ generated: number; purged: number }> {
  let generated = 0;
  for (const m of missing) {
    if (await getThumbnailPath(m.sourcePath, m.sizeClass)) generated++;
  }

  let purged = 0;
  if (purgeOrphaned) {
    for (const file of orphaned) {
      try {
        fs.unlinkSync(file);
        purged++;
      } catch (err) {
        log.warn(`[thumbnails] failed to purge orphaned file ${file}`, err);
      }
    }
  }

  return { generated, purged };
}
