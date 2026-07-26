import { runGenerateDescription } from './generate-description';
import type { GenerateDescriptionRequest } from '../../shared/ipc-types';

function textResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function claudeResponse(text: string) {
  return textResponse({ content: [{ type: 'text', text }] });
}

function request(overrides: Partial<GenerateDescriptionRequest> = {}): GenerateDescriptionRequest {
  return {
    shelter: {
      name: 'Birch Glen Lodge', architecture: 'Adirondack', built_by: 'Green Mountain Club',
      description: '', notes: '', start_year: 1932, end_year: null, is_extant: true, is_gmc: true,
      category: 'Lean-to',
    },
    historyContent: '# Birch Glen Lodge\n\nBuilt in 1932 by volunteers.\n',
    ...overrides,
  };
}

describe('runGenerateDescription', () => {
  it('sends a single non-streaming request with no tools, containing the shelter facts and history text', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A cozy Adirondack lean-to.'));
    await runGenerateDescription('sk-ant-key', 'claude-haiku-4-5-20251001', request(), { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
    expect(body.tools).toBeUndefined();
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toContain('Birch Glen Lodge');
    expect(body.messages[0].content).toContain('Built in 1932 by volunteers');
    expect(body.messages[0].content).toMatch(/350 char/i);
  });

  it('tolerates blank history content', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('A description with no history yet.'));
    await runGenerateDescription('sk-ant-key', 'model-x', request({ historyContent: '' }), { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns the trimmed description text on a well-formed response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(claudeResponse('  A cozy Adirondack lean-to.  '));
    const result = await runGenerateDescription('sk-ant-key', 'model-x', request(), { fetchImpl });
    expect(result).toEqual({ ok: true, description: 'A cozy Adirondack lean-to.' });
  });

  it('maps a non-2xx response to a network error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(textResponse({ error: 'bad' }, 500));
    const result = await runGenerateDescription('sk-ant-key', 'model-x', request(), { fetchImpl });
    expect(result).toEqual({ ok: false, error: 'network' });
  });

  it('maps a thrown fetch error to a network error', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const result = await runGenerateDescription('sk-ant-key', 'model-x', request(), { fetchImpl });
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
    const result = await runGenerateDescription('sk-ant-key', 'model-x', request(), { fetchImpl, timeoutMs: 10 });
    expect(result).toEqual({ ok: false, error: 'timeout' });
  });
});
