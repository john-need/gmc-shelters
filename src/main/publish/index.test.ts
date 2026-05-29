jest.mock('googleapis');
jest.mock('electron', () => ({
  shell: { openExternal: jest.fn() },
  app: { getPath: jest.fn().mockReturnValue('/tmp'), getAppPath: jest.fn().mockReturnValue('/repo') },
}));
jest.mock('fs');
jest.mock('../export/builder');
jest.mock('./gdrive');

import fs from 'fs';
import type { ManifestJson, PhotoEntry, HistoryEntry } from '../export/builder';
import { GDriveClient } from './gdrive';
import { runPublish, computeDiff } from './index';
import type { PreflightState } from './index';
import type { PublishPreflightInput } from '../../shared/ipc-types';

const MockGDriveClient = GDriveClient as jest.MockedClass<typeof GDriveClient>;
const mockFs = fs as jest.Mocked<typeof fs>;

function makePhoto(fileName: string, updated: string, driveFileId: string | null = null): PhotoEntry {
  return { id: 1, fileName, updated, driveFileId, photographer: '', caption: '', dateTaken: '', notes: '', created: updated, shelterId: 1, altText: '', title: '', description: '' };
}

function makeHistory(filePath: string, updated: string, driveFileId: string | null = null): HistoryEntry {
  return { filePath, updated, driveFileId };
}

function makeManifest(photos: PhotoEntry[], history: HistoryEntry | null = null): ManifestJson {
  return {
    created: '2025-01-01T00:00:00.000Z',
    shelters: [
      {
        id: 1, name: 'Test Shelter', slug: 'test-shelter', startYear: 1960, endYear: null,
        description: '', longitude: null, latitude: null, defaultPhotoId: null,
        isGmc: true, architecture: '', builtBy: '', notes: '', created: '', updated: '',
        isExtant: true, category: '', history,
        mapMarkers: [], photos,
      },
    ],
  };
}

const CONFIG: PublishPreflightInput = {
  rootFolderId: 'root-folder-id',
  manifestName: 'shelter-manifest.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
  sheltersRoot: 'shelters/',
};

function makeState(
  localManifest: ManifestJson,
  priorPhotoIndex: Map<string, PhotoEntry>,
  client: unknown,
  opts: { rootFolderFiles?: Map<string, string>; manifestFileId?: string | null; priorHistoryIndex?: Map<string, HistoryEntry> } = {},
): PreflightState {
  const diff = computeDiff(localManifest, priorPhotoIndex.size > 0 ? { created: '', shelters: [{ id: 0, name: '', slug: '', startYear: 0, endYear: null, description: '', longitude: null, latitude: null, defaultPhotoId: null, isGmc: false, architecture: '', builtBy: '', notes: '', created: '', updated: '', isExtant: true, category: '', history: null, mapMarkers: [], photos: Array.from(priorPhotoIndex.values()) }] } : null);
  return {
    tmpDir: '/repo/.publish-tmp',
    localManifest,
    priorPhotoIndex,
    priorHistoryIndex: opts.priorHistoryIndex ?? new Map(),
    client: client as GDriveClient,
    rootFolderFiles: opts.rootFolderFiles ?? new Map(),
    manifestFileId: opts.manifestFileId ?? null,
    config: CONFIG,
    diff,
  };
}

