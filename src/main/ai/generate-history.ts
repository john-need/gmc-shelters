import { log } from '../logger';
import { citeChicagoMarkdown } from '../../shared/cite-chicago';
import type { GenerateHistoryEvent, GenerateHistoryRequest, GenerateHistoryShelterFacts, Source } from '../../shared/ipc-types';
import { searchWiki, getWikiPageBody } from '../ipc/wiki-search';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;
const DEFAULT_TIMEOUT_MS = 45_000;
// ponytail: flat turn cap, not a token/cost budget -- good enough to stop a runaway tool-call loop.
const MAX_TURNS = 6;

export type GenerateHistoryCallError = 'network' | 'timeout' | 'max_turns';

export type GenerateHistoryOutcome =
  | { ok: true; narrative: string }
  | { ok: false; error: GenerateHistoryCallError };

type ClientToolName = 'search_collections' | 'download_document';

interface AnthropicContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  text?: string;
  content?: unknown[];
  [key: string]: unknown;
}

export function formatShelterFacts(shelter: GenerateHistoryShelterFacts): string {
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

function countWebsiteCitations(citations: Source[]): number {
  return citations.filter((c) => c.type === 'website' && c.url).length;
}

function citationLine(c: Source, wikiExcerpts: Record<number, string>): string {
  const line = `- ${citeChicagoMarkdown(c)}`;
  const excerpt = wikiExcerpts[c.id];
  return excerpt ? `${line}\n  Excerpt: "${excerpt.trim()}"` : line;
}

function buildPrompt(request: GenerateHistoryRequest, wikiExcerpts: Record<number, string>): string {
  const citationsText = request.citations.length
    ? request.citations.map((c) => citationLine(c, wikiExcerpts)).join('\n')
    : '(none)';
  const instructions = [
    countWebsiteCitations(request.citations) > 0
      && 'Use the web_fetch tool to open and read each Website citation\'s URL before writing, rather than relying on search snippets alone.',
    Object.keys(wikiExcerpts).length > 0
      && 'Some citations include a full page excerpt from the digitized archive -- treat that excerpt as primary source text.',
    'You may also use search_collections to look for additional grounding in the wiki collections (newsletters, guidebooks, reports) '
      + 'beyond the given citations, and download_document to read a matching page\'s digitized text before relying on it.',
  ].filter(Boolean).join(' ');

  return (
    `Write a concise, factual narrative history of "${request.shelter.name}" using the established facts and citations below. ` +
    `You may add your own relevant research to fill gaps, grounded in real history, but stick to facts directly about this shelter ` +
    `-- do not digress into general regional, trail, or club history unless it directly explains something about this shelter.` +
    `${instructions ? ` ${instructions}` : ''}\n\n` +
    `Facts:\n${formatShelterFacts(request.shelter)}\n\n` +
    `Citations:\n${citationsText}\n\n` +
    `Current draft history (may be empty):\n${request.currentHistory || '(none)'}\n\n` +
    `Respond with ONLY the narrative body as markdown prose. Do not include a top-level title heading. ` +
    `Do not include a Sources or bibliography section. Write one blended account with no explicit distinction ` +
    `between the given facts and your own added research. Keep it tight -- every sentence should be about this shelter, ` +
    `not scene-setting or tangents.`
  );
}

function buildTools(citations: Source[]) {
  const tools: Record<string, unknown>[] = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] },
  ];

  const websiteCount = countWebsiteCitations(citations);
  if (websiteCount > 0) {
    tools.push({
      type: 'web_fetch_20250910',
      name: 'web_fetch',
      max_uses: websiteCount,
      citations: { enabled: true },
      allowed_callers: ['direct'],
    });
  }

  tools.push({
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
  });
  tools.push({
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
  });

  return tools;
}

