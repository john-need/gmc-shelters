import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type {
  CollectionDefaultsRequest,
  CollectionDefaultsResult,
  CollectionsProgress,
  CollectionsRunRequest,
  CollectionsRunResult,
  CollectionStatus,
} from '../../shared/ipc-types';
import { COLLECTION_DEFAULT_PROPERTIES } from '../../shared/wiki-header-schema';
import { readWikiHeader, wikiMdPath, writeWikiHeader } from './wiki-search';

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

  ipcMain.handle(
    CHANNELS.COLLECTIONS_SET_DEFAULTS,
    async (_e, request: CollectionDefaultsRequest): Promise<CollectionDefaultsResult> => {
      const { name, oldCitationType, citationType, oldDefaults, defaults } = request;
      const root = app.getAppPath();

      const payload = JSON.stringify({ citation_type: citationType, ...defaults });
      const { code, stderr } = await python([
        path.join(root, 'scripts', 'set_collection_defaults.py'), name, payload,
      ]);
      if (code !== 0) return { ok: false, updated: 0, error: stderr.slice(-500) || `exit code ${code}` };

      const collectionDir = path.join(root, 'collections', name);
      let files: string[] = [];
      try {
        files = fs.readdirSync(collectionDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
      } catch {
        files = [];
      }

      let updated = 0;
      for (const file of files) {
        const mdPath = wikiMdPath(root, `collections/${name}/${file}`);
        const current = readWikiHeader(mdPath);
        if (!current) continue; // not yet added to the wiki

        let changed = false;
        const nextFields = { ...current.fields };
        for (const prop of COLLECTION_DEFAULT_PROPERTIES) {
          if (defaults[prop] === oldDefaults[prop]) continue; // this property wasn't changed
          const value = current.fields[prop] ?? '';
          if (value === '' || value === (oldDefaults[prop] ?? '')) {
            nextFields[prop] = defaults[prop];
            changed = true;
          }
        }

        let nextCitationType = current.citationType;
        if (citationType !== oldCitationType &&
            (!current.citationType || current.citationType === oldCitationType)) {
          nextCitationType = citationType;
          changed = true;
        }

        if (changed) {
          writeWikiHeader(mdPath, nextCitationType, nextFields);
          updated += 1;
        }
      }

      return { ok: true, updated };
    },
  );

  ipcMain.handle(
    CHANNELS.COLLECTIONS_ADD_FILES,
    (_e, { collection, sourcePaths }: { collection: string; sourcePaths: string[] }) => {
      const destDir = path.join(app.getAppPath(), 'collections', collection);
      fs.mkdirSync(destDir, { recursive: true });
      const existing = new Set(fs.readdirSync(destDir));
      const added: string[] = [];
      const skipped: string[] = [];
      for (const src of sourcePaths) {
        const base = path.basename(src);
        if (!base.toLowerCase().endsWith('.pdf') || existing.has(base)) {
          skipped.push(base);
          continue;
        }
        fs.copyFileSync(src, path.join(destDir, base));
        existing.add(base);
        added.push(base);
      }
      return { added, skipped };
    },
  );

  ipcMain.handle(
    CHANNELS.COLLECTIONS_DELETE_FILE,
    (_e, { collection, file }: { collection: string; file: string }): { ok: boolean } => {
      const collectionsRoot = path.join(app.getAppPath(), 'collections') + path.sep;
      const filePath = path.join(app.getAppPath(), 'collections', collection, file);
      if (!filePath.startsWith(collectionsRoot)) return { ok: false };
      try {
        fs.unlinkSync(filePath);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
  );

  ipcMain.handle(CHANNELS.COLLECTIONS_DELETE, (_e, { name }: { name: string }): { ok: boolean } => {
    const collectionsRoot = path.join(app.getAppPath(), 'collections') + path.sep;
    const dir = path.join(app.getAppPath(), 'collections', name);
    if (!dir.startsWith(collectionsRoot)) return { ok: false };
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });
}
