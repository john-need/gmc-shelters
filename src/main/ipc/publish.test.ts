jest.mock('electron');
jest.mock('../publish/index');
jest.mock('../publish/gdrive');

import { ipcMain, app } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import { registerPublishHandlers } from './publish';
import { runPublish } from '../publish/index';
import { GDriveClient } from '../publish/gdrive';

const mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>;
const mockRunPublish = runPublish as jest.Mock;
const MockGDriveClient = GDriveClient as jest.MockedClass<typeof GDriveClient>;
const mockApp = app as jest.Mocked<typeof app>;

const validInput = {
  rootFolderId: 'folder-id',
  manifestName: 'shelter-manifest.json',
  scopes: ['https://www.googleapis.com/auth/drive'],
};

const fakeEvent = {} as Electron.IpcMainInvokeEvent;

function getHandler(channel: string): (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> {
  const call = mockIpcMain.handle.mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
}

describe('registerPublishHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApp.getPath.mockReturnValue('/tmp');
    mockApp.getAppPath.mockReturnValue('/repo');
  });

  // ----- US1: PUBLISH_TO_WEB -----

  describe('PUBLISH_TO_WEB', () => {
    it('registers ipcMain.handle for PUBLISH_TO_WEB channel', () => {
      registerPublishHandlers();
      expect(mockIpcMain.handle).toHaveBeenCalledWith(CHANNELS.PUBLISH_TO_WEB, expect.any(Function));
    });

    it('returns ALREADY_RUNNING error when a publish is already in progress', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);

      // Use a controllable promise so we can resolve it at the end to reset isPublishing
      let resolveFirst!: (val: unknown) => void;
      mockRunPublish.mockReturnValue(new Promise(resolve => { resolveFirst = resolve; }));

      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TO_WEB);

      // Start first publish (don't await — it's in-progress)
      const firstCall = handler(fakeEvent, validInput);

      // Second invocation should return ALREADY_RUNNING immediately
      const result = await handler(fakeEvent, validInput);
      expect(result).toEqual({ error: 'ALREADY_RUNNING' });

      // Resolve the first to reset isPublishing for subsequent tests
      resolveFirst({ shelterCount: 0, photosUploaded: 0, photosUpdated: 0, photosSkipped: 0, photosFailed: 0, photosMissing: 0, skippedBuildPhotos: 0, manifestWritten: false });
      await firstCall;
      mockFsExists.mockRestore();
    });

    it('returns CONFIG_INVALID when rootFolderId is blank', async () => {
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TO_WEB);
      const result = await handler(fakeEvent, { ...validInput, rootFolderId: '' });
      expect(result).toEqual({ error: 'CONFIG_INVALID' });
      expect(mockRunPublish).not.toHaveBeenCalled();
    });

    it('returns CONFIG_INVALID when scopes array is empty', async () => {
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TO_WEB);
      const result = await handler(fakeEvent, { ...validInput, scopes: [] });
      expect(result).toEqual({ error: 'CONFIG_INVALID' });
    });

    it('returns NO_CREDENTIALS when credentials file is missing', async () => {
      // Mock fs to simulate missing credentials file
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TO_WEB);
      const result = await handler(fakeEvent, validInput);
      expect(result).toEqual({ error: 'NO_CREDENTIALS' });
      expect(mockRunPublish).not.toHaveBeenCalled();
      mockFsExists.mockRestore();
    });

    it('defaults manifestName to shelter-manifest.json when blank', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      mockRunPublish.mockResolvedValue({ shelterCount: 1, photosUploaded: 0, photosUpdated: 0, photosSkipped: 0, photosFailed: 0, photosMissing: 0, skippedBuildPhotos: 0, manifestWritten: true });

      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TO_WEB);
      const result = await handler(fakeEvent, { ...validInput, manifestName: '' });
      expect(result).not.toHaveProperty('error');
      const callArgs = mockRunPublish.mock.calls[0][0];
      expect(callArgs.manifestName).toBe('shelter-manifest.json');
      mockFsExists.mockRestore();
    });

    it('returns a PublishResult on success', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      const expectedResult = { shelterCount: 5, photosUploaded: 10, photosUpdated: 2, photosSkipped: 3, photosFailed: 0, photosMissing: 0, skippedBuildPhotos: 1, manifestWritten: true };
      mockRunPublish.mockResolvedValue(expectedResult);

      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TO_WEB);
      const result = await handler(fakeEvent, validInput);
      expect(result).toEqual(expectedResult);
      mockFsExists.mockRestore();
    });
  });

  // ----- US2: PUBLISH_TEST_CONNECTION -----

  describe('PUBLISH_TEST_CONNECTION', () => {
    let mockClient: {
      testConnection: jest.Mock;
    };

    beforeEach(() => {
      mockClient = { testConnection: jest.fn().mockResolvedValue({ ok: true, message: 'Connected — folder: My Shelters' }) };
      MockGDriveClient.mockImplementation(() => mockClient as unknown as GDriveClient);
    });

    it('registers ipcMain.handle for PUBLISH_TEST_CONNECTION channel', () => {
      registerPublishHandlers();
      expect(mockIpcMain.handle).toHaveBeenCalledWith(CHANNELS.PUBLISH_TEST_CONNECTION, expect.any(Function));
    });

    it('returns ok: true with folder name when connection succeeds', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TEST_CONNECTION);
      const result = await handler(fakeEvent, { rootFolderId: 'folder-id', scopes: validInput.scopes });
      expect(result).toMatchObject({ ok: true });
      expect((result as { message: string }).message).toContain('My Shelters');
      mockFsExists.mockRestore();
    });

    it('returns ok: false when folder is unreachable', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      mockClient.testConnection.mockResolvedValue({ ok: false, message: 'Access denied' });
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TEST_CONNECTION);
      const result = await handler(fakeEvent, { rootFolderId: 'bad-id', scopes: validInput.scopes });
      expect(result).toMatchObject({ ok: false });
      mockFsExists.mockRestore();
    });

    it('returns ok: false with credentials message when credentials.json is missing', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TEST_CONNECTION);
      const result = await handler(fakeEvent, { rootFolderId: 'folder-id', scopes: validInput.scopes });
      expect((result as { ok: boolean }).ok).toBe(false);
      expect((result as { message: string }).message).toContain('credentials.json');
      mockFsExists.mockRestore();
    });

    // US3: blank rootFolderId returns CONFIG_INVALID
    it('returns CONFIG_INVALID when rootFolderId is blank', async () => {
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_TEST_CONNECTION);
      const result = await handler(fakeEvent, { rootFolderId: '', scopes: validInput.scopes });
      expect(result).toEqual({ error: 'CONFIG_INVALID' });
    });
  });
});
