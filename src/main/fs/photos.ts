import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { log } from '../logger';

export function photosDirForSlug(slug: string): string {
  return path.join(app.getAppPath(), 'shelters', slug, 'photos');
}

export function photoFilePath(slug: string, fileName: string): string {
  return path.join(photosDirForSlug(slug), fileName);
}

export async function copyPhotoToShelter(
  sourcePath: string,
  slug: string,
): Promise<string> {
  const dir = photosDirForSlug(slug);
  await fs.mkdir(dir, { recursive: true });

  const ext = path.extname(sourcePath);
  const base = path.basename(sourcePath, ext);
  const stamp = Date.now();
  const fileName = `${base}-${stamp}${ext}`;
  const dest = path.join(dir, fileName);

  await fs.copyFile(sourcePath, dest);
  log.info(`Photo copied: ${sourcePath} → ${dest}`);
  return fileName;
}

export async function deletePhotoFile(slug: string, fileName: string): Promise<void> {
  const filePath = photoFilePath(slug, fileName);
  try {
    await fs.unlink(filePath);
    log.info(`Photo deleted: ${filePath}`);
  } catch {
    // ignore if file already gone
  }
}

export async function ensureShelterDir(slug: string): Promise<void> {
  const dir = path.join(app.getAppPath(), 'shelters', slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
}
