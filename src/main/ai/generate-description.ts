import { log } from '../logger';
import type { GenerateDescriptionRequest } from '../../shared/ipc-types';
import { formatShelterFacts } from './generate-history';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
// ponytail: a short description needs far fewer tokens than a full narrative.
const MAX_TOKENS = 300;
const DEFAULT_TIMEOUT_MS = 30_000;

export type GenerateDescriptionCallError = 'network' | 'timeout';

export type GenerateDescriptionOutcome =
  | { ok: true; description: string }
  | { ok: false; error: GenerateDescriptionCallError };

function buildPrompt(request: GenerateDescriptionRequest): string {
  return (
    `Write a concise, factual description (350 characters or less) of "${request.shelter.name}" for a shelter database entry. ` +
    `Cover its physical appearance and its history, based on the facts and history text below. ` +
    `Respond with ONLY the description text — no title, no markdown formatting, no surrounding quotation marks.\n\n` +
    `Facts:\n${formatShelterFacts(request.shelter)}\n\n` +
    `History:\n${request.historyContent || '(none)'}`
  );
}

// A single non-streaming request, deliberately without tools — everything needed
// (shelter facts, history text) is already in hand, so there's nothing to search for.
export async function runGenerateDescription(
  apiKey: string,
  model: string,
  request: GenerateDescriptionRequest,
  opts?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<GenerateDescriptionOutcome> {
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
        messages: [{ role: 'user', content: buildPrompt(request) }],
      }),
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<unreadable>');
      log.error(`[generate-description] Anthropic API returned ${response.status}: ${errorBody}`);
      return { ok: false, error: 'network' };
    }

    const body = await response.json();
    const content = (body.content ?? []) as { type: string; text?: string }[];
    const description = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { ok: true, description };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    log.error('[generate-description] fetch threw', err);
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
