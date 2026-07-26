import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { GenerateDescriptionRequest, GenerateDescriptionResponse } from '../../shared/ipc-types';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runGenerateDescription } from '../ai/generate-description';

export function registerGenerateDescriptionHandlers(): void {
  ipcMain.handle(CHANNELS.SHELTER_GENERATE_DESCRIPTION, async (_e, request: GenerateDescriptionRequest): Promise<GenerateDescriptionResponse> => {
    const apiKey = readStoredApiKey();
    if (!apiKey) return { ok: false, error: 'no_api_key' };

    const model = resolvePrimaryModel(readStoredModelTier());
    return runGenerateDescription(apiKey, model, request);
  });
}
