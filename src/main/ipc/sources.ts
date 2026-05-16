import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { getSourcesByShelter, createSource, updateSource, deleteSource } from '../db/sources';
import type { Source, SourceInput } from '../../shared/ipc-types';

export function registerSourceHandlers(): void {
  ipcMain.handle(
    CHANNELS.SOURCES_GET_BY_SHELTER,
    (_e, { shelterId }: { shelterId: number }) => getSourcesByShelter(shelterId),
  );

  ipcMain.handle(CHANNELS.SOURCES_CREATE, (_e, input: SourceInput) => createSource(input));

  ipcMain.handle(CHANNELS.SOURCES_UPDATE, (_e, source: Source) => updateSource(source));

  ipcMain.handle(CHANNELS.SOURCES_DELETE, (_e, { id }: { id: number }) => deleteSource(id));
}
