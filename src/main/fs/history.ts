import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { historyFileName } from '../../shared/history-file';
import { log } from '../logger';

function historyPath(slug: string): string {
  return path.join(app.getAppPath(), 'shelters', slug, historyFileName(slug));
}

export async function readHistory(slug: string): Promise<string> {
  try {
    return await fs.readFile(historyPath(slug), 'utf8');
  } catch {
    return '';
  }
}

export async function writeHistory(slug: string, content: string): Promise<void> {
  const filePath = historyPath(slug);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  log.info(`History written: ${filePath}`);
}
