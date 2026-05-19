import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import type { HistoryReadResult } from '../../shared/ipc-types';
import { historyFileName } from '../../shared/history-file';
import { log } from '../logger';

function resolveSheltersRoot(sheltersRoot: string): string {
  const trimmed = sheltersRoot.trim();
  if (trimmed === '~') {
    return os.homedir();
  }
  if (trimmed.startsWith('~/')) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  if (path.isAbsolute(trimmed)) {
    return trimmed;
  }
  return path.resolve(app.getAppPath(), trimmed);
}

function historyPath(slug: string, sheltersRoot: string): string {
  return path.join(resolveSheltersRoot(sheltersRoot), slug, historyFileName(slug));
}

export async function readHistory(slug: string, sheltersRoot: string): Promise<HistoryReadResult> {
  try {
    return {
      content: await fs.readFile(historyPath(slug, sheltersRoot), 'utf8'),
      missing: false,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        content: '',
        missing: true,
      };
    }
    throw error;
  }
}

export async function writeHistory(slug: string, content: string, sheltersRoot: string): Promise<void> {
  const filePath = historyPath(slug, sheltersRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  log.info(`History written: ${filePath}`);
}
