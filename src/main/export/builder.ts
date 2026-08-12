import path from 'path';
import fs from 'fs';
import { getDb } from '../db/connection';
import { getAllBuilders } from '../db/builders';
import { makeArchitecture, type ArchitectureRow } from '../../factories/architecture';
import { makeShelterCategory, type CategoryRow } from '../../factories/shelter-category';
import { makePhoto, type PhotoRow } from '../../factories/photo';
import { makeSource, type SourceRow } from '../../factories/source';
import { makeMapMarker, type MapMarkerRow } from '../../factories/map-marker';
import { makeShelter, type ShelterRow as ShelterTableRow, type ShelterRelations } from '../../factories/shelter';
import type { Architecture } from '../../types/architecture';
import type { Builder } from '../../types/builder';
import type { ShelterCategory } from '../../types/shelter-category';
import type { Photo } from '../../types/photo';
import type { Shelter } from '../../types/shelter';
import type { ExportProgress } from '@shared/ipc-types';

export interface MapMarkerEntry {
  id: number | null;
  name: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  shelterId: number;
  startYear: number;
  endYear: number | null;
  changeType: string;
  isExtant: boolean;
  slug: string;
  defaultPhotoId: number | null;
}

export interface PhotoEntry {
  id: number;
  photographer: string;
  fileName: string;
  driveFileId?: string | null;
  caption: string;
  dateTaken: string;
  notes: string;
  created: string;
  updated: string;
  shelterId: number;
  altText: string;
  title: string;
  description: string;
}

export interface HistoryEntry {
  filePath: string;
  updated: string;
  driveFileId: string | null;
}

export interface ShelterEntry {
  id: number;
  name: string;
  slug: string;
  startYear: number;
  endYear: number | null;
  description: string;
  longitude: number | null;
  latitude: number | null;
  defaultPhotoId: number | null;
  isGmc: boolean;
  architecture: string;
  builtBy: string;
  notes: string;
  created: string;
  updated: string;
  isExtant: boolean;
  category: string;
  history: HistoryEntry | null;
  mapMarkers: MapMarkerEntry[];
  photos: PhotoEntry[];
}

export interface ManifestJson {
  created: string;
  shelters: ShelterEntry[];
}

export interface BuildResult {
  manifest: ManifestJson;
  shelterCount: number;
  photoCount: number;
  skippedPhotos: number;
}

export function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')        // headings
    .replace(/\*\*(.*?)\*\*/g, '$1')     // bold **
    .replace(/__(.*?)__/g, '$1')         // bold __
    .replace(/\*(.*?)\*/g, '$1')         // italic *
    .replace(/_(.*?)_/g, '$1')           // italic _
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
    .replace(/\[([^\]]+)\]/g, (_, inner) => {
      // bare [citation] style — remove entirely (citation-only brackets)
      return /^[A-Z]/.test(inner.trim()) ? '' : inner;
    })
    .replace(/^[-*]\s+/gm, '')           // bullet list markers
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHistoryEntry(
  dbHistory: string | null,
  slug: string,
  shelterFilesDir: string,
  tmpShelterDir: string,
): HistoryEntry | null {
  const mdFileName = dbHistory ? dbHistory.split('/').pop()! : `${slug}.md`;
  const mdPath = path.join(shelterFilesDir, mdFileName);
  try {
    const stat = fs.statSync(mdPath);
    fs.mkdirSync(tmpShelterDir, { recursive: true });
    fs.copyFileSync(mdPath, path.join(tmpShelterDir, mdFileName));
    return { filePath: dbHistory ?? `${slug}/${slug}.md`, updated: stat.mtime.toISOString(), driveFileId: null };
  } catch {
    return null; // ENOENT — no history file
  }
}

