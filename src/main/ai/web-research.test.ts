import { runWebResearch } from './web-research';

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

describe('ai/web-research runWebResearch', () => {
  it('builds a request with the resolved model, the web_search tool (max_uses 3), and the fixed prompt template', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('[]'));
    await runWebResearch('sk-ant-key', 'claude-haiku-4-5-20251001', 'Aeolus View Camp', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-key');
    expect(init.headers['anthropic-version']).toBeTruthy();
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.tools).toEqual([{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]);
    const promptText = body.messages[0].content;
    expect(promptText).toContain('research information about Aeolus View Camp');
    expect(promptText).toContain('return a list of primary sources');
    expect(promptText).toContain('look for photos if appropriate');
    expect(promptText.toLowerCase()).toContain('json');
  });

  it('appends the given context block to the prompt when provided', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('[]'));
    await runWebResearch('sk-ant-key', 'model-x', 'Aeolus View Camp', {
      fetchImpl,
      context: 'Shelter: Aeolus View Camp\nBuilt: 1932\n\nAlready-found sources:\n- Long Trail News: shelter built by CCC crew',
    });

    const [, init] = fetchImpl.mock.calls[0];
    const promptText = JSON.parse(init.body).messages[0].content;
    expect(promptText).toContain('Shelter: Aeolus View Camp');
    expect(promptText).toContain('Already-found sources:');
    expect(promptText).toContain('shelter built by CCC crew');
  });

  it('omits the context block entirely when none is given', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('[]'));
    await runWebResearch('sk-ant-key', 'model-x', 'Aeolus View Camp', { fetchImpl });

    const [, init] = fetchImpl.mock.calls[0];
    const promptText = JSON.parse(init.body).messages[0].content;
    expect(promptText).not.toContain('Already-found sources');
  });

  it('parses a well-formed trailing JSON array from the final text block', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse(
      'Some preamble.\n[{"title":"Long Trail News","url":"https://example.com/a","snippet":"a snippet","image_url":"https://example.com/a.jpg"},' +
      '{"title":"Trail Guide","url":"https://example.com/b","snippet":"another"}]',
    ));

    const result = await runWebResearch('sk-ant-key', 'model-x', 'query', { fetchImpl });

    expect(result).toEqual({
      ok: true,
      results: [
        { title: 'Long Trail News', url: 'https://example.com/a', snippet: 'a snippet', imageUrl: 'https://example.com/a.jpg' },
        { title: 'Trail Guide', url: 'https://example.com/b', snippet: 'another', imageUrl: undefined },
      ],
    });
  });

  it('drops entries missing a title or url', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse(
      '[{"title":"","url":"https://example.com/a","snippet":"x"},' +
      '{"title":"Has no url","url":"","snippet":"y"},' +
      '{"title":"Good","url":"https://example.com/c","snippet":"z"}]',
    ));

    const result = await runWebResearch('sk-ant-key', 'model-x', 'query', { fetchImpl });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.results).toEqual([
        { title: 'Good', url: 'https://example.com/c', snippet: 'z', imageUrl: undefined },
      ]);
    }
  });

  it('returns an empty result list (not an error) when no parseable JSON array is found', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('I could not find anything, sorry.'));
    const result = await runWebResearch('sk-ant-key', 'model-x', 'query', { fetchImpl });
    expect(result).toEqual({ ok: true, results: [] });
  });

  it('maps a non-2xx response to a network error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(textResponse({ error: 'bad' }, 500));
    const result = await runWebResearch('sk-ant-key', 'model-x', 'query', { fetchImpl });
    expect(result).toEqual({ ok: false, error: 'network' });
  });

  it('maps a thrown fetch error to a network error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await runWebResearch('sk-ant-key', 'model-x', 'query', { fetchImpl });
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

    const result = await runWebResearch('sk-ant-key', 'model-x', 'query', { fetchImpl, timeoutMs: 10 });
    expect(result).toEqual({ ok: false, error: 'timeout' });
  });
});
