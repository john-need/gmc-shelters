jest.mock('electron');

import { ipcMain, shell, app, BrowserWindow } from 'electron';
import { registerShellHandlers } from './shell';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

function mockFromWebContents(returnValue: unknown): jest.Mock {
  const browserWindowWithStatics = BrowserWindow as unknown as { fromWebContents?: jest.Mock };
  browserWindowWithStatics.fromWebContents = jest.fn().mockReturnValue(returnValue);
  return browserWindowWithStatics.fromWebContents;
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
    expect(registered).toContain(CHANNELS.APP_WINDOW_CLOSE);
    expect(registered).toContain(CHANNELS.APP_WINDOW_MINIMIZE);
    expect(registered).toContain(CHANNELS.APP_WINDOW_TOGGLE_FULLSCREEN);
    expect(registered).toContain(CHANNELS.APP_WINDOW_IS_FULLSCREEN);
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

  it('APP_WINDOW_CLOSE closes the sender window', () => {
    const close = jest.fn();
    const sender = { id: 'wc' };
    const fromWebContents = mockFromWebContents({ close });

    const handler = getHandler(CHANNELS.APP_WINDOW_CLOSE);
    handler({ sender });

    expect(fromWebContents).toHaveBeenCalledWith(sender);
    expect(close).toHaveBeenCalled();
  });

  it('APP_WINDOW_MINIMIZE minimizes the sender window', () => {
    const minimize = jest.fn();
    const sender = { id: 'wc' };
    const fromWebContents = mockFromWebContents({ minimize });

    const handler = getHandler(CHANNELS.APP_WINDOW_MINIMIZE);
    handler({ sender });

    expect(fromWebContents).toHaveBeenCalledWith(sender);
    expect(minimize).toHaveBeenCalled();
  });

  it('APP_WINDOW_TOGGLE_FULLSCREEN enters fullscreen when not already fullscreen', () => {
    const setFullScreen = jest.fn();
    const sender = { id: 'wc' };
    mockFromWebContents({
      isFullScreen: jest.fn(() => false),
      setFullScreen,
    });

    const handler = getHandler(CHANNELS.APP_WINDOW_TOGGLE_FULLSCREEN);
    handler({ sender });

    expect(setFullScreen).toHaveBeenCalledWith(true);
  });

  it('APP_WINDOW_TOGGLE_FULLSCREEN exits fullscreen when already fullscreen', () => {
    const setFullScreen = jest.fn();
    const sender = { id: 'wc' };
    mockFromWebContents({
      isFullScreen: jest.fn(() => true),
      setFullScreen,
    });

    const handler = getHandler(CHANNELS.APP_WINDOW_TOGGLE_FULLSCREEN);
    handler({ sender });

    expect(setFullScreen).toHaveBeenCalledWith(false);
  });

  it('APP_WINDOW_IS_FULLSCREEN returns fullscreen state for the sender window', () => {
    const sender = { id: 'wc' };
    mockFromWebContents({
      isFullScreen: jest.fn(() => true),
    });

    const handler = getHandler(CHANNELS.APP_WINDOW_IS_FULLSCREEN);
    expect(handler({ sender })).toBe(true);
  });
});
