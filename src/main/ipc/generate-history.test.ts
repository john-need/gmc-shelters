jest.mock('electron');
jest.mock('./ai-settings');
jest.mock('../ai/models');
jest.mock('../ai/generate-history');
jest.mock('./wiki-search');

import { ipcMain } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import type { GenerateHistoryRequest, Source } from '@shared/ipc-types';
import { registerGenerateHistoryHandlers } from './generate-history';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runGenerateHistory } from '../ai/generate-history';
import { getWikiPageBody } from './wiki-search';

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: true,
    type: 'book',
    author: '', title: '', container_title: '', container_author: '',
    editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
    year: null, date: '', url: '', access_date: '', archive: '', archive_location: '',
    annotation: '', notes: '', quote: '',
    created: '2020-01-01', updated: '2020-01-02',
    ...overrides,
  };
}

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (event: unknown, arg: unknown) => Promise<unknown> | unknown;
}

function fakeEvent() {
  return { sender: { send: jest.fn() } };
}

function request(): GenerateHistoryRequest {
  return {
    shelter: {
      name: 'Aeolus View Camp',
      architecture: '',
      built_by: '',
      description: '',
      notes: '',
      start_year: 1932,
      end_year: null,
      is_extant: true,
      is_gmc: true,
      category: 'Shelter',
    },
    citations: [],
    currentHistory: '',
  };
}

describe('ipc/generate-history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readStoredModelTier as jest.Mock).mockReturnValue('default');
    (resolvePrimaryModel as jest.Mock).mockReturnValue('claude-haiku-4-5-20251001');
    registerGenerateHistoryHandlers();
  });

  it('returns no_api_key with zero network calls when no key is stored', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('');
    const handler = getHandler(CHANNELS.HISTORY_GENERATE);

    const result = await handler(fakeEvent(), request());

    expect(result).toEqual({ ok: false, error: 'no_api_key' });
    expect(runGenerateHistory).not.toHaveBeenCalled();
  });

  it('resolves the model and calls runGenerateHistory when a key is stored, returning its outcome unchanged', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runGenerateHistory as jest.Mock).mockResolvedValue({ ok: true, narrative: 'A narrative.' });
    const handler = getHandler(CHANNELS.HISTORY_GENERATE);
    const req = request();

    const result = await handler(fakeEvent(), req);

    expect(resolvePrimaryModel).toHaveBeenCalledWith('default');
    expect(runGenerateHistory).toHaveBeenCalledWith(
      'sk-ant-test', 'claude-haiku-4-5-20251001', req,
      expect.objectContaining({ wikiExcerpts: {}, onEvent: expect.any(Function), requestPermission: expect.any(Function) }),
    );
    expect(result).toEqual({ ok: true, narrative: 'A narrative.' });
  });

  it('fetches a wiki excerpt for each citation sourced from a collections/ PDF and passes them to runGenerateHistory keyed by source id', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runGenerateHistory as jest.Mock).mockResolvedValue({ ok: true, narrative: 'A narrative.' });
    (getWikiPageBody as jest.Mock).mockImplementation((resource: string, page: number) =>
      (resource === 'collections/long-trail-news/x.pdf' && page === 3 ? 'Killington Peak drew a crowd.' : null));
    const handler = getHandler(CHANNELS.HISTORY_GENERATE);
    const req = request();
    req.citations = [
      source({ id: 5, archive_location: 'collections/long-trail-news/x.pdf', pages: '3' }),
      source({ id: 6, type: 'website', url: 'https://example.com' }), // not a wiki citation
      source({ id: 7, archive_location: 'collections/long-trail-news/x.pdf', pages: '' }), // no page, skipped
    ];

    await handler(fakeEvent(), req);

    expect(getWikiPageBody).toHaveBeenCalledWith('collections/long-trail-news/x.pdf', 3);
    expect(getWikiPageBody).toHaveBeenCalledTimes(1);
    expect(runGenerateHistory).toHaveBeenCalledWith(
      'sk-ant-test', 'claude-haiku-4-5-20251001', req,
      expect.objectContaining({ wikiExcerpts: { 5: 'Killington Peak drew a crowd.' } }),
    );
  });

  it('passes through a runGenerateHistory error response unchanged', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runGenerateHistory as jest.Mock).mockResolvedValue({ ok: false, error: 'timeout' });
    const handler = getHandler(CHANNELS.HISTORY_GENERATE);

    const result = await handler(fakeEvent(), request());

    expect(result).toEqual({ ok: false, error: 'timeout' });
  });

  it('forwards onEvent calls from runGenerateHistory to event.sender.send on the progress channel', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runGenerateHistory as jest.Mock).mockImplementation(async (_key, _model, _req, opts) => {
      opts.onEvent({ type: 'text', text: 'hello' });
      return { ok: true, narrative: 'hello' };
    });
    const handler = getHandler(CHANNELS.HISTORY_GENERATE);
    const event = fakeEvent();

    await handler(event, request());

    expect(event.sender.send).toHaveBeenCalledWith(CHANNELS.HISTORY_GENERATE_PROGRESS, { type: 'text', text: 'hello' });
  });

  it('resolves a pending requestPermission call when HISTORY_GENERATE_RESPOND fires with the matching requestId', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    let capturedApproval: boolean | undefined;
    (runGenerateHistory as jest.Mock).mockImplementation(async (_key, _model, _req, opts) => {
      capturedApproval = await opts.requestPermission('search_collections', { query: 'x' }, 'tool_1');
      return { ok: true, narrative: '' };
    });
    const generateHandler = getHandler(CHANNELS.HISTORY_GENERATE);
    const respondHandler = getHandler(CHANNELS.HISTORY_GENERATE_RESPOND);

    const generatePromise = generateHandler(fakeEvent(), request());
    await respondHandler(fakeEvent(), { requestId: 'tool_1', approved: true });
    await generatePromise;

    expect(capturedApproval).toBe(true);
  });

  it('ignores a respond call for an unknown or already-resolved requestId', () => {
    const respondHandler = getHandler(CHANNELS.HISTORY_GENERATE_RESPOND);
    expect(() => respondHandler(fakeEvent(), { requestId: 'nope', approved: true })).not.toThrow();
  });
});
