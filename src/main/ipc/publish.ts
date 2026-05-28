import fs from 'fs';
import path from 'path';
import { ipcMain, app, BrowserWindow, dialog } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { PublishPreflightInput, ConnectionTestResult, PublishProgress } from '../../shared/ipc-types';
import { runPreflight, runPublish } from '../publish/index';
import type { PreflightState } from '../publish/index';
import { GDriveClient } from '../publish/gdrive';

let preflightState: PreflightState | null = null;
let publishInProgress = false;
let cancelRequested = false;

export function registerPublishHandlers(): void {
  ipcMain.handle(CHANNELS.PUBLISH_PREFLIGHT, async (_event, input: PublishPreflightInput) => {
    if (preflightState || publishInProgress) return { error: 'ALREADY_RUNNING' };
    if (!input.rootFolderId) return { error: 'CONFIG_INVALID' };
    if (!input.scopes || input.scopes.length === 0) return { error: 'CONFIG_INVALID' };

    const credPath = path.join(app.getPath('userData'), 'credentials.json');
    if (!fs.existsSync(credPath)) return { error: 'NO_CREDENTIALS' };

    try {
      const { diff, state } = await runPreflight(input, app.getAppPath());
      preflightState = state;
      cancelRequested = false;
      return diff;
    } catch (err) {
      preflightState = null;
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle(CHANNELS.PUBLISH_TO_WEB, async (event) => {
    if (!preflightState) return { error: 'NO_PREFLIGHT' };
    if (publishInProgress) return { error: 'ALREADY_RUNNING' };

    publishInProgress = true;
    cancelRequested = false;
    const state = preflightState;

    try {
      const onProgress = (p: PublishProgress) => event.sender.send(CHANNELS.PUBLISH_PROGRESS, p);
      return await runPublish(state, onProgress, () => cancelRequested);
    } finally {
      preflightState = null;
      publishInProgress = false;
    }
  });

  ipcMain.handle(CHANNELS.PUBLISH_CANCEL, async () => {
    cancelRequested = true;
    if (preflightState && !publishInProgress) {
      // Still in review phase — clean up tmpDir now
      try { await fs.promises.rm(preflightState.tmpDir, { recursive: true, force: true }); } catch {}
      preflightState = null;
    }
    // If publishInProgress, the PUBLISH_TO_WEB handler's finally block cleans up
  });

  ipcMain.handle(CHANNELS.PUBLISH_TEST_CONNECTION, async (_event, input: Pick<PublishPreflightInput, 'rootFolderId' | 'scopes'>): Promise<ConnectionTestResult | { error: string }> => {
    if (!input.rootFolderId) return { error: 'CONFIG_INVALID' };

    const userData = app.getPath('userData');
    const credPath = path.join(userData, 'credentials.json');
    if (!fs.existsSync(credPath)) {
      return { ok: false, message: `credentials.json not found at ${credPath}` };
    }

    const tokenPath = path.join(userData, 'gmc-gdrive-token.json');
    const scopes = input.scopes ?? ['https://www.googleapis.com/auth/drive'];
    const client = new GDriveClient(credPath, tokenPath, scopes);
    return client.testConnection(input.rootFolderId);
  });

  ipcMain.handle(CHANNELS.PUBLISH_CHECK_CREDENTIALS, () => {
    const credPath = path.join(app.getPath('userData'), 'credentials.json');
    return { exists: fs.existsSync(credPath), path: credPath };
  });

  ipcMain.handle(CHANNELS.PUBLISH_IMPORT_CREDENTIALS, async (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const destPath = path.join(app.getPath('userData'), 'credentials.json');

    const result = await dialog.showOpenDialog(senderWindow!, {
      title: 'Select credentials.json',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (result.canceled || !result.filePaths[0]) return null;

    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(result.filePaths[0], destPath);
      return { ok: true, path: destPath };
    } catch (err) {
      return { ok: false, path: destPath, message: err instanceof Error ? err.message : String(err) };
    }
  });
}
