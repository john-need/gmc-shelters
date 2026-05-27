import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { getAllShelters, getShelterById, createShelter, updateShelter, deleteShelter, setShelterHistory } from '../db/shelters';
import { syncMarkersFromShelter } from '../db/map-markers';
import { ensureShelterDir, deleteShelterDir } from '../fs/photos';
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
    await ensureShelterDir(shelter.slug, input.sheltersRoot);
    const historyRelPath = shelter.history ?? `${shelter.slug}/${shelter.slug}.md`;
    const initialHistory = `# ${shelter.name}\n\n*${shelter.start_year} – present*\n\n## History\n\n_Add the history of this shelter here._\n`;
    await writeHistory(historyRelPath, initialHistory, input.sheltersRoot);
    return shelter;
  });

  ipcMain.handle(CHANNELS.SHELTERS_UPDATE, (_e, shelter: Shelter) => {
    const updated = updateShelter(shelter);
    syncMarkersFromShelter(updated);
    return updated;
  });

  ipcMain.handle(
    CHANNELS.SHELTERS_DELETE,
    async (_e, { id, slug, sheltersRoot }: { id: number; slug: string; sheltersRoot: string }) => {
      deleteShelter(id);
      await deleteShelterDir(slug, sheltersRoot);
    },
  );

  ipcMain.handle(
    CHANNELS.SHELTERS_SET_HISTORY,
    (_e, { id, history }: { id: number; history: string }) => {
      setShelterHistory(id, history);
    },
  );
}
