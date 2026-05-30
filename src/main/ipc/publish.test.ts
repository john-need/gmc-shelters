jest.mock('electron');
jest.mock('../publish/index');
jest.mock('../publish/gdrive');

import { ipcMain, app } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import { registerPublishHandlers } from './publish';
import { runPreflight, runPublish } from '../publish/index';
import { GDriveClient } from '../publish/gdrive';

const mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>;
const mockRunPreflight = runPreflight as jest.Mock;
const mockRunPublish = runPublish as jest.Mock;
const MockGDriveClient = GDriveClient as jest.MockedClass<typeof GDriveClient>;
const mockApp = app as jest.Mocked<typeof app>;

const validInput = {
  rootFolderId: 'folder-id',
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

  // ----- PUBLISH_PREFLIGHT: validation + state setup -----
  // Config/credential validation lives here (phase 1). PUBLISH_TO_WEB (phase 2)
  // only runs once a preflight has stored state.

  describe('PUBLISH_PREFLIGHT', () => {
    it('returns CONFIG_INVALID when rootFolderId is blank', async () => {
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_PREFLIGHT);
      const result = await handler(fakeEvent, { ...validInput, rootFolderId: '' });
      expect(result).toEqual({ error: 'CONFIG_INVALID' });
      expect(mockRunPreflight).not.toHaveBeenCalled();
    });

    it('returns CONFIG_INVALID when scopes array is empty', async () => {
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_PREFLIGHT);
      const result = await handler(fakeEvent, { ...validInput, scopes: [] });
      expect(result).toEqual({ error: 'CONFIG_INVALID' });
    });

    it('returns NO_CREDENTIALS when credentials file is missing', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(false);
      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_PREFLIGHT);
      const result = await handler(fakeEvent, validInput);
      expect(result).toEqual({ error: 'NO_CREDENTIALS' });
      expect(mockRunPreflight).not.toHaveBeenCalled();
      mockFsExists.mockRestore();
    });

    it('returns the diff and stores preflight state on success', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      const diff = { newCount: 3, updatedCount: 0, deleteCount: 0, unchangedCount: 0 };
      mockRunPreflight.mockResolvedValue({ diff, state: { tmpDir: '/tmp/x' } });

      registerPublishHandlers();
      const result = await getHandler(CHANNELS.PUBLISH_PREFLIGHT)(fakeEvent, validInput);
      expect(result).toEqual(diff);

      // clear module-level preflight state for subsequent tests
      await getHandler(CHANNELS.PUBLISH_CANCEL)(fakeEvent);
      mockFsExists.mockRestore();
    });

    it('returns ALREADY_RUNNING when a preflight has already produced state', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      mockRunPreflight.mockResolvedValue({ diff: { newCount: 0 }, state: { tmpDir: '/tmp/x' } });

      registerPublishHandlers();
      const handler = getHandler(CHANNELS.PUBLISH_PREFLIGHT);
      await handler(fakeEvent, validInput); // first preflight stores state
      const result = await handler(fakeEvent, validInput); // second is blocked
      expect(result).toEqual({ error: 'ALREADY_RUNNING' });

      await getHandler(CHANNELS.PUBLISH_CANCEL)(fakeEvent);
      mockFsExists.mockRestore();
    });
  });

  // ----- PUBLISH_TO_WEB: requires prior preflight, then publishes -----

  describe('PUBLISH_TO_WEB', () => {
    it('registers ipcMain.handle for PUBLISH_TO_WEB channel', () => {
      registerPublishHandlers();
      expect(mockIpcMain.handle).toHaveBeenCalledWith(CHANNELS.PUBLISH_TO_WEB, expect.any(Function));
    });

    it('returns NO_PREFLIGHT when no preflight has run', async () => {
      registerPublishHandlers();
      const result = await getHandler(CHANNELS.PUBLISH_TO_WEB)(fakeEvent);
      expect(result).toEqual({ error: 'NO_PREFLIGHT' });
      expect(mockRunPublish).not.toHaveBeenCalled();
    });

    it('returns a PublishResult on success after preflight', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      mockRunPreflight.mockResolvedValue({ diff: { newCount: 0 }, state: { tmpDir: '/tmp/x' } });
      const expectedResult = { shelterCount: 5, photosUploaded: 10, photosUpdated: 2, photosSkipped: 3, photosFailed: 0, photosMissing: 0, skippedBuildPhotos: 1, manifestWritten: true };
      mockRunPublish.mockResolvedValue(expectedResult);

      registerPublishHandlers();
      await getHandler(CHANNELS.PUBLISH_PREFLIGHT)(fakeEvent, validInput); // store state
      const result = await getHandler(CHANNELS.PUBLISH_TO_WEB)(fakeEvent);
      expect(result).toEqual(expectedResult);
      mockFsExists.mockRestore();
    });

    it('returns ALREADY_RUNNING when a publish is already in progress', async () => {
      const mockFsExists = jest.spyOn(require('fs'), 'existsSync').mockReturnValue(true);
      mockRunPreflight.mockResolvedValue({ diff: { newCount: 0 }, state: { tmpDir: '/tmp/x' } });

      // controllable promise so the first publish stays in-progress
      let resolveFirst!: (val: unknown) => void;
      mockRunPublish.mockReturnValue(new Promise(resolve => { resolveFirst = resolve; }));

      registerPublishHandlers();
      await getHandler(CHANNELS.PUBLISH_PREFLIGHT)(fakeEvent, validInput); // store state
      const toWeb = getHandler(CHANNELS.PUBLISH_TO_WEB);

      const firstCall = toWeb(fakeEvent); // in-progress (not awaited)
      const result = await toWeb(fakeEvent); // blocked
      expect(result).toEqual({ error: 'ALREADY_RUNNING' });

      resolveFirst({ shelterCount: 0, photosUploaded: 0, photosUpdated: 0, photosSkipped: 0, photosFailed: 0, photosMissing: 0, skippedBuildPhotos: 0, manifestWritten: false });
      await firstCall;
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
