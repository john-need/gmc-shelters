import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { readHistory, writeHistory } from '../fs/history';

export function registerHistoryHandlers(): void {
  ipcMain.handle(
    CHANNELS.HISTORY_READ,
    (_e, { historyRelPath, sheltersRoot }: { historyRelPath: string; sheltersRoot: string }) =>
      readHistory(historyRelPath, sheltersRoot),
  );

  ipcMain.handle(
    CHANNELS.HISTORY_WRITE,
    (
      _e,
      { historyRelPath, content, sheltersRoot }: { historyRelPath: string; content: string; sheltersRoot: string },
    ) => writeHistory(historyRelPath, content, sheltersRoot),
  );
}