function buildPhotoEntries(
  shelterPhotos: Record<string, unknown>[],
  resolvedSheltersRoot: string,
  tmpDir: string,
  shelterId: number,
): { entries: PhotoEntry[]; skipped: number } {
  const entries: PhotoEntry[] = [];
  let skipped = 0;
  for (const p of shelterPhotos) {
    const fileName = p.file_name as string;
    if (!fs.existsSync(path.join(resolvedSheltersRoot, fileName))) { skipped++; continue; }
    const destPath = path.join(tmpDir, fileName);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(path.join(resolvedSheltersRoot, fileName), destPath);
    entries.push({
      id: p.id as number,
      photographer: (p.photographer as string) ?? '',
      fileName,
      driveFileId: null,
      caption: (p.caption as string) ?? '',
      dateTaken: (p.date_taken as string) ?? '',
      notes: (p.notes as string) ?? '',
      created: (p.created as string) ?? '',
      updated: (p.updated as string) ?? '',
      shelterId,
      altText: (p.alt_text as string) ?? '',
      title: (p.title as string) ?? '',
      description: (p.description as string) ?? '',
    });
  }
  return { entries, skipped };
}

function buildMarkerEntries(
  markersByShelter: Map<number, Record<string, unknown>[]>,
  shelterId: number,
  slug: string,
  shelterDefaultPhotoId: number | null,
): MapMarkerEntry[] {
  return (markersByShelter.get(shelterId) ?? []).map((m) => ({
    id: m.id as number | null,
    name: (m.name as string) ?? '',
    latitude: m.latitude as number,
    longitude: m.longitude as number,
    notes: (m.notes as string | null) ?? null,
    shelterId,
    startYear: m.start_year as number,
    endYear: (m.end_year as number | null) ?? null,
    changeType: (m.change_type as string) ?? 'Original',
    isExtant: Boolean(m.is_extant),
    slug,
    defaultPhotoId: shelterDefaultPhotoId,
  }));
}

/**
 * Builds the legacy `shelter-manifest.json` shape. Kept as-is for
 * `src/main/publish/index.ts`, which diffs against this shape (including
 * `driveFileId` tracking) to sync to Google Drive — a separate concern from
 * the Export button's `shelters.json` (see `buildSheltersJson` below).
 */
export async function buildManifest(repoRoot: string, tmpDir: string, sheltersRoot = 'shelters/'): Promise<BuildResult> {
  const db = getDb();

  const resolvedSheltersRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(repoRoot, sheltersRoot);

  const shelterRows = db.prepare(`
    SELECT s.id, s.name, s.slug, s.start_year, s.end_year, s.description,
           s.default_photo_id, s.is_gmc, s.notes, s.created, s.updated,
           s.is_extant, s.show_on_web, s.history,
           a.name          AS architecture,
           c.category_name AS category,
           b.name          AS built_by
    FROM shelters s
    LEFT JOIN architectures a ON a.id = s.architecture_id
    LEFT JOIN categories    c ON c.id = s.category_id
    LEFT JOIN builders      b ON b.id = s.builder_id
    WHERE s.show_on_web = 1
    ORDER BY s.id
  `).all() as Record<string, unknown>[];

  const photoRows = db.prepare(`
    SELECT id, photographer, file_name, caption, date_taken, notes,
           created, updated, shelter_id, alt_text, title, description
    FROM photos
    WHERE include_in_post = 1
    ORDER BY shelter_id, sort_order, id
  `).all() as Record<string, unknown>[];

  // Queries map_markers, not timelines — timelines was removed in migration 004.
  const markerRows = db.prepare(`
    SELECT id, shelter_id, latitude, longitude, name, start_year, end_year,
           change_type, is_extant, notes
    FROM map_markers
    ORDER BY shelter_id, start_year
  `).all() as Record<string, unknown>[];

  const photosByShelter = new Map<number, typeof photoRows>();
  for (const p of photoRows) {
    const sid = p.shelter_id as number;
    if (!photosByShelter.has(sid)) photosByShelter.set(sid, []);
    photosByShelter.get(sid)!.push(p);
  }

  const markersByShelter = new Map<number, typeof markerRows>();
  for (const m of markerRows) {
    const sid = m.shelter_id as number;
    if (!markersByShelter.has(sid)) markersByShelter.set(sid, []);
    markersByShelter.get(sid)!.push(m);
  }

  let totalPhotos = 0;
  let skippedPhotos = 0;
  const shelters: ShelterEntry[] = [];

  for (const row of shelterRows) {
    const slug = row.slug as string;
    const shelterId = row.id as number;
    const shelterDefaultPhotoId = row.default_photo_id as number | null;
    const tmpShelterDir = path.join(tmpDir, slug);

    const history = buildHistoryEntry(
      (row.history as string | null) ?? null,
      slug,
      path.join(resolvedSheltersRoot, slug),
      tmpShelterDir,
    );

    const { entries: photoEntries, skipped } = buildPhotoEntries(
      photosByShelter.get(shelterId) ?? [],
      resolvedSheltersRoot,
      tmpDir,
      shelterId,
    );
    totalPhotos += photoEntries.length;
    skippedPhotos += skipped;

    const markers = buildMarkerEntries(markersByShelter, shelterId, slug, shelterDefaultPhotoId);
    const firstMarker = markers[0] ?? null;

    shelters.push({
      id: shelterId,
      name: row.name as string,
      slug,
      startYear: row.start_year as number,
      endYear: (row.end_year as number | null) ?? null,
      description: stripMarkdown((row.description as string) ?? ''),
      longitude: firstMarker ? firstMarker.longitude : null,
      latitude: firstMarker ? firstMarker.latitude : null,
      defaultPhotoId: shelterDefaultPhotoId,
      isGmc: Boolean(row.is_gmc),
      architecture: (row.architecture as string) ?? '',
      builtBy: (row.built_by as string) ?? '',
      notes: (row.notes as string) ?? '',
      created: (row.created as string) ?? '',
      updated: (row.updated as string) ?? '',
      isExtant: Boolean(row.is_extant),
      category: (row.category as string) ?? '',
      history,
      mapMarkers: markers,
      photos: photoEntries,
    });
  }

  const manifest: ManifestJson = { created: new Date().toISOString(), shelters };
  fs.writeFileSync(path.join(tmpDir, 'shelter-manifest.json'), JSON.stringify(manifest, null, 2));
  return { manifest, shelterCount: shelters.length, photoCount: totalPhotos, skippedPhotos };
}

