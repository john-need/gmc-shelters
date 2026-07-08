# Contract: `RESEARCH_WEB_SEARCH` (internal IPC)

Internal contract between `src/renderer/components/MainPane/tabs/ResearchTab.tsx` and a new `src/main/ipc/research-web-search.ts`. No out-of-repo consumer — the only external system involved (the Anthropic API) is called from the main process and never reaches the renderer directly. New channel — no "before" shape exists.

## Shape

```ts
export interface WebResearchResult {
  title: string;
  url: string;
  snippet: string;
  localImagePath: string | null;
}

export type WebResearchError = 'no_api_key' | 'timeout' | 'network';

export type WebSearchResponse =
  | { ok: true; results: WebResearchResult[] }
  | { ok: false; error: WebResearchError };

research: {
  webSearch: (query: string) => Promise<WebSearchResponse>;
}
```

`CHANNELS.RESEARCH_WEB_SEARCH = 'research:webSearch'`

## Behavior

1. **No API key configured**: if `readStoredApiKey()` (the same helper `ai-settings.ts`'s `AI_GET_API_KEY` handler uses) returns an empty string, the handler resolves `{ ok: false, error: 'no_api_key' }` immediately — no network call is made, no cost incurred (spec edge case: "checking Search web but never getting a key set up").
2. **Model resolution**: `readStoredModelTier()` resolves the persisted `AiModelTier` (`'default' | 'escalation'`, spec 015); `resolvePrimaryModel(tier)` (new `src/main/ai/models.ts`) maps it to a Claude model ID.
3. **Research call**: `web-research.ts` posts one non-streaming request to `POST https://api.anthropic.com/v1/messages` with `tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]` and the fixed prompt (see `research.md`). Times out at ~45s via `AbortController` → `{ ok: false, error: 'timeout' }`. A non-2xx response or thrown fetch error → `{ ok: false, error: 'network' }`.
4. **Parsing**: the handler extracts a trailing JSON array from Claude's final text content and validates each entry has non-empty `title`/`url` strings; invalid/incomplete entries are dropped, not rejected as a whole. A parse failure (no valid array found) yields `{ ok: true, results: [] }`, not an error — indistinguishable from "no primary sources found" (see research.md's parse-failure decision).
5. **Thumbnails**: for each surviving result with an `image_url` in Claude's answer, the handler fetches the image (own ~5s timeout, independent per result), resizes it with `sharp`, and writes it to `app.getPath('userData')/research-thumbnails/<sha256(image_url)>.<ext>`. Success → that result's `localImagePath` is the absolute cache path. Any failure (fetch, decode, write) → `localImagePath: null` for that result only; the rest of the batch is unaffected. The raw `image_url` is never included in the response sent to the renderer.
6. **Response**: always one of the two `WebSearchResponse` shapes above — the handler never throws to the renderer; every failure path is a typed `{ ok: false, error }`.

## Renderer responsibilities (not part of the contract, noted for context)

- Disables the "Search Web" action for the duration of the call (FR-015) and shows a loading indicator scoped to the Web Sources section (FR-014).
- Renders `localImagePath` (when non-null) via the existing `shelter://` protocol: `shelter://${encodeURI(localImagePath)}` — the same convention `src/renderer/utils/paths.ts`'s `buildPhotoUrl` already uses for shelter photos. Never constructs an `<img>` src from any other field.
- Maps each result through `webResultToSource()` (`src/shared/web-research-cite.ts`) when staff click Add Citation, reusing the existing `SourceModal`/`createSource` flow unchanged.

## Backward compatibility

None required — a brand-new channel with a single caller (`ResearchTab.tsx`), introduced in this change set.
