import { log } from '../logger';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 2048;
const DEFAULT_TIMEOUT_MS = 45_000;

export interface WebResearchCallResult {
  title: string;
  url: string;
  snippet: string;
  imageUrl?: string;
}

export type WebResearchCallError = 'network' | 'timeout';

export type WebResearchOutcome =
  | { ok: true; results: WebResearchCallResult[] }
  | { ok: false; error: WebResearchCallError };

function buildPrompt(query: string, context?: string): string {
  const contextBlock = context ? `\n\n${context}\n` : '';
  return (
    `research information about ${query}. return a list of primary sources. look for photos if appropriate.` +
    contextBlock +
    '\n\nAfter you finish researching, respond with ONLY a JSON array (no prose, no markdown fences) of objects shaped ' +
    '{"title": string, "url": string, "snippet": string, "image_url"?: string}. Omit image_url if you found no photo for that source.'
  );
}

function extractResults(finalText: string): WebResearchCallResult[] {
  const start = finalText.indexOf('[');
  const end = finalText.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(finalText.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const results: WebResearchCallResult[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const { title, url, snippet, image_url: imageUrl } = entry as Record<string, unknown>;
    if (typeof title !== 'string' || !title || typeof url !== 'string' || !url) continue;
    results.push({
      title,
      url,
      snippet: typeof snippet === 'string' ? snippet : '',
      imageUrl: typeof imageUrl === 'string' && imageUrl ? imageUrl : undefined,
    });
  }
  return results;
}

export async function runWebResearch(
  apiKey: string,
  model: string,
  query: string,
  opts?: { fetchImpl?: typeof fetch; timeoutMs?: number; context?: string },
): Promise<WebResearchOutcome> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        // allowed_callers: ['direct'] is required — some models (e.g. Haiku 4.5)
        // don't support "programmatic" tool calling, which is otherwise the default.
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }],
        messages: [{ role: 'user', content: buildPrompt(query, opts?.context) }],
      }),
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<unreadable>');
      log.error(`[web-research] Anthropic API returned ${response.status}: ${errorBody}`);
      return { ok: false, error: 'network' };
    }

    const body = await response.json();
    const finalText = (body.content ?? [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n');

    return { ok: true, results: extractResults(finalText) };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    log.error('[web-research] fetch threw', err);
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