// ---------------------------------------------------------------------------
// shelters.json — the Export button's output (spec 020-shelter-export-json).
// Built through src/factories/ + src/types/, independent of buildManifest()
// above: every shelter/photo, no show_on_web/include_in_post filtering, and
// a fully-nested shape via makeShelter.
// ---------------------------------------------------------------------------

export interface SheltersJson {
  shelters: Shelter[];
  architectures: Architecture[];
  shelterCategories: ShelterCategory[];
  builders: Builder[];
}

export interface SheltersJsonResult {
  manifest: SheltersJson;
  shelterCount: number;
  photoCount: number;
  skippedPhotos: number;
}

function copyHistoryFile(
  dbHistory: string | null,
  slug: string,
  shelterFilesDir: string,
  tmpShelterDir: string,
): string | null {
  const mdFileName = dbHistory ? dbHistory.split('/').pop()! : `${slug}.md`;
  const mdPath = path.join(shelterFilesDir, mdFileName);
  try {
    fs.statSync(mdPath);
    fs.mkdirSync(tmpShelterDir, { recursive: true });
    fs.copyFileSync(mdPath, path.join(tmpShelterDir, mdFileName));
    return dbHistory ?? `${slug}/${slug}.md`;
  } catch {
    return null; // ENOENT — no history file
  }
}

function copyPhotoFiles(
  rows: PhotoRow[],
  resolvedSheltersRoot: string,
  tmpDir: string,
): { photos: Photo[]; skipped: number } {
  const photos: Photo[] = [];
  let skipped = 0;
  for (const row of rows) {
    if (!fs.existsSync(path.join(resolvedSheltersRoot, row.file_name))) { skipped++; continue; }
    const destPath = path.join(tmpDir, row.file_name);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(path.join(resolvedSheltersRoot, row.file_name), destPath);
    photos.push(makePhoto(row));
  }
  return { photos, skipped };
}

function groupByShelterId<T extends { shelter_id: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();
  for (const row of rows) {
    if (!grouped.has(row.shelter_id)) grouped.set(row.shelter_id, []);
    grouped.get(row.shelter_id)!.push(row);
  }
  return grouped;
}

