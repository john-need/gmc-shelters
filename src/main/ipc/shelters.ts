import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { getAllShelters, getShelterById, createShelter, updateShelter, deleteShelter } from '../db/shelters';
import { ensureShelterDir } from '../fs/photos';
import { writeHistory } from '../fs/history';
import { log } from '../logger';
import type { Shelter, ShelterCreateInput } from '../../shared/ipc-types';

export function registerShelterHandlers(): void {
  ipcMain.handle(CHANNELS.SHELTERS_GET_ALL, () => {
    try {
      const results = getAllShelters();
      log.info(`[ipc] SHELTERS_GET_ALL → ${results.length} rows`);
      return results;
    } catch (err) {
      log.error(`[ipc] SHELTERS_GET_ALL error: ${err}`);
      throw err;
    }
  });

  ipcMain.handle(CHANNELS.SHELTERS_GET_BY_ID, (_e, { id }: { id: number }) =>
    getShelterById(id),
  );

  ipcMain.handle(CHANNELS.SHELTERS_CREATE, async (_e, input: ShelterCreateInput) => {
    const shelter = createShelter(input);
    await ensureShelterDir(shelter.slug);
    const initialHistory = `# ${shelter.name}\n\n*${shelter.start_year} – present*\n\n## History\n\n_Add the history of this shelter here._\n`;
    await writeHistory(shelter.slug, initialHistory);
    return shelter;
  });

  ipcMain.handle(CHANNELS.SHELTERS_UPDATE, (_e, shelter: Shelter) =>
    updateShelter(shelter),
  );

  ipcMain.handle(CHANNELS.SHELTERS_DELETE, (_e, { id }: { id: number }) =>
    deleteShelter(id),
  );
}
