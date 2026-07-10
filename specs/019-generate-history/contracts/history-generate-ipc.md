# Contract: `HISTORY_GENERATE` (internal IPC)

Internal contract between `src/renderer/components/MainPane/tabs/HistoryTab.tsx` and a new `src/main/ipc/generate-history.ts`. No out-of-repo consumer — the only external system involved (the Anthropic API) is called from the main process and never reaches the renderer directly. New channel — no "before" shape exists.

## Shape

```ts
export interface GenerateHistoryShelterFacts {
  name: string;
  architecture: string;
  built_by: string;
  description: string;
  notes: string;
  start_year: number;
  end_year: number | null;
  is_extant: boolean;
  is_gmc: boolean;
  category: string;
}

export interface GenerateHistoryRequest {
  shelter: GenerateHistoryShelterFacts;
  citations: Source[];        // pre-filtered to include_in_history === true
  currentHistory: string;     // pre-stripped of the mechanical ### Sources section
}

export type GenerateHistoryError = 'no_api_key' | 'network' | 'timeout';

export type GenerateHistoryResponse =
  | { ok: true; narrative: string }
  | { ok: false; error: GenerateHistoryError };

history: {
  generate: (request: GenerateHistoryRequest) => Promise<GenerateHistoryResponse>;
}
```

`CHANNELS.HISTORY_GENERATE = 'history:generate'`

## Behavior

1. **No API key configured**: if `readStoredApiKey()` (the same helper `ai-settings.ts`'s `AI_GET_API_KEY` handler and `research-web-search.ts` both already use) returns an empty string, the handler resolves `{ ok: false, error: 'no_api_key' }` immediately — no network call, no cost (spec FR-009/edge case: no key configured).
2. **Model resolution**: `readStoredModelTier()` / `resolvePrimaryModel(tier)` — identical to `research-web-search.ts`, no new model-selection logic.
3. **Generation call**: `src/main/ai/generate-history.ts` posts one non-streaming request to `POST https://api.anthropic.com/v1/messages` with `tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]` (research.md Decision 2) and a prompt built from `request.shelter`, `citeChicagoMarkdown()`-formatted `request.citations`, and `request.currentHistory` (research.md Decision 5). Times out at ~45s via `AbortController` → `{ ok: false, error: 'timeout' }`. A non-2xx response or thrown fetch error → `{ ok: false, error: 'network' }`.
4. **Extraction**: the handler joins the response's `text`-type content blocks and trims the result — no JSON parsing (research.md Decision 3). An empty/whitespace-only result is still `{ ok: true, narrative: '' }`, not an error; the renderer's review modal simply shows an (almost) empty preview, which the user can still reject.
5. **Response**: always one of the two `GenerateHistoryResponse` shapes above — the handler never throws to the renderer; every failure path is a typed `{ ok: false, error }`.

## Renderer responsibilities (not part of the contract, noted for context)

- Builds `citations` by filtering `sources.byShelter[shelterId]` to `include_in_history === true` and `currentHistory` by calling `stripSourcesSection(historyContent)` (`src/shared/generate-history.ts`) — both filtering steps happen before the call, not in the handler.
- Disables "Generate History" for the duration of the call and shows a busy state (FR-008); leaves `historyContent`/`historyDirty` untouched until Accept (FR-003).
- On `ok: true`, opens `GenerateHistoryModal` with `assembleAcceptedHistory(shelter.name, narrative, citations)` (`src/shared/generate-history.ts`) as the preview — the same function used to build the content Accept applies, so preview and applied result can never diverge.
- On `ok: false`, shows an inline error scoped to the History tab toolbar; never opens the modal.

## Backward compatibility

None required — a brand-new channel with a single caller (`HistoryTab.tsx`), introduced in this change set.
