import { ipcMain, shell, app } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';

export function registerShellHandlers(): void {
  ipcMain.handle(CHANNELS.SHELL_OPEN_EXTERNAL, (_e, { url }: { url: string }) =>
    shell.openExternal(url),
  );

  ipcMain.handle(CHANNELS.APP_GET_VERSION, () => app.getVersion());

  ipcMain.handle(CHANNELS.APP_GET_REPO_ROOT, () => app.getAppPath());
}
