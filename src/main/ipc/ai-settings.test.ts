// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ipcMain, app } from 'electron';
import { registerAiSettingsHandlers } from './ai-settings';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

describe('ipc/ai-settings', () => {
  let tmpDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-settings-test-'));
    (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    registerAiSettingsHandlers();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips the API key through the key file', async () => {
    const set = getHandler(CHANNELS.AI_SET_API_KEY);
    const get = getHandler(CHANNELS.AI_GET_API_KEY);
    await set(null, { key: '  sk-ant-test123\n' });
    expect(await get(null)).toBe('sk-ant-test123');

    const keyFile = path.join(tmpDir, '.anthropic_api_key');
    expect(fs.readFileSync(keyFile, 'utf8').trim()).toBe('sk-ant-test123');
    // owner-only permissions
    expect(fs.statSync(keyFile).mode & 0o777).toBe(0o600);
  });

  it('returns empty string when no key is saved', async () => {
    const get = getHandler(CHANNELS.AI_GET_API_KEY);
    expect(await get(null)).toBe('');
  });

  it('saving an empty key removes the key file', async () => {
    const set = getHandler(CHANNELS.AI_SET_API_KEY);
    const get = getHandler(CHANNELS.AI_GET_API_KEY);
    await set(null, { key: 'sk-ant-test123' });
    await set(null, { key: '' });
    expect(await get(null)).toBe('');
    expect(fs.existsSync(path.join(tmpDir, '.anthropic_api_key'))).toBe(false);
  });
});
