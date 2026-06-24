import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { ExifTool } from 'exiftool-vendored';
import type { WriteTags } from 'exiftool-vendored';
import sharp from 'sharp';
import { log } from '../logger';
import type { Photo, PhotoTransformInput, FileMetadataTag } from '../../shared/ipc-types';
import { getPhotoExifDateValue } from '@shared/photo-date';

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
      CreateDate: getPhotoExifDateValue(photo.date_taken),
      Description: photo.caption,
      Headline: photo.alt_text,
      Subject: photo.description,
      // `Instructions` (XMP-photoshop) is a valid exiftool tag but absent from
      // the vendored WriteTags type, so write it via a cast.
      Instructions: photo.notes,
      Identifier: photo.id.toString(),
    } as WriteTags);
    log.info(`XMP written successfully to ${filePath}`);
  } catch (err) {
    log.error(`Failed to write XMP to ${filePath}`, err);
    throw err;
  }
}

function getString(val: unknown): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object') {
    const rawValue = (val as { rawValue?: unknown }).rawValue;
    if (typeof rawValue === 'string') return rawValue;
  }
  return String(val);
}

export async function readPhotoXmp(slug: string, fileName: string, sheltersRoot: string): Promise<Partial<Photo>> {
  const filePath = photoFilePath(slug, fileName, sheltersRoot);
  log.info(`Reading XMP from ${filePath}`);

  try {
    const tags = await exiftool.read(filePath);

    return {
      title: getString(tags.Title),
      photographer: getString(tags.Creator),
      date_taken: getString(tags.CreateDate || tags.DateCreated),
      caption: getString(tags.Description),
      alt_text: getString(tags.Headline),
      description: getString(tags.Subject),
      notes: getString((tags as Record<string, unknown>).Instructions),
    };
  } catch (err) {
    log.error(`Failed to read XMP from ${filePath}`, err);
    throw err;
  }
}

const FILE_INTRINSIC_KEYS = new Set([
  'FileSize', 'ImageWidth', 'ImageHeight', 'FileType', 'FileTypeExtension',
  'MIMEType', 'ExifToolVersion', 'FileName', 'Directory',
  'FileModifyDate', 'FileAccessDate', 'FileInodeChangeDate', 'FilePermissions',
  'EncodingProcess', 'BitsPerSample', 'ColorComponents', 'YCbCrSubSampling',
]);

function inferGroup(key: string): string {
  if (key.startsWith('GPS')) return 'GPS';
  if (key.startsWith('XMP') || key.startsWith('xmp')) return 'XMP';
  if (key.startsWith('IPTC')) return 'IPTC';
  if (key.startsWith('Composite')) return 'Composite';
  if (FILE_INTRINSIC_KEYS.has(key) || key.startsWith('File')) return 'File';
  return 'EXIF';
}

function humanizeKey(key: string): string {
  return key.replace(/([A-Z0-9]+(?=[A-Z][a-z])|[A-Z]?[a-z]+|[A-Z]+|[0-9]+)/g, (m) => m + ' ').trim();
}

export async function readPhotoFileMetadata(slug: string, fileName: string, sheltersRoot: string): Promise<FileMetadataTag[]> {
  const filePath = photoFilePath(slug, fileName, sheltersRoot);
  log.info(`Reading file metadata from ${filePath}`);
  try {
    const tags = await exiftool.read(filePath);
    const result: FileMetadataTag[] = [];
    for (const key of Object.keys(tags)) {
      if (key === 'errors' || key === 'warnings' || key === 'SourceFile') continue;
      const raw = (tags as Record<string, unknown>)[key];
      if (raw === null || raw === undefined) continue;
      const value = getString(raw);
      if (value === undefined) continue;
      const writable = !FILE_INTRINSIC_KEYS.has(key) && key !== 'Identifier';
      result.push({ group: inferGroup(key), key, label: humanizeKey(key), value, writable });
    }
    result.sort((a, b) => a.group.localeCompare(b.group) || a.key.localeCompare(b.key));
    log.info(`File metadata read: ${result.length} tags from ${filePath}`);
    return result;
  } catch (err) {
    log.error(`Failed to read file metadata from ${filePath}`, err);
    throw err;
  }
}

export async function writePhotoFileMetadata(slug: string, fileName: string, sheltersRoot: string, tags: Record<string, string>): Promise<void> {
  const filePath = photoFilePath(slug, fileName, sheltersRoot);
  log.info(`Writing file metadata to ${filePath}`);
  try {
    await exiftool.write(filePath, tags as Parameters<typeof exiftool.write>[1]);
    log.info(`File metadata written successfully to ${filePath}`);
  } catch (err) {
    log.error(`Failed to write file metadata to ${filePath}`, err);
    throw err;
  }
}

export async function transformPhoto(
  filePath: string,
  transform: PhotoTransformInput,
): Promise<void> {
  log.info(`Transforming photo: ${filePath}`, transform);
  try {
    // Bake any EXIF orientation into the pixels first. The browser honors the
    // Orientation tag when displaying, but sharp.rotate(angle) operates on raw
    // pixels and strips the tag — without this, the saved image would not match
    // the rotation the user applied on screen (and crop coords would be off).
    let pipeline = sharp(filePath).autoOrient();

    // Crop coordinates are computed by the renderer in the original,
    // unrotated/unflipped image's coordinate space, so extract must run
    // before rotate/flop while the buffer still matches that space —
    // otherwise rotate's dimension swap puts extract out of bounds.
    if (transform.crop) {
      pipeline = pipeline.extract({
        left: transform.crop.x,
        top: transform.crop.y,
        width: transform.crop.width,
        height: transform.crop.height,
      });
    }
    if (transform.rotation) {
      pipeline = pipeline.rotate(transform.rotation);
    }
    if (transform.flipped) {
      pipeline = pipeline.flop();
    }

    const buffer = await pipeline.toBuffer();
    await fs.writeFile(filePath, buffer);
    log.info(`Photo transformed successfully: ${filePath}`);
  } catch (err) {
    log.error(`Failed to transform photo: ${filePath}`, err);
    throw err;
  }
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.gif', '.bmp']);

export async function listPhotosDir(slug: string, sheltersRoot: string): Promise<string[]> {
  const dir = photosDirForSlug(slug, sheltersRoot);
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function listShelterRootImages(slug: string, sheltersRoot: string): Promise<string[]> {
  const resolvedRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(app.getAppPath(), sheltersRoot);
  const dir = path.join(resolvedRoot, slug);
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map((e) => e.name);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

export async function ensureShelterDir(slug: string, sheltersRoot: string): Promise<void> {
  const resolvedRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(app.getAppPath(), sheltersRoot);
  const dir = path.join(resolvedRoot, slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(path.join(dir, 'photos'), { recursive: true });
}
