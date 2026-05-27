import path from 'path';
import fs from 'fs';
import { dialog, BrowserWindow } from 'electron';
import { buildManifest } from './builder';
import { createZip } from './zipper';
import type { ExportResult } from '@shared/ipc-types';

const EXPORT_TMP = '.export-tmp';

async function cleanup(repoRoot: string, zipTmpPath: string): Promise<void> {
  const tmpDir = path.join(repoRoot, EXPORT_TMP);
  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.rm(zipTmpPath, { force: true }).catch(() => undefined);
}

export async function runExport(repoRoot: string, senderWindow: BrowserWindow): Promise<ExportResult> {
  const tmpDir = path.join(repoRoot, EXPORT_TMP);
  const zipTmpPath = path.join(repoRoot, `${EXPORT_TMP}.zip`);

  await fs.promises.rm(tmpDir, { recursive: true, force: true });
  await fs.promises.mkdir(tmpDir, { recursive: true });

  try {
    const buildResult = await buildManifest(repoRoot, tmpDir);
    await createZip(tmpDir, zipTmpPath);

    const { canceled, filePaths } = await dialog.showOpenDialog(senderWindow, {
      properties: ['openDirectory'],
      title: 'Choose destination folder for export',
    });

    if (canceled || !filePaths || filePaths.length === 0) {
      await cleanup(repoRoot, zipTmpPath);
      return {
        cancelled: true,
        savedTo: null,
        shelterCount: buildResult.shelterCount,
        photoCount: buildResult.photoCount,
        skippedPhotos: buildResult.skippedPhotos,
      };
    }

    const destFolder = filePaths[0];
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const filename = `gmc-shelters-export-${y}${m}${d}.zip`;
    const savedTo = path.join(destFolder, filename);

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
    await cleanup(repoRoot, zipTmpPath);
    throw err;
  }
}
