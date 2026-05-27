import path from 'path';
import os from 'os';
import fs from 'fs';

jest.mock('./builder');
jest.mock('./zipper');
jest.mock('electron');
jest.mock('fs', () => {
  const actual = jest.requireActual('fs') as typeof import('fs');
  return {
    ...actual,
    copyFile: jest.fn(actual.copyFile),
    promises: {
      ...actual.promises,
      copyFile: jest.fn(),
      rm: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
    },
  };
});

import { runExport } from './index';
import { buildManifest } from './builder';
import { createZip } from './zipper';
import { dialog, BrowserWindow } from 'electron';
import fsMock from 'fs';

const mockBuildManifest = buildManifest as jest.Mock;
const mockCreateZip = createZip as jest.Mock;
const mockDialog = dialog as jest.Mocked<typeof dialog>;
const mockCopyFile = (fsMock.promises as jest.Mocked<typeof fsMock.promises>).copyFile as jest.Mock;
const mockRm = (fsMock.promises as jest.Mocked<typeof fsMock.promises>).rm as jest.Mock;

describe('runExport', () => {
  let repoRoot: string;
  let senderWindow: InstanceType<typeof BrowserWindow>;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-test-'));
    senderWindow = new BrowserWindow();

    mockBuildManifest.mockResolvedValue({
      manifest: { created: new Date().toISOString(), shelters: [] },
      shelterCount: 5,
      photoCount: 12,
      skippedPhotos: 1,
    });
    mockCreateZip.mockResolvedValue(undefined);
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/Users/test/Downloads'] });
    mockCopyFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('calls builder, zipper, dialog in sequence on success path', async () => {
    await runExport(repoRoot, senderWindow);
    expect(mockBuildManifest).toHaveBeenCalledTimes(1);
    expect(mockCreateZip).toHaveBeenCalledTimes(1);
    expect(mockDialog.showOpenDialog).toHaveBeenCalledTimes(1);
  });

  it('returns ExportResult with cancelled=false and savedTo set on success', async () => {
    const result = await runExport(repoRoot, senderWindow);
    expect(result.cancelled).toBe(false);
    expect(result.savedTo).toBeTruthy();
    expect(result.shelterCount).toBe(5);
    expect(result.photoCount).toBe(12);
    expect(result.skippedPhotos).toBe(1);
  });

  it('copies zip to destFolder/filename on success', async () => {
    const result = await runExport(repoRoot, senderWindow);
    expect(mockCopyFile).toHaveBeenCalledTimes(1);
    expect(result.savedTo).toContain('/Users/test/Downloads');
  });

  it('returns cancelled=true and savedTo=null when dialog is cancelled', async () => {
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const result = await runExport(repoRoot, senderWindow);
    expect(result.cancelled).toBe(true);
    expect(result.savedTo).toBeNull();
    expect(mockCopyFile).not.toHaveBeenCalled();
  });

  it('filename includes today UTC date in YYYYMMDD format', async () => {
    const result = await runExport(repoRoot, senderWindow);
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');
    const expectedDate = `${y}${m}${d}`;
    expect(result.savedTo).toContain(`gmc-shelters-export-${expectedDate}.zip`);
  });
});

describe('runExport — error paths', () => {
  let repoRoot: string;
  let senderWindow: InstanceType<typeof BrowserWindow>;

  beforeEach(() => {
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-err-test-'));
    senderWindow = new BrowserWindow();
    mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/dest'] });
    mockCopyFile.mockResolvedValue(undefined);
    mockRm.mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('rejects and cleans up when builder throws', async () => {
    mockBuildManifest.mockRejectedValue(new Error('DB error'));
    await expect(runExport(repoRoot, senderWindow)).rejects.toThrow('DB error');
    expect(mockRm).toHaveBeenCalled();
  });

  it('rejects and cleans up when zipper throws', async () => {
    mockBuildManifest.mockResolvedValue({
      manifest: { created: '', shelters: [] }, shelterCount: 0, photoCount: 0, skippedPhotos: 0,
    });
    mockCreateZip.mockRejectedValue(new Error('Zip error'));
    await expect(runExport(repoRoot, senderWindow)).rejects.toThrow('Zip error');
    expect(mockRm).toHaveBeenCalled();
  });

  it('rejects and cleans up when copyFile throws (read-only dest)', async () => {
    mockBuildManifest.mockResolvedValue({
      manifest: { created: '', shelters: [] }, shelterCount: 0, photoCount: 0, skippedPhotos: 0,
    });
    mockCreateZip.mockResolvedValue(undefined);
    mockCopyFile.mockRejectedValue(new Error('EACCES: permission denied'));
    await expect(runExport(repoRoot, senderWindow)).rejects.toThrow('EACCES');
    expect(mockRm).toHaveBeenCalled();
  });
});
