import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { readHistory, writeHistory } from '../fs/history';

export function registerHistoryHandlers(): void {
  ipcMain.handle(CHANNELS.HISTORY_READ, (_e, { slug }: { slug: string }) => readHistory(slug));

  ipcMain.handle(
    CHANNELS.HISTORY_WRITE,
    (_e, { slug, content }: { slug: string; content: string }) => writeHistory(slug, content),
  );
}
