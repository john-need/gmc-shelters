// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { ipcMain, app } from 'electron';
import { registerAiSettingsHandlers, readStoredApiKey, readStoredModelTier } from './ai-settings';
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

  it('AI_GET_MODEL returns "default" when no .ai_model file exists', async () => {
    const get = getHandler(CHANNELS.AI_GET_MODEL);
    expect(await get(null)).toBe('default');
  });

  it('AI_SET_MODEL/AI_GET_MODEL round-trip a valid tier through the model file', async () => {
    const set = getHandler(CHANNELS.AI_SET_MODEL);
    const get = getHandler(CHANNELS.AI_GET_MODEL);
    await set(null, { tier: 'escalation' });
    expect(await get(null)).toBe('escalation');

    const modelFile = path.join(tmpDir, '.ai_model');
    expect(fs.readFileSync(modelFile, 'utf8').trim()).toBe('escalation');
    expect(fs.statSync(modelFile).mode & 0o777).toBe(0o600);
  });

  it('AI_GET_MODEL returns "default" when the file holds an unrecognized value', async () => {
    fs.writeFileSync(path.join(tmpDir, '.ai_model'), 'not-a-real-tier');
    const get = getHandler(CHANNELS.AI_GET_MODEL);
    expect(await get(null)).toBe('default');
  });

  it('AI_SET_MODEL rejects an invalid tier without writing the file', async () => {
    const set = getHandler(CHANNELS.AI_SET_MODEL);
    const get = getHandler(CHANNELS.AI_GET_MODEL);
    await expect(set(null, { tier: 'not-a-real-tier' })).rejects.toThrow();
    expect(fs.existsSync(path.join(tmpDir, '.ai_model'))).toBe(false);
    expect(await get(null)).toBe('default');
  });

  describe('readStoredApiKey/readStoredModelTier (exported helpers)', () => {
    it('readStoredApiKey returns "" when no key is saved, and the saved key once one is', async () => {
      expect(readStoredApiKey()).toBe('');
      const set = getHandler(CHANNELS.AI_SET_API_KEY);
      await set(null, { key: 'sk-ant-test123' });
      expect(readStoredApiKey()).toBe('sk-ant-test123');
    });

    it('readStoredModelTier returns "default" when no file exists, and the saved tier once one is', async () => {
      expect(readStoredModelTier()).toBe('default');
      const set = getHandler(CHANNELS.AI_SET_MODEL);
      await set(null, { tier: 'escalation' });
      expect(readStoredModelTier()).toBe('escalation');
    });

    it('readStoredModelTier falls back to "default" for an unrecognized file value', () => {
      fs.writeFileSync(path.join(tmpDir, '.ai_model'), 'not-a-real-tier');
      expect(readStoredModelTier()).toBe('default');
    });
  });
});
