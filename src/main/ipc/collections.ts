import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { app, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type {
  CollectionsProgress,
  CollectionsRunRequest,
  CollectionsRunResult,
  CollectionStatus,
} from '../../shared/ipc-types';

// One conversion at a time — the cache makes cancel/retry safe.
let activeChild: ChildProcess | null = null;
let cancelRequested = false;

const PROGRESS_LINE = /^\s{2}(proc|ok|cache|FAIL)\s+(.+?)(?:\s+\(.*)?$/;
const AUDIT_LINE = /Audit:\s*(\d+) converted, (\d+) cached, (\d+) failed/;

function python(args: string[], onStdout?: (chunk: string) => void): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('python3', args, { cwd: app.getAppPath() });
    activeChild = child;
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d: Buffer) => {
      const text = d.toString();
      stdout += text;
      onStdout?.(text);
    });
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code: number | null) => {
      activeChild = null;
      resolve({ code, stdout, stderr });
    });
  });
}

export function registerCollectionsHandlers(): void {
  ipcMain.handle(CHANNELS.COLLECTIONS_STATUS, async (): Promise<CollectionStatus[]> => {
    const root = app.getAppPath();
    const { code, stdout } = await python([path.join(root, 'scripts', 'collection_status.py')]);
    if (code !== 0) return [];
    try {
      return JSON.parse(stdout) as CollectionStatus[];
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    CHANNELS.COLLECTIONS_RUN,
    async (event, { mode, files, force }: CollectionsRunRequest): Promise<CollectionsRunResult> => {
      if (activeChild) {
        return { ok: false, converted: 0, cached: 0, failed: 0, error: 'A run is already running.' };
      }
      cancelRequested = false;
      const root = app.getAppPath();

      const args = [path.join(root, 'collections', 'ocr_to_markdown.py')];
      if (mode === 'add') args.push('--no-clean', '--no-images');
      if (force) args.push('--force');
      if (files.length) args.push('--files', ...files);

      const sendProgress = (p: CollectionsProgress) =>
        event.sender.send(CHANNELS.COLLECTIONS_PROGRESS, p);

      const { code, stdout, stderr } = await python(args, (chunk) => {
        for (const line of chunk.split('\n')) {
          const m = PROGRESS_LINE.exec(line);
          if (m) {
            const kind = m[1] === 'FAIL' ? 'fail' : (m[1] as CollectionsProgress['kind']);
            sendProgress({ kind, file: m[2] });
          }
        }
      });

      const audit = AUDIT_LINE.exec(stdout);
      const counts = {
        converted: audit ? parseInt(audit[1], 10) : 0,
        cached: audit ? parseInt(audit[2], 10) : 0,
        failed: audit ? parseInt(audit[3], 10) : 0,
      };

      if (cancelRequested) {
        return { ok: false, canceled: true, ...counts };
      }
      if (code !== 0) {
        return { ok: false, error: stderr.slice(-500) || `exit code ${code}`, ...counts };
      }

      sendProgress({ kind: 'index' });
      const index = await python([path.join(root, 'scripts', 'build_wiki_index.py')]);
      if (index.code !== 0) {
        return { ok: false, error: `index rebuild failed: ${index.stderr.slice(-300)}`, ...counts };
      }
      return { ok: true, ...counts };
    },
  );

  ipcMain.handle(CHANNELS.COLLECTIONS_CANCEL, () => {
    if (activeChild) {
      cancelRequested = true;
      activeChild.kill();
    }
  });
}
