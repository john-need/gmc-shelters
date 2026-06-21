import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { buildManifest } from '../export/builder';
import { GDriveClient } from './gdrive';
import type { PublishPreflightInput, PublishResult, PublishProgress, PublishDiff, PublishDiffItem } from '../../shared/ipc-types';
import type { PhotoEntry, HistoryEntry, ManifestJson } from '../export/builder';

const PUBLISH_TMP = '.publish-tmp';

// A stored driveFileId can go stale when a file is deleted/trashed on Drive
// out-of-band. Drive then returns a 404 "File not found: <id>." on get/update.
// We detect that so callers can re-create the file instead of failing.
function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: number | string; status?: number; message?: string };
  if (e.code === 404 || e.code === '404' || e.status === 404) return true;
  return typeof e.message === 'string' && /not found/i.test(e.message);
}

export interface PreflightState {
  tmpDir: string;
  localManifest: ManifestJson;
  priorPhotoIndex: Map<string, PhotoEntry>;
  priorHistoryIndex: Map<string, HistoryEntry>;
  client: GDriveClient;
  rootFolderFiles: Map<string, string>;
  manifestFileId: string | null;
  config: PublishPreflightInput;
  diff: PublishDiff;
}

export function computeDiff(
  localManifest: ManifestJson,
  priorManifest: ManifestJson | null,
): PublishDiff {
  const priorPhotoIndex = new Map<string, PhotoEntry>();
  if (priorManifest) {
    for (const shelter of priorManifest.shelters) {
      for (const photo of shelter.photos) {
        priorPhotoIndex.set(photo.fileName, photo);
      }
    }
  }

  const localFileNames = new Set<string>();
  const toUpload: PublishDiffItem[] = [];
  const toUpdate: PublishDiffItem[] = [];
  let unchangedCount = 0;

  for (const shelter of localManifest.shelters) {
    for (const photo of shelter.photos) {
      localFileNames.add(photo.fileName);
      const prior = priorPhotoIndex.get(photo.fileName);

      if (!prior) {
        toUpload.push({ fileName: photo.fileName, shelterSlug: shelter.slug, updated: photo.updated });
      } else if (!prior.updated || photo.updated > prior.updated) {
        toUpdate.push({
          fileName: photo.fileName,
          shelterSlug: shelter.slug,
          updated: photo.updated,
          priorUpdated: prior.updated,
          driveFileId: prior.driveFileId,
        });
      } else {
        unchangedCount++;
      }
    }
  }

  const toDelete: PublishDiffItem[] = [];
  for (const [fileName, photo] of priorPhotoIndex) {
    if (!localFileNames.has(fileName)) {
      toDelete.push({ fileName, shelterSlug: fileName.split('/')[0], driveFileId: photo.driveFileId });
    }
  }

  const priorHistoryBySlug = new Map<string, HistoryEntry>();
  if (priorManifest) {
    for (const shelter of priorManifest.shelters) {
      if (shelter.history && typeof shelter.history === 'object') {
        priorHistoryBySlug.set(shelter.slug, shelter.history);
      }
    }
  }

  let historyToUploadCount = 0;
  let historyUnchangedCount = 0;
  let markerCount = 0;
  for (const shelter of localManifest.shelters) {
    if (shelter.history) {
      const prior = priorHistoryBySlug.get(shelter.slug);
      if (!prior || shelter.history.updated > prior.updated) {
        historyToUploadCount++;
      } else {
        historyUnchangedCount++;
      }
    }
    markerCount += shelter.mapMarkers.length;
  }

  return {
    newCount: toUpload.length,
    updatedCount: toUpdate.length,
    deleteCount: toDelete.length,
    unchangedCount,
    shelterCount: localManifest.shelters.length,
    markerCount,
    historyToUploadCount,
    historyUnchangedCount,
    toUpload,
    toUpdate,
    toDelete,
  };
}

