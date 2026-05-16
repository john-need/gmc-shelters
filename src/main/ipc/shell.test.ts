jest.mock('electron');

import { ipcMain, shell, app } from 'electron';
import { registerShellHandlers } from './shell';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

beforeEach(() => {
  jest.clearAllMocks();
  registerShellHandlers();
});

describe('ipc/shell', () => {
  it('registers shell and app channels', () => {
    const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
    expect(registered).toContain(CHANNELS.SHELL_OPEN_EXTERNAL);
    expect(registered).toContain(CHANNELS.APP_GET_VERSION);
    expect(registered).toContain(CHANNELS.APP_GET_REPO_ROOT);
  });

  it('SHELL_OPEN_EXTERNAL calls shell.openExternal with url', async () => {
    (shell.openExternal as jest.Mock).mockResolvedValue(undefined);
    const handler = getHandler(CHANNELS.SHELL_OPEN_EXTERNAL);
    await handler(null, { url: 'https://example.com' });
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('APP_GET_VERSION returns app version', () => {
    (app.getVersion as jest.Mock).mockReturnValue('1.2.3');
    const handler = getHandler(CHANNELS.APP_GET_VERSION);
    expect(handler(null)).toBe('1.2.3');
  });

  it('APP_GET_REPO_ROOT returns app path', () => {
    (app.getAppPath as jest.Mock).mockReturnValue('/path/to/app');
    const handler = getHandler(CHANNELS.APP_GET_REPO_ROOT);
    expect(handler(null)).toBe('/path/to/app');
  });
});
