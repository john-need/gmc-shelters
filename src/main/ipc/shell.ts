import fs from 'fs';
import os from 'os';
import path from 'path';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';

function getSenderWindow(webContents: Electron.WebContents): BrowserWindow {
  const senderWindow = BrowserWindow.fromWebContents(webContents);
  if (!senderWindow) {
    throw new Error('Could not resolve sender window for window control request.');
  }
  return senderWindow;
}

function resolveInputPath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '~') {
    return os.homedir();
  }
  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return path.resolve(app.getAppPath(), trimmed);
}

function pickDefaultPath(input?: string): string {
  return input?.trim() ? resolveInputPath(input) : app.getAppPath();
}

export function registerShellHandlers(): void {
  ipcMain.handle(CHANNELS.SHELL_OPEN_EXTERNAL, (_e, { url }: { url: string }) =>
    shell.openExternal(url),
  );

  ipcMain.handle(CHANNELS.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(CHANNELS.APP_GET_REPO_ROOT, () => app.getAppPath());

  ipcMain.handle(
    CHANNELS.APP_BROWSE_DATABASE_PATH,
    async (event, { defaultPath }: { defaultPath?: string }) => {
      const result = await dialog.showOpenDialog(getSenderWindow(event.sender), {
        title: 'Select SQLite database',
        defaultPath: pickDefaultPath(defaultPath),
        properties: ['openFile'],
        filters: [
          { name: 'SQLite Databases', extensions: ['sqlite', 'sqlite3', 'db'] },
        ],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  );

  ipcMain.handle(
    CHANNELS.APP_BROWSE_DIRECTORY_PATH,
    async (event, { defaultPath }: { defaultPath?: string }) => {
      const result = await dialog.showOpenDialog(getSenderWindow(event.sender), {
        title: 'Select folder',
        defaultPath: pickDefaultPath(defaultPath),
        properties: ['openDirectory'],
      });

      return result.canceled ? null : (result.filePaths[0] ?? null);
    },
  );

  ipcMain.handle(CHANNELS.APP_VALIDATE_PATH, (_event, { input }: { input: string }) => {
    const resolvedPath = resolveInputPath(input);
    if (!fs.existsSync(resolvedPath)) {
      return {
        input,
        resolvedPath,
        exists: false,
        isFile: false,
        isDirectory: false,
      };
    }

    const stats = fs.statSync(resolvedPath);
    return {
      input,
      resolvedPath,
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  });

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