function runClientTool(tool: ClientToolName, input: Record<string, unknown>): { ok: boolean; summary: string; content: unknown[] } {
  if (tool === 'search_collections') {
    const results = searchWiki(String(input.query ?? ''), input.collections as string[] | undefined);
    return { ok: true, summary: `${results.length} result(s)`, content: [{ type: 'text', text: JSON.stringify(results) }] };
  }

  // Text, not the raw PDF: some collection scans (bound guidebook editions,
  // yearly newsletter volumes) run past Anthropic's 100-page document limit,
  // which hard-failed the whole generation the first time this shipped.
  const body = getWikiPageBody(String(input.resource ?? ''), Number(input.page ?? 0));
  if (!body) {
    return { ok: false, summary: 'No digitized text for that resource/page', content: [{ type: 'text', text: 'No digitized text found for that resource/page.' }] };
  }
  return { ok: true, summary: `${body.length} chars`, content: [{ type: 'text', text: body }] };
}

export async function runGenerateHistory(
  apiKey: string,
  model: string,
  request: GenerateHistoryRequest,
  opts?: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    wikiExcerpts?: Record<number, string>;
    onEvent?: (event: GenerateHistoryEvent) => void;
    requestPermission?: (tool: ClientToolName, input: unknown, requestId: string) => Promise<boolean>;
  },
): Promise<GenerateHistoryOutcome> {
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const wikiExcerpts = opts?.wikiExcerpts ?? {};
  const onEvent = opts?.onEvent ?? (() => {});
  const requestPermission = opts?.requestPermission ?? (async () => false);

  const tools = buildTools(request.citations);
  const messages: { role: string; content: unknown }[] = [
    { role: 'user', content: buildPrompt(request, wikiExcerpts) },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let content: AnthropicContentBlock[];

    try {
      const response = await fetchImpl(API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': API_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, tools, messages }),
        signal: controller.signal,
      } as RequestInit);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '<unreadable>');
        log.error(`[generate-history] Anthropic API returned ${response.status}: ${errorBody}`);
        return { ok: false, error: 'network' };
      }

      const body = await response.json();
      content = body.content ?? [];
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, error: 'timeout' };
      }
      log.error('[generate-history] fetch threw', err);
      return { ok: false, error: 'network' };
    } finally {
      clearTimeout(timer);
    }

    const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    if (text) onEvent({ type: 'text', text });

    for (const block of content) {
      if (block.type === 'server_tool_use') {
        onEvent({ type: 'tool_call', tool: block.name as 'web_search' | 'web_fetch', input: block.input });
      } else if (block.type === 'web_search_tool_result' || block.type === 'web_fetch_tool_result') {
        const tool = block.type === 'web_search_tool_result' ? 'web_search' : 'web_fetch';
        onEvent({ type: 'tool_result', tool, ok: true, summary: `${(block.content ?? []).length} result(s)` });
      }
    }

    const clientToolUses = content.filter((b) => b.type === 'tool_use');
    if (clientToolUses.length === 0) {
      return { ok: true, narrative: text };
    }

    messages.push({ role: 'assistant', content });

    const toolResults = [];
    for (const use of clientToolUses) {
      const tool = use.name as ClientToolName;
      const requestId = use.id as string;
      onEvent({ type: 'permission_request', requestId, tool, input: use.input });
      const approved = await requestPermission(tool, use.input, requestId);

      if (!approved) {
        onEvent({ type: 'tool_result', tool, ok: false, summary: 'Denied by user' });
        toolResults.push({
          type: 'tool_result', tool_use_id: requestId, is_error: true,
          content: [{ type: 'text', text: 'User denied permission for this tool call.' }],
        });
        continue;
      }

      const outcome = runClientTool(tool, use.input ?? {});
      onEvent({ type: 'tool_result', tool, ok: outcome.ok, summary: outcome.summary });
      toolResults.push({
        type: 'tool_result', tool_use_id: requestId, is_error: !outcome.ok, content: outcome.content,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { ok: false, error: 'max_turns' };
}
