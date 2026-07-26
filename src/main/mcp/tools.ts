import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import type { Shelter, Source, Photo } from '../../shared/ipc-types';
import { getAllShelters, getShelterById } from '../db/shelters';
import { getSourcesByShelter } from '../db/sources';
import { getPhotosByShelter } from '../db/photos';
import { readHistory } from '../fs/history';
import { photoFilePath } from '../fs/photos';

export interface DownloadResult {
  ok: boolean;
  data?: Buffer;
  mimeType?: string;
  error?: string;
}

export interface HistoryResult {
  ok: boolean;
  content?: string;
  error?: string;
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// Mirrors the renderer's default Settings → Paths value (src/renderer/pathSettings.ts
// DEFAULT_PATHS.SHELTERS_ROOT). The main process — where the MCP server runs — has no
// access to a per-install override, which lives only in renderer localStorage.
const SHELTERS_ROOT = 'shelters/';

/** Reads an original collection document by its repo-relative `resource` path (as returned by search results). */
export function downloadDocument(resource: string): DownloadResult {
  const root = app.getAppPath();
  const filePath = path.resolve(root, resource);
  if (!filePath.startsWith(path.join(root, 'collections') + path.sep)) {
    return { ok: false, error: 'resource must be a path under collections/' };
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'File not found' };
  }
  return {
    ok: true,
    data: fs.readFileSync(filePath),
    mimeType: MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
  };
}

export function listShelters(): Shelter[] {
  return getAllShelters();
}

export function getShelter(shelterId: number): Shelter | null {
  return getShelterById(shelterId);
}

export function listSources(shelterId: number): Source[] {
  return getSourcesByShelter(shelterId);
}

export function listPhotos(shelterId: number): Photo[] {
  return getPhotosByShelter(shelterId);
}

/** Reads a shelter's history markdown file, resolved under the default shelters root. */
export async function downloadHistory(shelterId: number): Promise<HistoryResult> {
  const shelter = getShelterById(shelterId);
  if (!shelter) {
    return { ok: false, error: `Shelter ${shelterId} not found` };
  }
  const historyRelPath = shelter.history ?? `${shelter.slug}/${shelter.slug}.md`;
  const result = await readHistory(historyRelPath, SHELTERS_ROOT);
  if (result.missing) {
    return { ok: false, error: 'History file not found' };
  }
  return { ok: true, content: result.content };
}

/** Reads a shelter photo's original file, resolved under the default shelters root. */
export function downloadPhoto(shelterId: number, photoId: number): DownloadResult {
  const shelter = getShelterById(shelterId);
  if (!shelter) {
    return { ok: false, error: `Shelter ${shelterId} not found` };
  }
  const photo = getPhotosByShelter(shelterId).find((p) => p.id === photoId);
  if (!photo) {
    return { ok: false, error: `Photo ${photoId} not found for shelter ${shelterId}` };
  }
  const filePath = photoFilePath(shelter.slug, photo.file_name, SHELTERS_ROOT);
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: 'File not found' };
  }
  return {
    ok: true,
    data: fs.readFileSync(filePath),
    mimeType: MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
  };
}