describe('runPublish', () => {
  let mockClient: {
    listFolder: jest.Mock;
    uploadFile: jest.Mock;
    updateFile: jest.Mock;
    createFolder: jest.Mock;
    deleteFile: jest.Mock;
    authenticate: jest.Mock;
    downloadJson: jest.Mock;
    testConnection: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(mockFs, 'promises', {
      value: { rm: jest.fn().mockResolvedValue(undefined), mkdir: jest.fn().mockResolvedValue(undefined) },
      writable: true, configurable: true,
    });
    mockFs.existsSync = jest.fn().mockReturnValue(true);
    mockFs.writeFileSync = jest.fn();

    mockClient = {
      authenticate: jest.fn().mockResolvedValue({}),
      listFolder: jest.fn().mockResolvedValue(new Map()),
      downloadJson: jest.fn().mockResolvedValue(null),
      uploadFile: jest.fn().mockResolvedValue('new-drive-id'),
      updateFile: jest.fn().mockResolvedValue(undefined),
      createFolder: jest.fn().mockResolvedValue('new-folder-id'),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      testConnection: jest.fn().mockResolvedValue({ ok: true, message: 'ok' }),
    };
    MockGDriveClient.mockImplementation(() => mockClient as unknown as GDriveClient);
  });

  it('returns a PublishResult with correct shelterCount', async () => {
    const state = makeState(makeManifest([]), new Map(), mockClient);
    const result = await runPublish(state);
    expect(result.shelterCount).toBe(1);
  });

  describe('photo upload decision logic', () => {
    it('calls updateFile for a selected-update photo with existing driveFileId', async () => {
      const photo = makePhoto('test-shelter/photo.jpg', '2025-06-01T00:00:00Z', 'existing-id');
      const manifest = makeManifest([photo]);
      const priorPhoto = makePhoto('test-shelter/photo.jpg', '2025-01-01T00:00:00Z', 'existing-id');
      const priorIndex = new Map([['test-shelter/photo.jpg', priorPhoto]]);
      const state = makeState(manifest, priorIndex, mockClient, { manifestFileId: 'manifest-id' });

      const result = await runPublish(state);
      expect(mockClient.updateFile).toHaveBeenCalledWith('existing-id', expect.any(String), 'image/jpeg');
      expect(result.photosUpdated).toBe(1);
    });

    it('calls uploadFile for a selected-upload photo', async () => {
      const photo = makePhoto('test-shelter/photo.jpg', '2025-06-01T00:00:00Z', null);
      const manifest = makeManifest([photo]);
      const state = makeState(manifest, new Map(), mockClient, { manifestFileId: 'manifest-id' });

      const result = await runPublish(state);
      const photoUploadCalls = mockClient.uploadFile.mock.calls.filter((c: unknown[]) => c[3] !== 'application/json');
      expect(photoUploadCalls).toHaveLength(1);
      expect(result.photosUploaded).toBe(1);
    });

    it('does not call uploadFile or updateFile for a photo not in any selection', async () => {
      const photo = makePhoto('test-shelter/photo.jpg', '2025-01-01T00:00:00Z', 'existing-id');
      const manifest = makeManifest([photo]);
      const priorPhoto = makePhoto('test-shelter/photo.jpg', '2025-01-01T00:00:00Z', 'existing-id');
      const priorIndex = new Map([['test-shelter/photo.jpg', priorPhoto]]);
      const state = makeState(manifest, priorIndex, mockClient, { manifestFileId: 'manifest-id' });

      const result = await runPublish(state);
      const photoCalls = mockClient.uploadFile.mock.calls.filter((c: unknown[]) => c[3] !== 'application/json');
      expect(photoCalls).toHaveLength(0);
      const photoUpdateCalls = mockClient.updateFile.mock.calls.filter((c: unknown[]) => c[2] !== 'application/json');
      expect(photoUpdateCalls).toHaveLength(0);
      expect(result.photosSkipped).toBe(1);
    });

    it('carries forward driveFileId for skipped photos', async () => {
      const photo = makePhoto('test-shelter/photo.jpg', '2025-01-01T00:00:00Z', 'carried-id');
      const manifest = makeManifest([photo]);
      const priorPhoto = makePhoto('test-shelter/photo.jpg', '2025-01-01T00:00:00Z', 'carried-id');
      const priorIndex = new Map([['test-shelter/photo.jpg', priorPhoto]]);
      const state = makeState(manifest, priorIndex, mockClient, { manifestFileId: 'manifest-id' });

      await runPublish(state);
      expect(manifest.shelters[0].photos[0].driveFileId).toBe('carried-id');
    });

    it('uploads all photos when priorPhotoIndex is empty (first publish)', async () => {
      const photos = [
        makePhoto('test-shelter/a.jpg', '2025-01-01T00:00:00Z', null),
        makePhoto('test-shelter/b.jpg', '2025-02-01T00:00:00Z', null),
      ];
      const manifest = makeManifest(photos);
      const state = makeState(manifest, new Map(), mockClient);

      const result = await runPublish(state);
      const photoUploads = mockClient.uploadFile.mock.calls.filter((c: unknown[]) => c[3] !== 'application/json');
      expect(photoUploads).toHaveLength(2);
      expect(result.photosUploaded).toBe(2);
    });
  });

  describe('manifest write decision', () => {
    it('calls updateFile for manifest when manifestFileId is set', async () => {
      const state = makeState(makeManifest([]), new Map(), mockClient, { manifestFileId: 'manifest-file-id' });
      const result = await runPublish(state);
      expect(mockClient.updateFile).toHaveBeenCalledWith('manifest-file-id', expect.any(String), 'application/json');
      expect(result.manifestWritten).toBe(true);
    });

    it('calls uploadFile for manifest when manifestFileId is null', async () => {
      const state = makeState(makeManifest([]), new Map(), mockClient, { manifestFileId: null });
      const result = await runPublish(state);
      expect(mockClient.uploadFile).toHaveBeenCalledWith(
        expect.any(String), 'shelter-manifest.json', 'root-folder-id', 'application/json',
      );
      expect(result.manifestWritten).toBe(true);
    });
  });

  it('increments photosMissing when local file does not exist', async () => {
    const photo = makePhoto('test-shelter/missing.jpg', '2025-01-01T00:00:00Z', null);
    const manifest = makeManifest([photo]);
    const state = makeState(manifest, new Map(), mockClient);
    (mockFs.existsSync as jest.Mock).mockReturnValue(false);

    const result = await runPublish(state);
    expect(result.photosMissing).toBe(1);
  });

  it('calls deleteFile for photos in the prior manifest absent from the local manifest', async () => {
    const manifest = makeManifest([]);
    const priorPhoto = makePhoto('test-shelter/deleted.jpg', '2025-01-01T00:00:00Z', 'old-drive-id');
    const priorIndex = new Map([['test-shelter/deleted.jpg', priorPhoto]]);
    const state = makeState(manifest, priorIndex, mockClient);

    await runPublish(state);
    expect(mockClient.deleteFile).toHaveBeenCalledWith('old-drive-id');
  });

  describe('history file upload decision logic', () => {
    it('uploads history file and sets driveFileId when no prior entry exists', async () => {
      const history = makeHistory('test-shelter/test-shelter.md', '2025-06-01T00:00:00Z');
      const manifest = makeManifest([], history);
      const state = makeState(manifest, new Map(), mockClient);

      await runPublish(state);
      const historyUploads = mockClient.uploadFile.mock.calls.filter((c: unknown[]) => c[3] === 'text/markdown');
      expect(historyUploads).toHaveLength(1);
      expect(manifest.shelters[0].history!.driveFileId).toBe('new-drive-id');
    });

    it('calls updateFile for history when prior driveFileId exists and updated is newer', async () => {
      const history = makeHistory('test-shelter/test-shelter.md', '2025-06-01T00:00:00Z');
      const manifest = makeManifest([], history);
      const priorHistory = makeHistory('test-shelter/test-shelter.md', '2025-01-01T00:00:00Z', 'prior-history-id');
      const state = makeState(manifest, new Map(), mockClient, {
        priorHistoryIndex: new Map([['test-shelter', priorHistory]]),
      });

      await runPublish(state);
      expect(mockClient.updateFile).toHaveBeenCalledWith('prior-history-id', expect.any(String), 'text/markdown');
      expect(manifest.shelters[0].history!.driveFileId).toBe('prior-history-id');
    });

    it('skips history upload and carries forward driveFileId when updated is unchanged', async () => {
      const history = makeHistory('test-shelter/test-shelter.md', '2025-01-01T00:00:00Z');
      const manifest = makeManifest([], history);
      const priorHistory = makeHistory('test-shelter/test-shelter.md', '2025-01-01T00:00:00Z', 'carried-id');
      const state = makeState(manifest, new Map(), mockClient, {
        priorHistoryIndex: new Map([['test-shelter', priorHistory]]),
      });

      await runPublish(state);
      const historyCalls = mockClient.uploadFile.mock.calls.filter((c: unknown[]) => c[3] === 'text/markdown');
      const historyUpdateCalls = mockClient.updateFile.mock.calls.filter((c: unknown[]) => c[2] === 'text/markdown');
      expect(historyCalls).toHaveLength(0);
      expect(historyUpdateCalls).toHaveLength(0);
      expect(manifest.shelters[0].history!.driveFileId).toBe('carried-id');
    });
  });

  describe('computeDiff history counts', () => {
    it('counts history file as toUpload when no prior entry exists', () => {
      const history = makeHistory('test-shelter/test-shelter.md', '2025-06-01T00:00:00Z');
      const local = makeManifest([], history);
      const diff = computeDiff(local, null);
      expect(diff.historyToUploadCount).toBe(1);
      expect(diff.historyUnchangedCount).toBe(0);
    });

    it('counts history file as toUpload when updated is newer than prior', () => {
      const history = makeHistory('test-shelter/test-shelter.md', '2025-06-01T00:00:00Z');
      const local = makeManifest([], history);
      const priorHistory = makeHistory('test-shelter/test-shelter.md', '2025-01-01T00:00:00Z', 'prior-id');
      const prior = makeManifest([], priorHistory);
      const diff = computeDiff(local, prior);
      expect(diff.historyToUploadCount).toBe(1);
      expect(diff.historyUnchangedCount).toBe(0);
    });

    it('counts history file as unchanged when updated matches prior', () => {
      const history = makeHistory('test-shelter/test-shelter.md', '2025-01-01T00:00:00Z');
      const local = makeManifest([], history);
      const priorHistory = makeHistory('test-shelter/test-shelter.md', '2025-01-01T00:00:00Z', 'prior-id');
      const prior = makeManifest([], priorHistory);
      const diff = computeDiff(local, prior);
      expect(diff.historyToUploadCount).toBe(0);
      expect(diff.historyUnchangedCount).toBe(1);
    });

    it('counts zero for history when shelter has no history file', () => {
      const local = makeManifest([]);
      const diff = computeDiff(local, null);
      expect(diff.historyToUploadCount).toBe(0);
      expect(diff.historyUnchangedCount).toBe(0);
    });
  });
});
