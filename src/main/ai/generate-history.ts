import { log } from '../logger';
import { citeChicagoMarkdown } from '../../shared/cite-chicago';
import type { GenerateHistoryRequest, GenerateHistoryShelterFacts } from '../../shared/ipc-types';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 45_000;

export type GenerateHistoryCallError = 'network' | 'timeout';

export type GenerateHistoryOutcome =
  | { ok: true; narrative: string }
  | { ok: false; error: GenerateHistoryCallError };

function formatShelterFacts(shelter: GenerateHistoryShelterFacts): string {
  const years = shelter.start_year || shelter.end_year
    ? `${shelter.start_year || '?'}${shelter.end_year ? `-${shelter.end_year}` : '-present'}`
    : '';

  return [
    `Name: ${shelter.name}`,
    shelter.architecture && `Architecture: ${shelter.architecture}`,
    shelter.built_by && `Built by: ${shelter.built_by}`,
    years && `Years: ${years}`,
    shelter.category && `Category: ${shelter.category}`,
    `GMC-built: ${shelter.is_gmc ? 'yes' : 'no'}`,
    `Still standing: ${shelter.is_extant ? 'yes' : 'no'}`,
    shelter.description && `Description: ${shelter.description}`,
    shelter.notes && `Notes: ${shelter.notes}`,
  ].filter(Boolean).join('\n');
}

function buildPrompt(request: GenerateHistoryRequest): string {
  const citationsText = request.citations.length
    ? request.citations.map((c) => `- ${citeChicagoMarkdown(c)}`).join('\n')
    : '(none)';

  return (
    `Write a factual narrative history of "${request.shelter.name}" using the established facts and citations below. ` +
    `Add your own relevant research to enrich the account, grounded in real history.\n\n` +
    `Facts:\n${formatShelterFacts(request.shelter)}\n\n` +
    `Citations:\n${citationsText}\n\n` +
    `Current draft history (may be empty):\n${request.currentHistory || '(none)'}\n\n` +
    `Respond with ONLY the narrative body as markdown prose. Do not include a top-level title heading. ` +
    `Do not include a Sources or bibliography section. Write one blended account with no explicit distinction ` +
    `between the given facts and your own added research.`
  );
}

export async function runGenerateHistory(
  apiKey: string,
  model: string,
  request: GenerateHistoryRequest,
  opts?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<GenerateHistoryOutcome> {
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
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }],
        messages: [{ role: 'user', content: buildPrompt(request) }],
      }),
      signal: controller.signal,
    } as RequestInit);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '<unreadable>');
      log.error(`[generate-history] Anthropic API returned ${response.status}: ${errorBody}`);
      return { ok: false, error: 'network' };
    }

    const body = await response.json();
    const narrative = (body.content ?? [])
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { text: string }) => block.text)
      .join('\n')
      .trim();

    return { ok: true, narrative };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, error: 'timeout' };
    }
    log.error('[generate-history] fetch threw', err);
    return { ok: false, error: 'network' };
  } finally {
    clearTimeout(timer);
  }
}
