import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { ExifTool } from 'exiftool-vendored';
import sharp from 'sharp';
import { log } from '../logger';
import type { Photo, PhotoTransformInput } from '../../shared/ipc-types';

const exiftool = new ExifTool({ taskTimeoutMillis: 5000 });

export function photosDirForSlug(slug: string, sheltersRoot: string): string {
  const resolvedRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(app.getAppPath(), sheltersRoot);
  return path.join(resolvedRoot, slug, 'photos');
}

export function photoFilePath(slug: string, fileName: string, sheltersRoot: string): string {
  const resolvedRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(app.getAppPath(), sheltersRoot);

  // Strip 'shelters/' from legacy filenames
  const finalFileName = fileName.startsWith('shelters/') ? fileName.replace(/^shelters\//, '') : fileName;
  return path.join(resolvedRoot, finalFileName);
}

export async function copyPhotoToShelter(
  sourcePath: string,
  slug: string,
  sheltersRoot: string,
): Promise<string> {
  const dir = photosDirForSlug(slug, sheltersRoot);
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

export async function deletePhotoFile(slug: string, fileName: string, sheltersRoot: string): Promise<void> {
  const filePath = photoFilePath(slug, fileName, sheltersRoot);
  try {
    await fs.unlink(filePath);
    log.info(`Photo deleted: ${filePath}`);
  } catch (err) {
    log.warn(`Could not delete photo file: ${filePath}`, err);
    // ignore if file already gone
  }
}

export async function deleteShelterDir(slug: string, sheltersRoot: string): Promise<void> {
  const resolvedRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(app.getAppPath(), sheltersRoot);
  const dir = path.join(resolvedRoot, slug);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    log.info(`Shelter dir deleted: ${dir}`);
  } catch (err) {
    log.warn(`Could not delete shelter dir: ${dir}`, err);
  }
}

export async function writePhotoXmp(photo: Photo, sheltersRoot: string, slug: string): Promise<void> {
  const filePath = photoFilePath(slug, photo.file_name, sheltersRoot);
  log.info(`Writing XMP to ${filePath}`);

  try {
    await exiftool.write(filePath, {
      Title: photo.title,
      Creator: photo.photographer,
      CreateDate: photo.date_taken || undefined,
      Description: photo.caption,
      Headline: photo.alt_text,
      Subject: photo.description,
      Instructions: photo.notes,
      Identifier: photo.id.toString(),
    });
    log.info(`XMP written successfully to ${filePath}`);
  } catch (err) {
    log.error(`Failed to write XMP to ${filePath}`, err);
    throw err;
  }
}

export async function readPhotoXmp(slug: string, fileName: string, sheltersRoot: string): Promise<Partial<Photo>> {
  const filePath = photoFilePath(slug, fileName, sheltersRoot);
  log.info(`Reading XMP from ${filePath}`);

  try {
    const tags = await exiftool.read(filePath);

    const getString = (val: any) => {
      if (!val) return null;
      if (Array.isArray(val)) return val.join(', ');
      if (typeof val === 'object' && val.rawValue) return val.rawValue;
      return val.toString();
    };

    return {
      title: getString(tags.Title),
      photographer: getString(tags.Creator),
      date_taken: getString(tags.CreateDate || tags.DateCreated),
      caption: getString(tags.Description),
      alt_text: getString(tags.Headline),
      description: getString(tags.Subject),
      notes: getString(tags.Instructions),
    };
  } catch (err) {
    log.error(`Failed to read XMP from ${filePath}`, err);
    throw err;
  }
}

export async function transformPhoto(
  filePath: string,
  transform: PhotoTransformInput,
): Promise<void> {
  log.info(`Transforming photo: ${filePath}`, transform);
  try {
    let pipeline = sharp(filePath);

    if (transform.rotation) {
      pipeline = pipeline.rotate(transform.rotation);
    }
    if (transform.flipped) {
      pipeline = pipeline.flop();
    }
    if (transform.crop) {
      pipeline = pipeline.extract({
        left: transform.crop.x,
        top: transform.crop.y,
        width: transform.crop.width,
        height: transform.crop.height,
      });
    }

    const buffer = await pipeline.toBuffer();
    await fs.writeFile(filePath, buffer);
    log.info(`Photo transformed successfully: ${filePath}`);
  } catch (err) {
    log.error(`Failed to transform photo: ${filePath}`, err);
    throw err;
  }
}

export async function ensureShelterDir(slug: string): Promise<void> {
  const dir = path.join(app.getAppPath(), 'shelters', slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
}