export async function runPreflight(
  config: PublishPreflightInput,
  repoRoot: string,
  onProgress?: (p: PublishProgress) => void,
): Promise<{ diff: PublishDiff; state: PreflightState }> {
  const tmpDir = path.join(repoRoot, PUBLISH_TMP);
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.mkdir(tmpDir, { recursive: true });

  try {
    // Pre-flight is not an upload — emit stated stages so the user knows what's
    // happening during the "Computing diff…" wait.
    onProgress?.({ stage: 'building', current: 0, total: 0 });
    const buildResult = await buildManifest(repoRoot, tmpDir, config.sheltersRoot);

    const userData = app.getPath('userData');
    const credPath = path.join(userData, 'credentials.json');
    const tokenPath = path.join(userData, 'gmc-gdrive-token.json');
    const client = new GDriveClient(credPath, tokenPath, config.scopes);

    onProgress?.({ stage: 'fetching', current: 0, total: 0 });
    const rootFolderFiles = await client.listFolder(config.rootFolderId);
    const manifestFileId = rootFolderFiles.get('shelter-manifest.json') ?? null;

    let priorManifest: ManifestJson | null = null;
    if (manifestFileId) {
      try {
        priorManifest = (await client.downloadJson(manifestFileId)) as ManifestJson;
      } catch {
        priorManifest = null;
      }
    }

    const priorPhotoIndex = new Map<string, PhotoEntry>();
    const priorHistoryIndex = new Map<string, HistoryEntry>();
    if (priorManifest) {
      for (const shelter of priorManifest.shelters) {
        for (const photo of shelter.photos) {
          priorPhotoIndex.set(photo.fileName, photo);
        }
        if (shelter.history && typeof shelter.history === 'object') {
          priorHistoryIndex.set(shelter.slug, shelter.history);
        }
      }
    }

    const diff = computeDiff(buildResult.manifest, priorManifest);

    return {
      diff,
      state: { tmpDir, localManifest: buildResult.manifest, priorPhotoIndex, priorHistoryIndex, client, rootFolderFiles, manifestFileId, config, diff },
    };
  } catch (err) {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

async function ensureShelterFolder(
  slug: string,
  shelterFolderIds: Map<string, string>,
  client: GDriveClient,
  rootFolderId: string,
): Promise<string> {
  let folderId = shelterFolderIds.get(slug) ?? null;
  if (!folderId) {
    folderId = await client.createFolder(slug, rootFolderId);
    shelterFolderIds.set(slug, folderId);
  }
  return folderId;
}

async function processAllPhotos(
  localManifest: ManifestJson,
  priorPhotoIndex: Map<string, PhotoEntry>,
  uploadSet: Set<string>,
  updateSet: Set<string>,
  shelterFolderIds: Map<string, string>,
  client: GDriveClient,
  config: PublishPreflightInput,
  tmpDir: string,
  totalUploads: number,
  uploaded: { count: number },
  result: PublishResult,
  isCancelled: () => boolean,
  onProgress?: (p: PublishProgress) => void,
): Promise<void> {
  outer: for (const shelter of localManifest.shelters) {
    for (const photo of shelter.photos) {
      if (isCancelled()) break outer;
      const localPath = path.join(tmpDir, photo.fileName);
      const prior = priorPhotoIndex.get(photo.fileName);

      if (uploadSet.has(photo.fileName)) {
        uploaded.count++;
        onProgress?.({ stage: 'uploading', current: uploaded.count, total: totalUploads, itemKind: 'photo', action: 'create', fileName: photo.fileName });
        if (!fs.existsSync(localPath)) { result.photosMissing++; continue; }
        try {
          const folderId = await ensureShelterFolder(shelter.slug, shelterFolderIds, client, config.rootFolderId);
          photo.driveFileId = await client.uploadFile(localPath, photo.fileName.split('/').slice(1).join('/'), folderId, 'image/jpeg');
          result.photosUploaded++;
        } catch { result.photosFailed++; }

      } else if (updateSet.has(photo.fileName)) {
        uploaded.count++;
        onProgress?.({ stage: 'uploading', current: uploaded.count, total: totalUploads, itemKind: 'photo', action: 'update', fileName: photo.fileName });
        if (!fs.existsSync(localPath)) { result.photosMissing++; continue; }
        const driveFileId = prior?.driveFileId;
        if (!driveFileId) { result.photosFailed++; continue; }
        try {
          await client.updateFile(driveFileId, localPath, 'image/jpeg');
          photo.driveFileId = driveFileId;
          result.photosUpdated++;
        } catch (err) {
          if (!isNotFoundError(err)) { result.photosFailed++; continue; }
          // Drive file removed out-of-band — re-upload as new.
          try {
            const folderId = await ensureShelterFolder(shelter.slug, shelterFolderIds, client, config.rootFolderId);
            photo.driveFileId = await client.uploadFile(localPath, photo.fileName.split('/').slice(1).join('/'), folderId, 'image/jpeg');
            result.photosUploaded++;
          } catch { result.photosFailed++; }
        }
      } else {
        photo.driveFileId = prior?.driveFileId ?? null;
        result.photosSkipped++;
      }
    }
  }
}

async function uploadHistoryFiles(
  localManifest: ManifestJson,
  state: PreflightState,
  shelterFolderIds: Map<string, string>,
  client: GDriveClient,
  tmpDir: string,
  totalUploads: number,
  uploaded: { count: number },
  isCancelled: () => boolean,
  onProgress?: (p: PublishProgress) => void,
): Promise<void> {
  for (const shelter of localManifest.shelters) {
    if (isCancelled()) break;
    if (!shelter.history) continue;
    const prior = state.priorHistoryIndex.get(shelter.slug);
    if (prior && shelter.history.updated <= prior.updated) {
      shelter.history.driveFileId = prior.driveFileId;
      continue;
    }
    uploaded.count++;
    const mdFileName = shelter.history.filePath.split('/').pop()!;
    onProgress?.({ stage: 'uploading', current: uploaded.count, total: totalUploads, itemKind: 'history', action: prior?.driveFileId ? 'update' : 'create', fileName: mdFileName });
    const localMdPath = path.join(tmpDir, shelter.slug, mdFileName);
    if (!fs.existsSync(localMdPath)) continue;
    try {
      const folderId = await ensureShelterFolder(shelter.slug, shelterFolderIds, client, state.config.rootFolderId);
      let updatedTracked = false;
      if (prior?.driveFileId) {
        try {
          await client.updateFile(prior.driveFileId, localMdPath, 'text/markdown');
          shelter.history.driveFileId = prior.driveFileId;
          updatedTracked = true;
        } catch (err) {
          if (!isNotFoundError(err)) throw err; // tracked file gone on Drive — fall through
        }
      }
      if (!updatedTracked) {
        const existingId = (await client.listFolder(folderId)).get(mdFileName) ?? null;
        if (existingId) {
          await client.updateFile(existingId, localMdPath, 'text/markdown');
          shelter.history.driveFileId = existingId;
        } else {
          shelter.history.driveFileId = await client.uploadFile(localMdPath, mdFileName, folderId, 'text/markdown');
        }
      }
    } catch { /* non-fatal */ }
  }
}

async function writeManifestToGDrive(
  state: PreflightState,
  client: GDriveClient,
  localManifest: ManifestJson,
  tmpDir: string,
  totalUploads: number,
  result: PublishResult,
  onProgress?: (p: PublishProgress) => void,
): Promise<void> {
  const manifestName = 'shelter-manifest.json';
  onProgress?.({ stage: 'manifest', current: totalUploads, total: totalUploads, itemKind: 'manifest' });
  const updatedManifestPath = path.join(tmpDir, manifestName);
  fs.writeFileSync(updatedManifestPath, JSON.stringify(localManifest, null, 2));
  try {
    if (state.manifestFileId) {
      try {
        await client.updateFile(state.manifestFileId, updatedManifestPath, 'application/json');
      } catch (err) {
        if (!isNotFoundError(err)) throw err; // tracked manifest gone — re-create
        await client.uploadFile(updatedManifestPath, manifestName, state.config.rootFolderId, 'application/json');
      }
    } else {
      await client.uploadFile(updatedManifestPath, manifestName, state.config.rootFolderId, 'application/json');
    }
    result.manifestWritten = true;
  } catch (err) {
    result.manifestWritten = false;
    result.manifestError = err instanceof Error ? err.message : String(err);
  }
}

export async function runPublish(
  state: PreflightState,
  onProgress?: (p: PublishProgress) => void,
  isCancelled: () => boolean = () => false,
): Promise<PublishResult> {
  const { tmpDir, localManifest, priorPhotoIndex, client, config } = state;
  const diff = state.diff;

  const result: PublishResult = {
    shelterCount: localManifest.shelters.length,
    photosUploaded: 0, photosUpdated: 0, photosSkipped: 0,
    photosFailed: 0, photosMissing: 0, skippedBuildPhotos: 0,
    manifestWritten: false,
  };

  const shelterFolderIds = new Map<string, string>(state.rootFolderFiles);
  const uploadSet = new Set(diff.toUpload.map(i => i.fileName));
  const updateSet = new Set(diff.toUpdate.map(i => i.fileName));
  // Progress denominator: new + updated photos + changed history files + 1 manifest write.
  const totalUploads = diff.newCount + diff.updatedCount + diff.historyToUploadCount + 1;
  const uploaded = { count: 0 };

  try {
    // (1) Delete removed photos first — not an upload, shown as its own stage.
    if (diff.toDelete.length > 0) {
      onProgress?.({ stage: 'deleting', current: uploaded.count, total: totalUploads, deleteCount: diff.toDelete.length });
      for (const item of diff.toDelete) {
        if (isCancelled()) break;
        if (item.driveFileId) {
          try { await client.deleteFile(item.driveFileId); } catch { /* non-fatal */ }
        }
      }
    }

    // (2) Upload / update / skip photos.
    await processAllPhotos(
      localManifest, priorPhotoIndex, uploadSet, updateSet,
      shelterFolderIds, client, config, tmpDir,
      totalUploads, uploaded, result, isCancelled, onProgress,
    );

    // (3) Upload changed history markdown files.
    await uploadHistoryFiles(
      localManifest, state, shelterFolderIds, client,
      tmpDir, totalUploads, uploaded, isCancelled, onProgress,
    );

    // (4) Write updated manifest — final upload, pins bar to 100%.
    if (!isCancelled()) {
      await writeManifestToGDrive(state, client, localManifest, tmpDir, totalUploads, result, onProgress);
    }
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }

  return result;
}
