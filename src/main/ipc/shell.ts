import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';

function getSenderWindow(webContents: Electron.WebContents): BrowserWindow {
  const senderWindow = BrowserWindow.fromWebContents(webContents);
  if (!senderWindow) {
    throw new Error('Could not resolve sender window for window control request.');
  }
  return senderWindow;
}

export function registerShellHandlers(): void {
  ipcMain.handle(CHANNELS.SHELL_OPEN_EXTERNAL, (_e, { url }: { url: string }) =>
    shell.openExternal(url),
  );

  ipcMain.handle(CHANNELS.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(CHANNELS.APP_GET_REPO_ROOT, () => app.getAppPath());

  ipcMain.handle(CHANNELS.APP_WINDOW_CLOSE, (event) => {
    getSenderWindow(event.sender).close();
  });

  ipcMain.handle(CHANNELS.APP_WINDOW_MINIMIZE, (event) => {
    getSenderWindow(event.sender).minimize();
  });

  ipcMain.handle(CHANNELS.APP_WINDOW_TOGGLE_FULLSCREEN, (event) => {
    const senderWindow = getSenderWindow(event.sender);
    senderWindow.setFullScreen(!senderWindow.isFullScreen());
  });

  ipcMain.handle(CHANNELS.APP_WINDOW_IS_FULLSCREEN, (event) =>
    getSenderWindow(event.sender).isFullScreen(),
  );
}
