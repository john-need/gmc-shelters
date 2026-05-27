import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import type { HistoryReadResult } from '../../shared/ipc-types';
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

function resolvedHistoryPath(historyRelPath: string, sheltersRoot: string): string {
  return path.join(resolveSheltersRoot(sheltersRoot), historyRelPath);
}

export async function readHistory(historyRelPath: string, sheltersRoot: string): Promise<HistoryReadResult> {
  try {
    return {
      content: await fs.readFile(resolvedHistoryPath(historyRelPath, sheltersRoot), 'utf8'),
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

export async function writeHistory(historyRelPath: string, content: string, sheltersRoot: string): Promise<void> {
  const filePath = resolvedHistoryPath(historyRelPath, sheltersRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  log.info(`History written: ${filePath}`);
}
