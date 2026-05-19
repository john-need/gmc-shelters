import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import {
  getAllArchitectures,
  createArchitecture,
  updateArchitecture,
  deleteArchitecture,
} from '../db/architectures';
import type { Architecture, ArchitectureInput } from '../../shared/ipc-types';

export function registerArchitectureHandlers(): void {
  ipcMain.handle(CHANNELS.ARCHITECTURES_GET_ALL, () => getAllArchitectures());

  ipcMain.handle(CHANNELS.ARCHITECTURES_CREATE, (_e, input: ArchitectureInput) =>
    createArchitecture(input),
  );

  ipcMain.handle(CHANNELS.ARCHITECTURES_UPDATE, (_e, arch: Architecture) =>
    updateArchitecture(arch),
  );

  ipcMain.handle(
    CHANNELS.ARCHITECTURES_DELETE,
    (_e, { id, reassignTo }: { id: number; reassignTo?: string }) =>
      deleteArchitecture(id, reassignTo),
  );
}
