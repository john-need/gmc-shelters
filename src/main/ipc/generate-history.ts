import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { GenerateHistoryRequest, GenerateHistoryResponse, Source } from '../../shared/ipc-types';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runGenerateHistory } from '../ai/generate-history';
import { getWikiPageBody } from './wiki-search';

// Wiki-sourced citations (see wikiResultToSource) carry the PDF's repo-relative
// path in archive_location and its page number in pages — web_fetch can't reach
// them since they're local scans, not URLs, so pull the page text in directly.
function collectWikiExcerpts(citations: Source[]): Record<number, string> {
  const excerpts: Record<number, string> = {};
  for (const c of citations) {
    if (!c.archive_location.startsWith('collections/')) continue;
    const page = parseInt(c.pages, 10);
    if (!page) continue;
    const body = getWikiPageBody(c.archive_location, page);
    if (body) excerpts[c.id] = body;
  }
  return excerpts;
}

export function registerGenerateHistoryHandlers(): void {
  ipcMain.handle(CHANNELS.HISTORY_GENERATE, async (_e, request: GenerateHistoryRequest): Promise<GenerateHistoryResponse> => {
    const apiKey = readStoredApiKey();
    if (!apiKey) return { ok: false, error: 'no_api_key' };

    const model = resolvePrimaryModel(readStoredModelTier());
    const wikiExcerpts = collectWikiExcerpts(request.citations);
    return runGenerateHistory(apiKey, model, request, { wikiExcerpts });
  });
}
