import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { ExifTool } from 'exiftool-vendored';
import sharp from 'sharp';
import { log } from '../logger';
import type { Photo, PhotoTransformInput, FileMetadataTag } from '../../shared/ipc-types';

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

function getString(val: any): string | null {
  if (!val) return null;
  if (Array.isArray(val)) return val.join(', ');
  if (typeof val === 'object' && val.rawValue) return val.rawValue;
  return val.toString();
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
      notes: getString(tags.Instructions),
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
      if (value === null) continue;
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
    await exiftool.write(filePath, tags as any);
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

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.webp', '.gif', '.bmp']);

export async function listPhotosDir(slug: string, sheltersRoot: string): Promise<string[]> {
  const dir = photosDirForSlug(slug, sheltersRoot);
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
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
  } catch (err: any) {
    if (err.code === 'ENOENT') return [];
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
