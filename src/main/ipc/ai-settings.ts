import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { AiModelTier } from '../../shared/ipc-types';

// Shared with the Python pipeline (scripts/lib/llm_client.py KEY_FILENAME).
// Lives at the repo root so CLI scripts find it; gitignored and chmod 600.
const KEY_FILENAME = '.anthropic_api_key';

// Shared with the Python pipeline (scripts/lib/llm_client.py MODEL_FILENAME).
const MODEL_FILENAME = '.ai_model';
const MODEL_TIERS: AiModelTier[] = ['default', 'escalation'];

function keyPath(): string {
  return path.join(app.getAppPath(), KEY_FILENAME);
}

function modelPath(): string {
  return path.join(app.getAppPath(), MODEL_FILENAME);
}

export function registerAiSettingsHandlers(): void {
  ipcMain.handle(CHANNELS.AI_GET_API_KEY, (): string => {
    try {
      return fs.readFileSync(keyPath(), 'utf8').trim();
    } catch {
      return '';
    }
  });

  ipcMain.handle(CHANNELS.AI_SET_API_KEY, (_e, { key }: { key: string }) => {
    const trimmed = key.trim();
    if (!trimmed) {
      fs.rmSync(keyPath(), { force: true });
      return;
    }
    fs.writeFileSync(keyPath(), trimmed + '\n', { encoding: 'utf8', mode: 0o600 });
    // writeFileSync mode only applies on create — enforce on overwrite too
    fs.chmodSync(keyPath(), 0o600);
  });

  ipcMain.handle(CHANNELS.AI_GET_MODEL, (): AiModelTier => {
    try {
      const tier = fs.readFileSync(modelPath(), 'utf8').trim();
      return (MODEL_TIERS as string[]).includes(tier) ? (tier as AiModelTier) : 'default';
    } catch {
      return 'default';
    }
  });

  ipcMain.handle(CHANNELS.AI_SET_MODEL, async (_e, { tier }: { tier: AiModelTier }) => {
    if (!MODEL_TIERS.includes(tier)) {
      throw new Error(`Invalid model tier: ${tier}`);
    }
    fs.writeFileSync(modelPath(), tier + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(modelPath(), 0o600);
  });
}
