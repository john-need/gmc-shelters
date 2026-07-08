import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { WebSearchResponse } from '../../shared/ipc-types';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runWebResearch } from '../ai/web-research';
import { fetchAndCacheImage } from '../ai/web-research-images';

export function registerResearchWebSearchHandlers(): void {
  ipcMain.handle(CHANNELS.RESEARCH_WEB_SEARCH, async (_e, query: string, context?: string): Promise<WebSearchResponse> => {
    const apiKey = readStoredApiKey();
    if (!apiKey) return { ok: false, error: 'no_api_key' };

    const model = resolvePrimaryModel(readStoredModelTier());
    const outcome = await runWebResearch(apiKey, model, query, { context });
    if (!outcome.ok) return outcome;

    const results = await Promise.all(outcome.results.map(async (r) => ({
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      localImagePath: r.imageUrl ? await fetchAndCacheImage(r.imageUrl) : null,
    })));

    return { ok: true, results };
  });
}
