jest.mock('electron');
jest.mock('./ai-settings');
jest.mock('../ai/models');
jest.mock('../ai/web-research');
jest.mock('../ai/web-research-images');

import { ipcMain } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import { registerResearchWebSearchHandlers } from './research-web-search';
import { readStoredApiKey, readStoredModelTier } from './ai-settings';
import { resolvePrimaryModel } from '../ai/models';
import { runWebResearch } from '../ai/web-research';
import { fetchAndCacheImage } from '../ai/web-research-images';

function getHandler() {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === CHANNELS.RESEARCH_WEB_SEARCH);
  if (!call) throw new Error('No handler registered for RESEARCH_WEB_SEARCH');
  return call[1] as (event: unknown, query: string, context?: string) => Promise<unknown>;
}

describe('ipc/research-web-search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (readStoredModelTier as jest.Mock).mockReturnValue('default');
    (resolvePrimaryModel as jest.Mock).mockReturnValue('claude-haiku-4-5-20251001');
    registerResearchWebSearchHandlers();
  });

  it('returns no_api_key with zero network calls when no key is stored', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('');
    const handler = getHandler();

    const result = await handler(null, 'Aeolus View Camp');

    expect(result).toEqual({ ok: false, error: 'no_api_key' });
    expect(runWebResearch).not.toHaveBeenCalled();
  });

  it('resolves the model and calls runWebResearch when a key is stored, mapping results with localImagePath: null', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runWebResearch as jest.Mock).mockResolvedValue({
      ok: true,
      results: [
        { title: 'Long Trail News', url: 'https://example.com/a', snippet: 'a snippet', imageUrl: undefined },
      ],
    });
    const handler = getHandler();

    const result = await handler(null, 'Aeolus View Camp');

    expect(resolvePrimaryModel).toHaveBeenCalledWith('default');
    expect(runWebResearch).toHaveBeenCalledWith('sk-ant-test', 'claude-haiku-4-5-20251001', 'Aeolus View Camp', { context: undefined });
    expect(result).toEqual({
      ok: true,
      results: [
        { title: 'Long Trail News', url: 'https://example.com/a', snippet: 'a snippet', localImagePath: null },
      ],
    });
  });

  it('forwards a given context string through to runWebResearch', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runWebResearch as jest.Mock).mockResolvedValue({ ok: true, results: [] });
    const handler = getHandler();

    await handler(null, 'Aeolus View Camp', 'Shelter: Aeolus View Camp\nBuilt: 1932');

    expect(runWebResearch).toHaveBeenCalledWith(
      'sk-ant-test', 'claude-haiku-4-5-20251001', 'Aeolus View Camp',
      { context: 'Shelter: Aeolus View Camp\nBuilt: 1932' },
    );
  });

  it('passes through a runWebResearch error response unchanged', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runWebResearch as jest.Mock).mockResolvedValue({ ok: false, error: 'timeout' });
    const handler = getHandler();

    const result = await handler(null, 'query');

    expect(result).toEqual({ ok: false, error: 'timeout' });
  });

  it('fetches/caches a thumbnail for a result with an image_url and never forwards the raw URL', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runWebResearch as jest.Mock).mockResolvedValue({
      ok: true,
      results: [
        { title: 'Long Trail News', url: 'https://example.com/a', snippet: 'a', imageUrl: 'https://example.com/a.jpg' },
      ],
    });
    (fetchAndCacheImage as jest.Mock).mockResolvedValue('/tmp/userData/research-thumbnails/abc123.jpg');
    const handler = getHandler();

    const result = await handler(null, 'query');

    expect(fetchAndCacheImage).toHaveBeenCalledWith('https://example.com/a.jpg');
    expect(result).toEqual({
      ok: true,
      results: [
        { title: 'Long Trail News', url: 'https://example.com/a', snippet: 'a', localImagePath: '/tmp/userData/research-thumbnails/abc123.jpg' },
      ],
    });
    expect(JSON.stringify(result)).not.toContain('a.jpg');
  });

  it('yields localImagePath: null for one result whose image fetch fails, without failing the rest of the batch', async () => {
    (readStoredApiKey as jest.Mock).mockReturnValue('sk-ant-test');
    (runWebResearch as jest.Mock).mockResolvedValue({
      ok: true,
      results: [
        { title: 'Broken Photo', url: 'https://example.com/a', snippet: 'a', imageUrl: 'https://example.com/broken.jpg' },
        { title: 'No Photo', url: 'https://example.com/b', snippet: 'b' },
      ],
    });
    (fetchAndCacheImage as jest.Mock).mockResolvedValue(null);
    const handler = getHandler();

    const result = await handler(null, 'query');

    expect(result).toEqual({
      ok: true,
      results: [
        { title: 'Broken Photo', url: 'https://example.com/a', snippet: 'a', localImagePath: null },
        { title: 'No Photo', url: 'https://example.com/b', snippet: 'b', localImagePath: null },
      ],
    });
  });
});
