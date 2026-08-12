import { app, BrowserWindow, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { ExportProgress } from '../../shared/ipc-types';
import { runExport } from '../export/index';

function getSenderWindow(webContents: Electron.WebContents): BrowserWindow {
  const win = BrowserWindow.fromWebContents(webContents);
  if (!win) throw new Error('Could not resolve sender window for export request.');
  return win;
}

let cancelRequested = false;

export function registerExportHandlers(): void {
  ipcMain.handle(CHANNELS.EXPORT_BUILD, (event) => {
    cancelRequested = false;
    const onProgress = (p: ExportProgress) => event.sender.send(CHANNELS.EXPORT_PROGRESS, p);
    return runExport(app.getAppPath(), getSenderWindow(event.sender), onProgress, () => cancelRequested);
  });

  ipcMain.handle(CHANNELS.EXPORT_CANCEL, () => {
    cancelRequested = true;
  });
}
