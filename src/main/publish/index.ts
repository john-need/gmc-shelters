import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { buildManifest } from '../export/builder';
import { GDriveClient } from './gdrive';
import type { PublishPreflightInput, PublishResult, PublishProgress, PublishDiff, PublishDiffItem } from '../../shared/ipc-types';
import type { PhotoEntry, ManifestJson } from '../export/builder';

const PUBLISH_TMP = '.publish-tmp';

export interface PreflightState {
  tmpDir: string;
  localManifest: ManifestJson;
  priorPhotoIndex: Map<string, PhotoEntry>;
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

  let historyFileCount = 0;
  let markerCount = 0;
  for (const shelter of localManifest.shelters) {
    if (shelter.historyFile) historyFileCount++;
    markerCount += shelter.mapMarkers.length;
  }

  return {
    newCount: toUpload.length,
    updatedCount: toUpdate.length,
    deleteCount: toDelete.length,
    unchangedCount,
    shelterCount: localManifest.shelters.length,
    markerCount,
    historyFileCount,
    toUpload,
    toUpdate,
    toDelete,
  };
}

export async function runPreflight(
  config: PublishPreflightInput,
  repoRoot: string,
): Promise<{ diff: PublishDiff; state: PreflightState }> {
  const tmpDir = path.join(repoRoot, PUBLISH_TMP);
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.mkdir(tmpDir, { recursive: true });

  try {
    const buildResult = await buildManifest(repoRoot, tmpDir, config.sheltersRoot);

    const userData = app.getPath('userData');
    const credPath = path.join(userData, 'credentials.json');
    const tokenPath = path.join(userData, 'gmc-gdrive-token.json');
    const client = new GDriveClient(credPath, tokenPath, config.scopes);

    const rootFolderFiles = await client.listFolder(config.rootFolderId);
    const manifestName = config.manifestName || 'shelter-manifest.json';
    const manifestFileId = rootFolderFiles.get(manifestName) ?? null;

    let priorManifest: ManifestJson | null = null;
    if (manifestFileId) {
      try {
        priorManifest = (await client.downloadJson(manifestFileId)) as ManifestJson;
      } catch {
        priorManifest = null;
      }
    }

    const priorPhotoIndex = new Map<string, PhotoEntry>();
    if (priorManifest) {
      for (const shelter of priorManifest.shelters) {
        for (const photo of shelter.photos) {
          priorPhotoIndex.set(photo.fileName, photo);
        }
      }
    }

    const diff = computeDiff(buildResult.manifest, priorManifest);

    return {
      diff,
      state: { tmpDir, localManifest: buildResult.manifest, priorPhotoIndex, client, rootFolderFiles, manifestFileId, config, diff },
    };
  } catch (err) {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

export async function runPublish(
  state: PreflightState,
  onProgress?: (p: PublishProgress) => void,
  isCancelled: () => boolean = () => false,
): Promise<PublishResult> {
  const { tmpDir, localManifest, priorPhotoIndex, client, config } = state;
  const manifestName = config.manifestName || 'shelter-manifest.json';
  const diff = state.diff;

  const result: PublishResult = {
    shelterCount: localManifest.shelters.length,
    photosUploaded: 0,
    photosUpdated: 0,
    photosSkipped: 0,
    photosFailed: 0,
    photosMissing: 0,
    skippedBuildPhotos: 0,
    manifestWritten: false,
  };

  // Pre-build slug→folderId map from the already-fetched root folder listing
  const shelterFolderIds = new Map<string, string>(state.rootFolderFiles);

  const uploadSet = new Set(diff.toUpload.map(i => i.fileName));
  const updateSet = new Set(diff.toUpdate.map(i => i.fileName));

  const totalPhotos = localManifest.shelters.reduce((s, sh) => s + sh.photos.length, 0);
  const totalOps = totalPhotos + diff.toDelete.length;
  let opIndex = 0;

  try {
    // (1) Process photos in local manifest
    outer: for (const shelter of localManifest.shelters) {
      for (const photo of shelter.photos) {
        if (isCancelled()) break outer;
        opIndex++;
        onProgress?.({ stage: 'uploading', current: opIndex, total: totalOps, fileName: photo.fileName });

        const localPath = path.join(tmpDir, photo.fileName);
        const prior = priorPhotoIndex.get(photo.fileName);

        if (uploadSet.has(photo.fileName)) {
          if (!fs.existsSync(localPath)) { result.photosMissing++; continue; }
          try {
            let folderId = shelterFolderIds.get(shelter.slug) ?? null;
            if (!folderId) {
              folderId = await client.createFolder(shelter.slug, config.rootFolderId);
              shelterFolderIds.set(shelter.slug, folderId);
            }
            const bareFileName = photo.fileName.split('/').slice(1).join('/');
            photo.driveFileId = await client.uploadFile(localPath, bareFileName, folderId, 'image/jpeg');
            result.photosUploaded++;
          } catch { result.photosFailed++; }
        } else if (updateSet.has(photo.fileName)) {
          if (!fs.existsSync(localPath)) { result.photosMissing++; continue; }
          const driveFileId = prior?.driveFileId;
          if (!driveFileId) { result.photosFailed++; continue; }
          try {
            await client.updateFile(driveFileId, localPath, 'image/jpeg');
            photo.driveFileId = driveFileId;
            result.photosUpdated++;
          } catch { result.photosFailed++; }
        } else {
          // Unchanged — carry forward driveFileId
          photo.driveFileId = prior?.driveFileId ?? null;
          result.photosSkipped++;
        }
      }
    }

    // (2) Delete removed photos from Drive (unconditional)
    for (const item of diff.toDelete) {
      if (isCancelled()) break;
      opIndex++;
      if (item.driveFileId) {
        try { await client.deleteFile(item.driveFileId); } catch { /* non-fatal */ }
      }
    }

    // (3) Upload history files (always, no user control)
    for (const shelter of localManifest.shelters) {
      if (isCancelled()) break;
      if (!shelter.historyFile) continue;
      const mdFileName = shelter.historyFile.split('/').pop()!;
      const localMdPath = path.join(tmpDir, shelter.slug, mdFileName);
      if (!fs.existsSync(localMdPath)) continue;
      try {
        let folderId = shelterFolderIds.get(shelter.slug) ?? null;
        if (!folderId) {
          folderId = await client.createFolder(shelter.slug, config.rootFolderId);
          shelterFolderIds.set(shelter.slug, folderId);
        }
        const folderFiles = await client.listFolder(folderId);
        const existingId = folderFiles.get(mdFileName) ?? null;
        if (existingId) {
          await client.updateFile(existingId, localMdPath, 'text/markdown');
        } else {
          await client.uploadFile(localMdPath, mdFileName, folderId, 'text/markdown');
        }
      } catch { /* non-fatal */ }
    }

    if (!isCancelled()) {
      // (4) Write updated manifest to Drive
      onProgress?.({ stage: 'manifest', current: totalOps, total: totalOps });
      const updatedManifestPath = path.join(tmpDir, manifestName);
      fs.writeFileSync(updatedManifestPath, JSON.stringify(localManifest, null, 2));
      try {
        if (state.manifestFileId) {
          await client.updateFile(state.manifestFileId, updatedManifestPath, 'application/json');
        } else {
          await client.uploadFile(updatedManifestPath, manifestName, config.rootFolderId, 'application/json');
        }
        result.manifestWritten = true;
      } catch (err) {
        result.manifestWritten = false;
        result.manifestError = err instanceof Error ? err.message : String(err);
      }
    }
  } finally {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }

  return result;
}
