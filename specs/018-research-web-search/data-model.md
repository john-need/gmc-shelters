# Data Model: Research Tab Web Search Citations

## Entities

### Web Research Result (new, ephemeral)

One Claude-sourced finding for one search query. Never written to SQLite; exists only in `ResearchTab`'s component state for the current query, and travels over IPC exactly once (main → renderer).

| Field | Type | Notes |
|---|---|---|
| `title` | `string` | As returned by Claude; falsy titles are dropped before reaching the renderer (edge case: "no usable link or title") |
| `url` | `string` | Link to the primary source; falsy urls are dropped the same way |
| `snippet` | `string` | Short summary; becomes the citation's `quote` verbatim |
| `localImagePath` | `string \| null` | Absolute path to a locally cached thumbnail, or `null` if no photo was found or the fetch/cache step failed. **Never the original external URL** — the renderer has no field to hotlink even by mistake. |

Contrast with the existing `WikiSearchResult` (archive search, `src/shared/ipc-types.ts`): that type carries rich bibliographic fields (`publisher`, `volume`, `edition`, `page`, …) sourced from structured OKF frontmatter. A Web Research Result has none of that structure — Claude's research prose doesn't carry a page number or an edition — so it stays a small, separate shape rather than shoehorning into `WikiSearchResult`.

### Cached Thumbnail Image (new, disk-only, no DB record)

A local file at `app.getPath('userData')/research-thumbnails/<sha256(image_url)>.<ext>`, resized to 120px wide (matching this app's existing `grid` thumbnail size class), written once per distinct source URL and reused on a repeat fetch of the same URL (across queries, across app restarts). Comparable in shape to the existing photo-thumbnail cache (`src/main/fs/thumbnails.ts`) but keyed by a content hash of the remote URL instead of a local file's mtime, since a remote resource has no local mtime to key on.

- No expiry/eviction logic is introduced (per spec Assumptions — treated as disposable local cache, same posture as the existing photo-thumbnail cache).
- A cache miss or fetch/resize failure yields `localImagePath: null` for that result; it is not retried within the same request.

### Source / Citation (existing entity, unchanged shape)

`sources` / `shelter_sources` (see `src/shared/ipc-types.ts`'s `Source`/`SourceInput`) gain entries created by mapping a Web Research Result through a new `webResultToSource()` function (`src/shared/web-research-cite.ts`), mirroring the existing `wikiResultToSource()` (`src/shared/wiki-cite.ts`) used for archive citations:

| `Source` field | Value from Web Research Result |
|---|---|
| `type` | `'website'` (fixed — this is always a web citation) |
| `container_title` | `title` |
| `url` | `url` |
| `access_date` | today's date (ISO `YYYY-MM-DD`), the date the citation was captured |
| `quote` | `snippet` |
| everything else | `BLANK_SOURCE` defaults, same as the archive-citation flow, editable in the same `SourceModal` before save |

No new database columns, tables, or migrations. `include_in_history`, `shelter_id`, and all other `Source` fields behave identically to citations created from archive results — same `createSource` Redux thunk, same `SourceModal`, same Sources tab list.

## IPC Contract Shape (see `contracts/research-web-search-ipc.md` for full behavior)

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
```

## Validation Rules

- A Web Research Result missing a non-empty `title` or `url` is dropped before the IPC response is returned (edge case: "no usable link or title").
- `localImagePath` is populated only after a successful fetch + resize + write; any failure at any of those steps yields `null` for that one result without failing the rest of the batch.
- The IPC handler never forwards a raw external image URL to the renderer — `localImagePath` is the only image field in the contract.

## State / Lifecycle

1. Staff check "Search web" (component state flips to enabled; no IPC call yet — FR-003).
2. Staff click "Search Web" with the current archive-search query text → `window.api.research.webSearch(query)` fires; the button disables and the Web Sources section shows a loading indicator (FR-014/FR-015).
3. Main process: no stored API key → resolves `{ ok: false, error: 'no_api_key' }` immediately, no network call. Otherwise resolves the model tier, calls `web-research.ts`, then fetches/caches any photo per result.
4. Renderer receives the response → button re-enables (FR-015); results (or the appropriate empty/error state) render in the Web Sources section (FR-004/FR-009/FR-010).
5. Staff click Add Citation on a result → `webResultToSource()` maps it into the same `SourceModal`/`createSource` flow archive citations already use (User Story 2) → a new `sources`/`shelter_sources` row exists for the current shelter, visible on the Sources tab.
6. Staff uncheck "Search web" → Web Sources section and its result state clear immediately (FR-011); no cached thumbnail files are deleted (disk cache persists across sessions/queries).

No multi-step or background job: each Search Web click is a single request/response pair that either succeeds (possibly empty), fails as `no_api_key`, fails as `network`, or fails as `timeout` after ~45s.
