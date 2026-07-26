import { ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import type { GenerateHistoryEvent, GenerateHistoryRequest, GenerateHistoryResponse, Source } from '../../shared/ipc-types';
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

// Keyed by the Anthropic tool_use id, so the permission_request event sent to the
// renderer and the eventual respondToPermission call always agree on one id.
const pendingPermissions = new Map<string, (approved: boolean) => void>();

export function registerGenerateHistoryHandlers(): void {
  ipcMain.handle(CHANNELS.HISTORY_GENERATE, async (event, request: GenerateHistoryRequest): Promise<GenerateHistoryResponse> => {
    const apiKey = readStoredApiKey();
    if (!apiKey) return { ok: false, error: 'no_api_key' };

    const model = resolvePrimaryModel(readStoredModelTier());
    const wikiExcerpts = collectWikiExcerpts(request.citations);

    return runGenerateHistory(apiKey, model, request, {
      wikiExcerpts,
      onEvent: (evt: GenerateHistoryEvent) => event.sender.send(CHANNELS.HISTORY_GENERATE_PROGRESS, evt),
      requestPermission: (_tool, _input, requestId) => new Promise<boolean>((resolve) => {
        pendingPermissions.set(requestId, resolve);
      }),
    });
  });

  ipcMain.handle(CHANNELS.HISTORY_GENERATE_RESPOND, (_e, { requestId, approved }: { requestId: string; approved: boolean }) => {
    const resolve = pendingPermissions.get(requestId);
    if (!resolve) return;
    pendingPermissions.delete(requestId);
    resolve(approved);
  });
}
