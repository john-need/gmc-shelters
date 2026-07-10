# Data Model: Generate History

## Entities

### Generate History Request (new, ephemeral, no DB record)

Assembled once per "Generate History" click, from data already resident in the renderer's Redux state (`shelters.editBuffer`, `sources.byShelter[shelterId]`, `shelters.historyContent`). Travels over IPC exactly once (renderer → main).

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
  citations: Source[];        // already filtered to include_in_history === true by the renderer
  currentHistory: string;     // History tab content with its ### Sources section already stripped
}
```

| Field | Notes |
|---|---|
| `shelter` | A narrow subset of the `Shelter` entity (`src/shared/ipc-types.ts`) — only the fields that describe the shelter itself, excluding bookkeeping fields (`id`, `slug`, `created`, `updated`, `default_photo_id`, `history`, `show_on_web`) that carry no narrative content. |
| `citations` | The full existing `Source` shape (reused as-is, no new type) — passed through so the main process can format them with the existing `citeChicagoMarkdown()`, matching exactly what would appear in the mechanical Sources section. |
| `currentHistory` | Produced by `stripSourcesSection()` (`src/shared/generate-history.ts`) before the IPC call — the request never carries the mechanical Sources section, so Claude never sees or is tempted to reproduce it (research.md Decision 5/6). |

### Generate History Response (new, ephemeral, no DB record)

```ts
export type GenerateHistoryError = 'no_api_key' | 'network' | 'timeout';

export type GenerateHistoryResponse =
  | { ok: true; narrative: string }
  | { ok: false; error: GenerateHistoryError };
```

| Field | Notes |
|---|---|
| `narrative` | Markdown prose only — no top-level heading, no Sources section (research.md Decision 5). The app supplies both around it (see Assembled Document below). |
| `error` | `'no_api_key'` — resolved entirely in the IPC handler before any network call (mirrors `research-web-search.ts`); `'network'`/`'timeout'` — surfaced unchanged from `src/main/ai/generate-history.ts`, same union as `web-research.ts`'s `WebResearchCallError`. |

### Generated History Narrative (draft) — spec's Key Entity, realized as component state

Held only in `HistoryTab`'s local state (`draftNarrative: string | null`) from the moment a successful response arrives until Accept or Reject/dismiss. Never persisted, never logged, never round-tripped back through IPC.

### Assembled Document (derived, not a stored entity)

The full text that would replace the History tab's content, computed by `assembleAcceptedHistory(shelterName, narrative, citations)` (`src/shared/generate-history.ts`) and used for **both** the review modal's preview (FR-004) and the actual replacement on Accept (FR-006) — one function, one document, so the preview can never diverge from what Accept applies:

```text
# {Shelter Name}

{narrative body, trimmed}

### Sources

- {citeChicagoMarkdown(citation) for each included citation, same order/format as today's mechanical section}
```

When `citations` is empty, `assembleAcceptedHistory` omits the `### Sources` section entirely (same behavior `syncHistorySourcesSection` already has for zero included sources).

### Shelter / Source (existing entities, unchanged shape)

No changes to `Shelter`, `Source`, or their SQLite-backed tables. This feature only reads them (via the request) and, on Accept, writes an ordinary string into the History tab's already-existing `historyContent` Redux state — the same field every manual edit already updates.

## Validation Rules

- `GenerateHistoryRequest.citations` MUST already be filtered to `include_in_history === true` before the IPC call — the main process does not re-filter (spec Assumptions: "the citations on the sources tab" means the included set).
- `GenerateHistoryRequest.currentHistory` MUST already have its `### Sources` section stripped before the IPC call (research.md Decision 6) — the main process does not strip it.
- A `GenerateHistoryResponse` with `ok: false` MUST NOT be accompanied by any change to `HistoryTab`'s `historyContent`/`historyDirty` state (FR-010).
- Accept MUST always use `assembleAcceptedHistory()` — never the bare `narrative` string — so the applied content matches what the modal previewed (FR-004/FR-006 consistency).

## State / Lifecycle

1. Staff click "Generate History" (enabled only when a valid-format API key is configured, per `hasValidApiKey` — research.md Decision 7). The button disables and shows a busy state (FR-008); `HistoryTab`'s content is untouched (FR-003).
2. Renderer builds a `GenerateHistoryRequest` from `editBuffer`, the current shelter's `sources.byShelter[shelterId]` filtered to `include_in_history`, and `stripSourcesSection(historyContent)`, then calls `window.api.history.generate(request)`.
3. Main process: no stored key → `{ ok: false, error: 'no_api_key' }`, zero network calls. Otherwise resolves the model tier, calls `src/main/ai/generate-history.ts`, which builds the prompt (research.md Decision 5) and calls Anthropic with the `web_search` tool enabled (Decision 2), ~45s timeout (Decision 4).
4. On `ok: false` — button re-enables, an inline error is shown (FR-010), no modal opens.
5. On `ok: true` — `draftNarrative` is set to the returned `narrative`; `GenerateHistoryModal` opens showing `assembleAcceptedHistory(shelter.name, narrative, citations)` rendered via the shared `renderMarkdown()` (research.md Decision 8).
6. Accept → `setHistoryContent(assembleAcceptedHistory(...))` dispatched (marks `historyDirty`, exactly like a manual edit); modal closes; `draftNarrative` cleared. The existing Save button still governs writing to disk (FR-006, SC-003).
7. Reject/dismiss → modal closes, `draftNarrative` cleared, no dispatch at all — `historyContent`/`historyDirty` are byte-for-byte unchanged (FR-007, SC-002).

No multi-step or background job: each click is a single request/response pair that resolves to `no_api_key`, `network`, `timeout`, or a narrative shown for review.
