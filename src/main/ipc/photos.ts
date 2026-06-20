import path from 'path';
import fs from 'fs/promises';
import { ipcMain, app, dialog, BrowserWindow } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { getPhotosByShelter, updatePhoto, deletePhoto, setDefaultPhoto, insertPhoto, clearDefaultPhoto, reorderPhotos } from '../db/photos';
import { getShelterById } from '../db/shelters';
import { copyPhotoToShelter, deletePhotoFile, writePhotoXmp, transformPhoto, photoFilePath, readPhotoXmp, readPhotoFileMetadata, writePhotoFileMetadata, listPhotosDir, listShelterRootImages } from '../fs/photos';
import type { PhotoReorderInput, PhotoUpdateInput, PhotoUploadInput, ReconcileApplyInput, ReconcileApplyResult } from '../../shared/ipc-types';

export function registerPhotoHandlers(): void {
  ipcMain.handle(
    CHANNELS.PHOTOS_GET_BY_SHELTER,
    (_e, { shelterId }: { shelterId: number }) => getPhotosByShelter(shelterId),
  );

  ipcMain.handle(CHANNELS.PHOTOS_UPDATE, async (_e, input: PhotoUpdateInput & { id: number; shelter_id: number; sheltersRoot: string }) => {
    const photo = updatePhoto(input);
    const shelter = getShelterById(photo.shelter_id);
    if (shelter) {
      if (input.rotation || input.flipped || input.crop) {
        const filePath = photoFilePath(shelter.slug, photo.file_name, input.sheltersRoot);
        await transformPhoto(filePath, {
          rotation: input.rotation,
          flipped: input.flipped,
          crop: input.crop,
        });
      }
      await writePhotoXmp(photo, input.sheltersRoot, shelter.slug);
    }
    return photo;
  });

  ipcMain.handle(
    CHANNELS.PHOTOS_READ_METADATA,
    (_e, { slug, fileName, sheltersRoot }: { slug: string; fileName: string; sheltersRoot: string }) =>
      readPhotoXmp(slug, fileName, sheltersRoot),
  );

  ipcMain.handle(
    CHANNELS.PHOTOS_EXPORT,
    async (event, { slug, fileName, title, sheltersRoot }: { slug: string; fileName: string; title: string; sheltersRoot: string }) => {
      const sourcePath = photoFilePath(slug, fileName, sheltersRoot);
      const ext = path.extname(fileName);
      // Prefer the editorial title for the suggested name, falling back to the on-disk basename.
      const safeTitle = title?.trim().replace(/[/\\:*?"<>|]/g, '-');
      const defaultName = `${safeTitle || path.basename(fileName, ext)}${ext}`;

      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const options = {
        title: 'Export Photo',
        defaultPath: defaultName,
        filters: [{ name: 'Image', extensions: [ext.replace(/^\./, '') || 'jpg'] }],
      };
      const result = senderWindow
        ? await dialog.showSaveDialog(senderWindow, options)
        : await dialog.showSaveDialog(options);

      if (result.canceled || !result.filePath) return null;
      await fs.copyFile(sourcePath, result.filePath);
      return result.filePath;
    },
  );

  ipcMain.handle(
    CHANNELS.PHOTOS_READ_FILE_METADATA,
    (_e, { slug, fileName, sheltersRoot }: { slug: string; fileName: string; sheltersRoot: string }) =>
      readPhotoFileMetadata(slug, fileName, sheltersRoot),
  );

  ipcMain.handle(
    CHANNELS.PHOTOS_WRITE_FILE_METADATA,
    (_e, { slug, fileName, sheltersRoot, tags }: { slug: string; fileName: string; sheltersRoot: string; tags: Record<string, string> }) =>
      writePhotoFileMetadata(slug, fileName, sheltersRoot, tags),
  );

  ipcMain.handle(CHANNELS.PHOTOS_DELETE, async (_e, { id, sheltersRoot }: { id: number; sheltersRoot: string }) => {
    const { getDb } = await import('../db/connection');
    const db = getDb();
    const photo = db.prepare('SELECT shelter_id, file_name FROM photos WHERE id = ?').get(id) as
      | { shelter_id: number; file_name: string }
      | undefined;

    // Remove the DB record and clear inbound references first so a missing or
    // unreadable file can never block record removal (Orphaned Photo Record case).
    deletePhoto(id);

    // Best-effort file removal — wrapped here in addition to deletePhotoFile's
    // own try-catch so that any unexpected error in path resolution cannot
    // reject the IPC call after the record is already gone.
    try {
      if (photo) {
        const shelter = getShelterById(photo.shelter_id);
        if (shelter) {
          await deletePhotoFile(shelter.slug, photo.file_name, sheltersRoot);
        }
      }
    } catch (err) {
      console.warn('Photo file deletion failed after record was removed:', err);
    }
  });

  ipcMain.handle(
    CHANNELS.PHOTOS_SET_DEFAULT,
    (_e, { shelterId, photoId }: { shelterId: number; photoId: number }) =>
      setDefaultPhoto(shelterId, photoId),
  );

  ipcMain.handle(
    CHANNELS.PHOTOS_REORDER,
    (_e, input: PhotoReorderInput) => reorderPhotos(input.shelterId, input.photoIds),
  );

  ipcMain.handle(CHANNELS.PHOTOS_UPLOAD, async (_e, input: PhotoUploadInput) => {
    const shelter = getShelterById(input.shelterId);
    if (!shelter) throw new Error(`Shelter ${input.shelterId} not found`);

    const fileName = await copyPhotoToShelter(input.sourcePath, shelter.slug, input.sheltersRoot);
    const relativePath = `${shelter.slug}/photos/${fileName}`;
    return insertPhoto(input.shelterId, relativePath, input.title);
  });

  ipcMain.handle(
    CHANNELS.PHOTOS_RECONCILE_SCAN,
    async (_e, { shelterId, sheltersRoot }: { shelterId: number; sheltersRoot: string }) => {
      const shelter = getShelterById(shelterId);
      if (!shelter) return { untrackedFiles: [], orphanedRecords: [] };

      const resolvedRoot = path.isAbsolute(sheltersRoot)
        ? sheltersRoot
        : path.resolve(app.getAppPath(), sheltersRoot);

      const [dbRecords, photosSubdirFiles, slugRootFiles] = await Promise.all([
        Promise.resolve(getPhotosByShelter(shelterId)),
        listPhotosDir(shelter.slug, sheltersRoot),
        listShelterRootImages(shelter.slug, sheltersRoot),
      ]);

      // DB file_name may have a "shelters/" prefix — strip it to get the canonical relative path
      const normalizeDbPath = (fileName: string) =>
        fileName.startsWith('shelters/') ? fileName.slice('shelters/'.length) : fileName;

      // DB file_name may omit "photos/" (legacy) or have a "shelters/" prefix — resolve to actual path
      const resolveDbFilePath = (fileName: string) =>
        path.join(resolvedRoot, normalizeDbPath(fileName));

      // Check each DB record's file exists at its stored path (handles any directory layout)
      const orphanChecks = await Promise.all(
        dbRecords.map(async (p) => {
          try {
            await fs.access(resolveDbFilePath(p.file_name));
            return null;
          } catch {
            return { id: p.id, fileName: path.basename(p.file_name), title: p.title };
          }
        }),
      );

      // Build relative paths for all on-disk files from both locations
      const onDiskRelPaths = [
        ...photosSubdirFiles.map((f) => `${shelter.slug}/photos/${f}`),
        ...slugRootFiles.map((f) => `${shelter.slug}/${f}`),
      ];

      // Untracked: on-disk relative paths not referenced by any DB record
      const dbRelPaths = new Set(dbRecords.map((p) => normalizeDbPath(p.file_name)));

      return {
        untrackedFiles: onDiskRelPaths
          .filter((relPath) => !dbRelPaths.has(relPath))
          .map((fileName) => ({ fileName })),
        orphanedRecords: orphanChecks.filter((r): r is NonNullable<typeof r> => r !== null),
      };
    },
  );

  ipcMain.handle(
    CHANNELS.PHOTOS_RECONCILE_APPLY,
    async (_e, { shelterId, sheltersRoot: _sheltersRoot, filesToAdd, recordIdsToDelete }: ReconcileApplyInput) => {
      const result: ReconcileApplyResult = { added: 0, deleted: 0, failed: 0, failures: [] };
      const shelter = getShelterById(shelterId);

      for (const fileName of filesToAdd) {
        try {
          if (!shelter) throw new Error(`Shelter ${shelterId} not found`);
          const relativePath = fileName;
          const title = path.basename(fileName, path.extname(fileName));
          await insertPhoto(shelterId, relativePath, title);
          result.added++;
        } catch (err: unknown) {
          result.failed++;
          result.failures.push({ item: fileName, reason: err instanceof Error ? err.message : 'unknown error' });
        }
      }

      for (const photoId of recordIdsToDelete) {
        try {
          clearDefaultPhoto(shelterId, photoId);
          deletePhoto(photoId);
          result.deleted++;
        } catch (err: unknown) {
          result.failed++;
          result.failures.push({ item: String(photoId), reason: err instanceof Error ? err.message : 'unknown error' });
        }
      }

      return result;
    },
  );
}
