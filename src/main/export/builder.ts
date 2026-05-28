import path from 'path';
import fs from 'fs';
import { getDb } from '../db/connection';

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
  history: string | null;
  historyFile: string | null;
  historyUpdated: string | null;
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
    ORDER BY id
  `).all() as Record<string, unknown>[];

  // Queries map_markers, not timelines — timelines was removed in migration 004.
  // scripts/build_dist_package.py still references timelines and is broken against current schema.
  const markerRows = db.prepare(`
    SELECT id, shelter_id, latitude, longitude, name, start_year, end_year,
           change_type, is_extant, notes
    FROM map_markers
    ORDER BY shelter_id, start_year
  `).all() as Record<string, unknown>[];

  // Group photos and markers by shelter_id
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
    const shelterFilesDir = path.join(resolvedSheltersRoot, slug);
    const tmpShelterDir = path.join(tmpDir, slug);

    // History file — use DB history column as the relative path reference
    const dbHistory = (row.history as string | null) ?? null;
    const mdFileName = dbHistory ? dbHistory.split('/').pop()! : `${slug}.md`;
    const mdPath = path.join(shelterFilesDir, mdFileName);
    let historyFile: string | null = null;
    let historyUpdated: string | null = null;
    try {
      const stat = fs.statSync(mdPath);
      historyFile = dbHistory ?? `${slug}/${slug}.md`;
      historyUpdated = stat.mtime.toISOString();
      fs.mkdirSync(tmpShelterDir, { recursive: true });
      fs.copyFileSync(mdPath, path.join(tmpShelterDir, mdFileName));
    } catch {
      // ENOENT — no history file
    }

    // Photos
    const shelterPhotos = photosByShelter.get(shelterId) ?? [];
    const photoEntries: PhotoEntry[] = [];
    for (const p of shelterPhotos) {
      const fileName = p.file_name as string;
      const photoPath = path.join(resolvedSheltersRoot, fileName);
      if (!fs.existsSync(photoPath)) {
        skippedPhotos++;
        continue;
      }
      fs.mkdirSync(tmpShelterDir, { recursive: true });
      fs.copyFileSync(photoPath, path.join(tmpDir, fileName));
      totalPhotos++;
      photoEntries.push({
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

    // Map markers — denormalise slug + defaultPhotoId from shelter
    const shelterDefaultPhotoId = row.default_photo_id as number | null;
    const markers: MapMarkerEntry[] = (markersByShelter.get(shelterId) ?? []).map((m) => ({
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

    // Primary lat/lon from first marker
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
      history: dbHistory,
      historyFile,
      historyUpdated,
      mapMarkers: markers,
      photos: photoEntries,
    });
  }

  const manifest: ManifestJson = {
    created: new Date().toISOString(),
    shelters,
  };

  fs.writeFileSync(path.join(tmpDir, 'shelter-manifest.json'), JSON.stringify(manifest, null, 2));

  return { manifest, shelterCount: shelters.length, photoCount: totalPhotos, skippedPhotos };
}
