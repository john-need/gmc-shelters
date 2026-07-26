jest.mock('../ipc/wiki-search');

import { runGenerateHistory } from './generate-history';
import type { GenerateHistoryRequest, Source } from '../../shared/ipc-types';
import { searchWiki, getWikiPageBody } from '../ipc/wiki-search';

function textResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function claudeResponse(finalText: string) {
  return textResponse({
    content: [
      { type: 'server_tool_use', id: 'srvtool_1', name: 'web_search', input: { query: 'whatever' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtool_1', content: [] },
      { type: 'text', text: finalText },
    ],
  });
}

function toolUseResponse(name: string, id: string, input: Record<string, unknown>) {
  return textResponse({
    content: [
      { type: 'text', text: `Let me use ${name}.` },
      { type: 'tool_use', id, name, input },
    ],
  });
}

const SEARCH_COLLECTIONS_TOOL = {
  name: 'search_collections',
  description: 'Full-text search over the GMC shelters wiki collections (newsletters, guidebooks, reports) for facts not covered by the given citations.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms; wrap a phrase in double quotes for an exact match' },
      collections: { type: 'array', items: { type: 'string' }, description: 'Limit to these collection names; omit to search all' },
    },
    required: ['query'],
  },
};

const DOWNLOAD_DOCUMENT_TOOL = {
  name: 'download_document',
  description: 'Read the digitized page text for a search_collections result, by its `resource` and `page` fields, to check facts against the primary source.',
  input_schema: {
    type: 'object',
    properties: {
      resource: { type: 'string', description: 'The `resource` field from a search_collections result' },
      page: { type: 'number', description: 'The `page` field from a search_collections result' },
    },
    required: ['resource', 'page'],
  },
};

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: true,
    type: 'book',
    author: 'Doe, Jane',
    title: 'Shelter Notes',
    container_title: '', container_author: '',
    editor: '',
    edition: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    place: '',
    year: null,
    date: '',
    url: '',
    access_date: '',
    archive: '',
    archive_location: '',
    annotation: '',
    notes: '',
    quote: '',
    created: '2020-01-01',
    updated: '2020-01-02',
    ...overrides,
  };
}

