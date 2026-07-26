// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ipcMain, app } from 'electron';
import { registerMcpSettingsHandlers, readStoredMcpEnabled } from './mcp-settings';
import { setMcpServerRunning, isMcpServerRunning } from '../mcp/manager';
import { CHANNELS } from '@shared/ipc-types';

jest.mock('../mcp/manager', () => ({
  setMcpServerRunning: jest.fn().mockResolvedValue(undefined),
  isMcpServerRunning: jest.fn(() => false),
}));

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

describe('ipc/mcp-settings', () => {
  let tmpDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-settings-test-'));
    (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    registerMcpSettingsHandlers();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('MCP_GET_ENABLED reflects whatever the manager reports as running', async () => {
    (isMcpServerRunning as jest.Mock).mockReturnValue(true);
    const get = getHandler(CHANNELS.MCP_GET_ENABLED);
    expect(await get(null)).toBe(true);
  });

  it('MCP_SET_ENABLED persists the flag and starts/stops the live server via the manager', async () => {
    const set = getHandler(CHANNELS.MCP_SET_ENABLED);

    await set(null, { enabled: true });
    expect(setMcpServerRunning).toHaveBeenCalledWith(true);

    const flagFile = path.join(tmpDir, '.mcp_enabled');
    expect(fs.readFileSync(flagFile, 'utf8').trim()).toBe('1');
    expect(fs.statSync(flagFile).mode & 0o777).toBe(0o600);

    await set(null, { enabled: false });
    expect(setMcpServerRunning).toHaveBeenCalledWith(false);
    expect(fs.readFileSync(flagFile, 'utf8').trim()).toBe('0');
  });

  it('MCP_GET_CONNECTION_INFO returns the local server name and URL', async () => {
    const get = getHandler(CHANNELS.MCP_GET_CONNECTION_INFO);
    const info = await get(null) as { serverName: string; url: string };
    expect(info.serverName).toBe('gmc-shelters');
    expect(info.url).toBe('http://127.0.0.1:5972/mcp');
  });

  describe('readStoredMcpEnabled (exported helper)', () => {
    it('defaults to true when no flag file exists', () => {
      expect(readStoredMcpEnabled()).toBe(true);
    });

    it('reads a persisted false value', () => {
      fs.writeFileSync(path.join(tmpDir, '.mcp_enabled'), '0');
      expect(readStoredMcpEnabled()).toBe(false);
    });
  });
});
