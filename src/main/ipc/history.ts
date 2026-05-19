import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { readHistory, writeHistory } from '../fs/history';

export function registerHistoryHandlers(): void {
  ipcMain.handle(
    CHANNELS.HISTORY_READ,
    (_e, { slug, sheltersRoot }: { slug: string; sheltersRoot: string }) =>
      readHistory(slug, sheltersRoot),
  );

  ipcMain.handle(
    CHANNELS.HISTORY_WRITE,
    (
      _e,
      { slug, content, sheltersRoot }: { slug: string; content: string; sheltersRoot: string },
    ) => writeHistory(slug, content, sheltersRoot),
  );
}