export async function buildSheltersJson(
  repoRoot: string,
  tmpDir: string,
  sheltersRoot = 'shelters/',
  onProgress?: (p: ExportProgress) => void,
  isCancelled: () => boolean = () => false,
): Promise<SheltersJsonResult> {
  const db = getDb();

  const resolvedSheltersRoot = path.isAbsolute(sheltersRoot)
    ? sheltersRoot
    : path.resolve(repoRoot, sheltersRoot);

  const architectures = (db.prepare('SELECT * FROM architectures').all() as ArchitectureRow[]).map(makeArchitecture);
  const architectureById = new Map(architectures.map((a) => [a.id, a]));

  const shelterCategories = (db.prepare('SELECT * FROM categories').all() as CategoryRow[]).map(makeShelterCategory);
  const categoryById = new Map(shelterCategories.map((c) => [c.id, c]));

  const builders = getAllBuilders();
  const builderById = new Map(builders.map((b) => [b.id, b]));

  const shelterRows = db.prepare(`
    SELECT id, name, start_year, end_year, description, slug, default_photo_id, is_gmc,
           architecture_id, builder_id, notes, created, updated, category_id, show_on_web, history
    FROM shelters
    ORDER BY id
  `).all() as (ShelterTableRow & { architecture_id: number | null; builder_id: number | null; category_id: number | null })[];

  const photoRows = db.prepare(`
    SELECT id, photographer, file_name, caption, date_taken, notes, created, updated,
           shelter_id, alt_text, title, description, include_in_post, sort_order
    FROM photos
    ORDER BY shelter_id, sort_order, created, id
  `).all() as PhotoRow[];

  const sourceRows = db.prepare(`
    SELECT s.id, s.type, s.author, s.title, s.container_title, s.container_author, s.editor,
           s.edition, s.volume, s.issue, s.pages, s.publisher, s.place, s.year, s.date, s.url,
           s.access_date, s.archive, s.archive_location, s.created, s.updated,
           ss.shelter_id AS shelter_id
    FROM sources s
    JOIN shelter_sources ss ON ss.source_id = s.id
    ORDER BY ss.shelter_id, s.author, s.year
  `).all() as (SourceRow & { shelter_id: number })[];

  const markerRows = db.prepare(`
    SELECT id, shelter_id, latitude, longitude, name, start_year, end_year, change_type,
           notes, is_extant, photo_id, created, updated
    FROM map_markers
    ORDER BY shelter_id, start_year
  `).all() as MapMarkerRow[];

  const photosByShelter = groupByShelterId(photoRows);
  const sourcesByShelter = groupByShelterId(sourceRows);
  const markersByShelter = groupByShelterId(markerRows);

  let totalPhotos = 0;
  let skippedPhotos = 0;
  const shelters: Shelter[] = [];

  for (const [index, row] of shelterRows.entries()) {
    if (isCancelled()) break;

    const slug = row.slug;
    const tmpShelterDir = path.join(tmpDir, slug);

    const history = copyHistoryFile(row.history, slug, path.join(resolvedSheltersRoot, slug), tmpShelterDir);

    const { photos, skipped } = copyPhotoFiles(
      photosByShelter.get(row.id) ?? [],
      resolvedSheltersRoot,
      tmpDir,
    );
    totalPhotos += photos.length;
    skippedPhotos += skipped;

    const sources = (sourcesByShelter.get(row.id) ?? []).map(makeSource);
    const mapMarkers = (markersByShelter.get(row.id) ?? []).map(makeMapMarker);

    const relations: ShelterRelations = {
      architecture: row.architecture_id !== null ? (architectureById.get(row.architecture_id) ?? null) : null,
      builder: row.builder_id !== null ? (builderById.get(row.builder_id) ?? null) : null,
      category: row.category_id !== null ? (categoryById.get(row.category_id) ?? null) : null,
      photos,
      sources,
      mapMarkers,
    };

    shelters.push(makeShelter({
      id: row.id,
      name: row.name,
      start_year: row.start_year,
      end_year: row.end_year,
      description: row.description,
      slug: row.slug,
      default_photo_id: row.default_photo_id,
      is_gmc: row.is_gmc,
      notes: row.notes,
      created: row.created,
      updated: row.updated,
      show_on_web: row.show_on_web,
      history,
    }, relations));

    onProgress?.({ stage: 'building', current: index + 1, total: shelterRows.length, shelterName: row.name });
  }

  const manifest: SheltersJson = { shelters, architectures, shelterCategories, builders };
  fs.writeFileSync(path.join(tmpDir, 'shelters.json'), JSON.stringify(manifest, null, 2));
  return { manifest, shelterCount: shelters.length, photoCount: totalPhotos, skippedPhotos };
}
