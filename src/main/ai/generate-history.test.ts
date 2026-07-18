import { runGenerateHistory } from './generate-history';
import type { GenerateHistoryRequest, Source } from '../../shared/ipc-types';

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

describe('ai/generate-history runGenerateHistory', () => {
  it('builds a request with the resolved model, the web_search tool, and a prompt containing the shelter facts, citations, and current history', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A narrative.'));
    await runGenerateHistory('sk-ant-key', 'claude-haiku-4-5-20251001', request(), { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]);

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
    ]);
    expect(body.messages[0].content.toLowerCase()).toContain('web_fetch');
  });

  it('omits the web_fetch tool when there are no website citations with a URL', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A narrative.'));
    const citations = [source({ type: 'book' }), source({ type: 'website', url: '' })];
    await runGenerateHistory('sk-ant-key', 'model-x', request({ citations }), { fetchImpl });

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]);
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
    // no website citations here, so no web_fetch instruction or tool
    expect(promptText.toLowerCase()).not.toContain('web_fetch');
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]);
  });

  it('returns the joined and trimmed narrative text on a well-formed response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('  A shelter history.  '));
    const result = await runGenerateHistory('sk-ant-key', 'model-x', request(), { fetchImpl });
    expect(result).toEqual({ ok: true, narrative: 'A shelter history.' });
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
});
