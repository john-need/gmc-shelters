import { app, BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { runExport } from '../export/index';

function getSenderWindow(webContents: Electron.WebContents): BrowserWindow {
  const win = BrowserWindow.fromWebContents(webContents);
  if (!win) throw new Error('Could not resolve sender window for export request.');
  return win;
}

export function registerExportHandlers(): void {
  ipcMain.handle(CHANNELS.EXPORT_BUILD, (event) =>
    runExport(app.getAppPath(), getSenderWindow(event.sender)),
  );
}
