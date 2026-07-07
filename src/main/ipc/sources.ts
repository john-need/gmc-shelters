import { spawn } from 'child_process';
import path from 'path';
import { app, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import {
  getSourcesByShelter, getAllSources, createSource, updateSource, deleteSource,
  getSourceQuote, updateSourceQuote,
} from '../db/sources';
import type { Source, SourceInput } from '../../shared/ipc-types';

// Small local copy of collections.ts's python() helper — kept separate rather
// than extracted into a shared module (research.md Decision 1).
function spawnPython(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('python3', args, { cwd: app.getAppPath() });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code: number | null) => resolve({ code, stdout, stderr }));
  });
}

export function registerSourceHandlers(): void {
  ipcMain.handle(
    CHANNELS.SOURCES_GET_BY_SHELTER,
    (_e, { shelterId }: { shelterId: number }) => getSourcesByShelter(shelterId),
  );

  ipcMain.handle(CHANNELS.SOURCES_GET_ALL, () => getAllSources());

  ipcMain.handle(CHANNELS.SOURCES_CREATE, (_e, input: SourceInput) => createSource(input));

  ipcMain.handle(CHANNELS.SOURCES_UPDATE, (_e, source: Source) => updateSource(source));

  ipcMain.handle(CHANNELS.SOURCES_DELETE, (_e, { id }: { id: number }) => deleteSource(id));

  ipcMain.handle(
    CHANNELS.SOURCES_CLEAN_QUOTE,
    async (_e, { id, shelterId }: { id: number; shelterId: number }): Promise<Source> => {
      const quote = getSourceQuote(shelterId, id);
      const script = path.join(app.getAppPath(), 'scripts', 'clean_quote.py');
      const { code, stdout, stderr } = await spawnPython([script, quote]);
      if (code !== 0) {
        throw new Error(stderr.trim() || `clean_quote.py exited with code ${code}`);
      }
      return updateSourceQuote(shelterId, id, stdout.trim());
    },
  );
}
