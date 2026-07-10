import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { GenerateHistoryRequest, GenerateHistoryResponse } from '../../shared/ipc-types';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runGenerateHistory } from '../ai/generate-history';

export function registerGenerateHistoryHandlers(): void {
  ipcMain.handle(CHANNELS.HISTORY_GENERATE, async (_e, request: GenerateHistoryRequest): Promise<GenerateHistoryResponse> => {
    const apiKey = readStoredApiKey();
    if (!apiKey) return { ok: false, error: 'no_api_key' };

    const model = resolvePrimaryModel(readStoredModelTier());
    return runGenerateHistory(apiKey, model, request);
  });
}
