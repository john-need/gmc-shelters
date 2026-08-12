import path from 'path';
import fs from 'fs';
import { dialog, BrowserWindow } from 'electron';
import { buildSheltersJson } from './builder';
import { createZip } from './zipper';
import type { ExportResult, ExportProgress } from '@shared/ipc-types';
import { log } from '../logger';

const EXPORT_TMP = '.export-tmp';

async function cleanup(repoRoot: string, zipTmpPath: string): Promise<void> {
  const tmpDir = path.join(repoRoot, EXPORT_TMP);
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.rm(zipTmpPath, { force: true }).catch(() => undefined);
}

export async function runExport(
  repoRoot: string,
  senderWindow: BrowserWindow,
  onProgress?: (p: ExportProgress) => void,
  isCancelled: () => boolean = () => false,
): Promise<ExportResult> {
  const tmpDir = path.join(repoRoot, EXPORT_TMP);
  const zipTmpPath = path.join(repoRoot, `${EXPORT_TMP}.zip`);

  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.mkdir(tmpDir, { recursive: true });

  try {
    const buildResult = await buildSheltersJson(repoRoot, tmpDir, undefined, onProgress, isCancelled);

    if (isCancelled()) {
      await cleanup(repoRoot, zipTmpPath);
      return {
        cancelled: true,
        savedTo: null,
        shelterCount: buildResult.shelterCount,
        photoCount: buildResult.photoCount,
        skippedPhotos: buildResult.skippedPhotos,
      };
    }

    onProgress?.({ stage: 'zipping', current: 0, total: 1 });
    await createZip(tmpDir, zipTmpPath);

    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const defaultFilename = `gmc-shelters-export-${y}${m}${d}.zip`;

    onProgress?.({ stage: 'saving', current: 0, total: 1 });
    const { canceled, filePath } = await dialog.showSaveDialog(senderWindow, {
      title: 'Save export as',
      defaultPath: defaultFilename,
      filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
    });

    if (canceled || !filePath) {
      await cleanup(repoRoot, zipTmpPath);
      return {
        cancelled: true,
        savedTo: null,
        shelterCount: buildResult.shelterCount,
        photoCount: buildResult.photoCount,
        skippedPhotos: buildResult.skippedPhotos,
      };
    }

    const savedTo = filePath;

    await fs.promises.copyFile(zipTmpPath, savedTo);
    await cleanup(repoRoot, zipTmpPath);

    return {
      cancelled: false,
      savedTo,
      shelterCount: buildResult.shelterCount,
      photoCount: buildResult.photoCount,
      skippedPhotos: buildResult.skippedPhotos,
    };
  } catch (err) {
    log.error('[export] runExport: threw', err);
    await cleanup(repoRoot, zipTmpPath);
    throw err;
  }
}