function request(overrides: Partial<GenerateHistoryRequest> = {}): GenerateHistoryRequest {
  return {
    shelter: {
      name: 'Aeolus View Camp',
      architecture: 'Adirondack lean-to',
      built_by: 'CCC Crew 12',
      description: '',
      notes: '',
      start_year: 1932,
      end_year: null,
      is_extant: true,
      is_gmc: true,
      category: 'Shelter',
    },
    citations: [source()],
    currentHistory: 'Existing draft prose.',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ai/generate-history runGenerateHistory', () => {
  it('builds a request with the resolved model, the web_search + client tools, and a prompt containing the shelter facts, citations, and current history', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A narrative.'));
    await runGenerateHistory('sk-ant-key', 'claude-haiku-4-5-20251001', request(), { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.tools).toEqual([
      { type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] },
      SEARCH_COLLECTIONS_TOOL,
      DOWNLOAD_DOCUMENT_TOOL,
    ]);

    const promptText = body.messages[0].content;
    expect(promptText).toContain('Aeolus View Camp');
    expect(promptText).toContain('Adirondack lean-to');
    expect(promptText).toContain('CCC Crew 12');
    expect(promptText).toContain('Doe, Jane. *Shelter Notes*.');
    expect(promptText).toContain('Existing draft prose.');
    expect(promptText.toLowerCase()).toContain('add your own');
    expect(promptText.toLowerCase()).toContain('do not include a top-level title heading');
    expect(promptText.toLowerCase()).toContain('do not include a sources');
  });

  it('adds a web_fetch tool sized to the website citation count, and instructs fetching them, when website citations are present', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A narrative.'));
    const citations = [
      source({ type: 'website', url: 'https://example.com/a' }),
      source({ type: 'website', url: 'https://example.com/b' }),
      source({ type: 'book' }),
    ];
    await runGenerateHistory('sk-ant-key', 'model-x', request({ citations }), { fetchImpl });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      { type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] },
      { type: 'web_fetch_20250910', name: 'web_fetch', max_uses: 2, citations: { enabled: true }, allowed_callers: ['direct'] },
      SEARCH_COLLECTIONS_TOOL,
      DOWNLOAD_DOCUMENT_TOOL,
    ]);
    expect(body.messages[0].content.toLowerCase()).toContain('web_fetch');
  });

  it('omits the web_fetch tool when there are no website citations with a URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A narrative.'));
    const citations = [source({ type: 'book' }), source({ type: 'website', url: '' })];
    await runGenerateHistory('sk-ant-key', 'model-x', request({ citations }), { fetchImpl });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.tools).toEqual([
      { type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] },
      SEARCH_COLLECTIONS_TOOL,
      DOWNLOAD_DOCUMENT_TOOL,
    ]);
  });

  it('inlines a wiki page excerpt beneath its citation, and instructs treating it as primary source text, when wikiExcerpts are supplied', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A narrative.'));
    const citations = [source({ id: 5, type: 'book', archive_location: 'collections/long-trail-news/x.pdf', pages: '3' })];
    await runGenerateHistory('sk-ant-key', 'model-x', request({ citations }), {
      fetchImpl,
      wikiExcerpts: { 5: 'Killington Peak drew a record crowd of hikers this season.' },
    });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    const promptText = body.messages[0].content;
    expect(promptText).toContain('Killington Peak drew a record crowd of hikers this season.');
    expect(promptText.toLowerCase()).toContain('primary source text');
    // no website citations here, so no web_fetch tool
    expect(body.tools).toEqual([
      { type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] },
      SEARCH_COLLECTIONS_TOOL,
      DOWNLOAD_DOCUMENT_TOOL,
    ]);
  });

  it('returns the joined and trimmed narrative text on a well-formed response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('  A shelter history.  '));
    const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl });
    expect(result).toEqual({ ok: true, narrative: 'A shelter history.' });
  });

  it('emits a text event for each turn and reports server-executed tool calls/results as they happen', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A shelter history.'));
    const onEvent = jest.fn();
    await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, onEvent });

    expect(onEvent).toHaveBeenCalledWith({ type: 'text', text: 'A shelter history.' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'tool_call', tool: 'web_search', input: { query: 'whatever' } });
    expect(onEvent).toHaveBeenCalledWith({ type: 'tool_result', tool: 'web_search', ok: true, summary: '0 result(s)' });
  });

  it('maps a non-2xx response to a network error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(textResponse({ error: 'bad' }, 500));
    const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl });
    expect(result).toEqual({ ok: false, error: 'network' });
  });

  it('maps a thrown fetch error to a network error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl });
    expect(result).toEqual({ ok: false, error: 'network' });
  });

  it('maps an aborted/timed-out request to a timeout error', async () => {
    const fetchImpl = jest.fn().mockImplementation((_url: string, init: { signal: AbortSignal }) => (
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      })
    ));

    const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, timeoutMs: 10 });
    expect(result).toEqual({ ok: false, error: 'timeout' });
  });

  describe('client tool loop (search_collections / download_document)', () => {
    it('requests permission, then runs search_collections and feeds the results back on approval', async () => {
      (searchWiki as jest.Mock).mockReturnValue([{ title: 'Long Trail News 1932' }]);
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(toolUseResponse('search_collections', 'tool_1', { query: 'Aeolus' }))
        .mockResolvedValueOnce(claudeResponse('A shelter history grounded in the archive.'));
      const onEvent = jest.fn();
      const requestPermission = jest.fn().mockResolvedValue(true);

      const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, onEvent, requestPermission });

      expect(requestPermission).toHaveBeenCalledWith('search_collections', { query: 'Aeolus' }, 'tool_1');
      expect(searchWiki).toHaveBeenCalledWith('Aeolus', undefined);
      expect(onEvent).toHaveBeenCalledWith({ type: 'permission_request', requestId: 'tool_1', tool: 'search_collections', input: { query: 'Aeolus' } });
      expect(onEvent).toHaveBeenCalledWith({ type: 'tool_result', tool: 'search_collections', ok: true, summary: '1 result(s)' });
      expect(result).toEqual({ ok: true, narrative: 'A shelter history grounded in the archive.' });

      expect(fetchImpl).toHaveBeenCalledTimes(2);
      const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
      const toolResultMsg = secondBody.messages.at(-1);
      expect(toolResultMsg.role).toBe('user');
      expect(toolResultMsg.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tool_1', is_error: false });
    });

    it('sends a denial tool_result and continues the loop when permission is refused, without calling searchWiki', async () => {
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(toolUseResponse('search_collections', 'tool_1', { query: 'Aeolus' }))
        .mockResolvedValueOnce(claudeResponse('A shelter history without archive grounding.'));
      const onEvent = jest.fn();
      const requestPermission = jest.fn().mockResolvedValue(false);

      const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, onEvent, requestPermission });

      expect(searchWiki).not.toHaveBeenCalled();
      expect(onEvent).toHaveBeenCalledWith({ type: 'tool_result', tool: 'search_collections', ok: false, summary: 'Denied by user' });
      const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
      expect(secondBody.messages.at(-1).content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'tool_1', is_error: true });
      expect(result).toEqual({ ok: true, narrative: 'A shelter history without archive grounding.' });
    });

    it('runs download_document as a text tool_result of the digitized page, not the raw PDF, on approval', async () => {
      (getWikiPageBody as jest.Mock).mockReturnValue('Full page text from the archive.');
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(toolUseResponse('download_document', 'tool_2', { resource: 'collections/x/y.pdf', page: 42 }))
        .mockResolvedValueOnce(claudeResponse('A shelter history.'));
      const requestPermission = jest.fn().mockResolvedValue(true);

      await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, requestPermission });

      expect(getWikiPageBody).toHaveBeenCalledWith('collections/x/y.pdf', 42);
      const secondBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
      expect(secondBody.messages.at(-1).content[0]).toMatchObject({
        type: 'tool_result', tool_use_id: 'tool_2', is_error: false,
        content: [{ type: 'text', text: 'Full page text from the archive.' }],
      });
    });

    it('reports a failed download_document as an error tool_result when no digitized text exists for that page', async () => {
      (getWikiPageBody as jest.Mock).mockReturnValue(null);
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(toolUseResponse('download_document', 'tool_3', { resource: 'collections/x/missing.pdf', page: 1 }))
        .mockResolvedValueOnce(claudeResponse('A shelter history.'));
      const onEvent = jest.fn();
      const requestPermission = jest.fn().mockResolvedValue(true);

      await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, onEvent, requestPermission });

      expect(onEvent).toHaveBeenCalledWith({ type: 'tool_result', tool: 'download_document', ok: false, summary: 'No digitized text for that resource/page' });
    });

    it('defaults to denying when no requestPermission callback is supplied', async () => {
      const fetchImpl = jest.fn()
        .mockResolvedValueOnce(toolUseResponse('search_collections', 'tool_1', { query: 'Aeolus' }))
        .mockResolvedValueOnce(claudeResponse('A shelter history.'));

      await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl });

      expect(searchWiki).not.toHaveBeenCalled();
    });

    it('returns a max_turns error if the model keeps calling tools without ever finishing', async () => {
      const fetchImpl = jest.fn().mockResolvedValue(toolUseResponse('search_collections', 'tool_loop', { query: 'x' }));
      const requestPermission = jest.fn().mockResolvedValue(true);
      (searchWiki as jest.Mock).mockReturnValue([]);

      const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl, requestPermission });

      expect(result).toEqual({ ok: false, error: 'max_turns' });
    });
  });
});
