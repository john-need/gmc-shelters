# Implementation Plan: Research Tab Web Search Citations

**Branch**: `018-research-web-search` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/018-research-web-search/spec.md`

## Summary

Add a "Search web" checkbox and a manual "Search Web" button to the Research tab's search card. Clicking it sends the current query to Claude (via the app's own AI Settings key/model, spec 015) with the fixed research prompt, using Claude's server-side `web_search` tool for real, cited results — one call per click, never per keystroke. Results render in a separate "Web Sources" section; any located photo is fetched once, cached locally, and served through the existing `shelter://` protocol (never hotlinked). Each result gets an Add Citation action that reuses the exact `SourceModal`/`createSource` flow archive results already use, producing an ordinary `website`-type `Source` row on the Sources tab. All eight clarified behaviors — manual trigger, uncapped result count, button-disable while in flight, ~45s timeout, local image caching — are implemented as stated in spec.md's Clarifications.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/preload/renderer) for the entire feature — no Python involved this time (unlike specs 013/014/015), since the live call originates from the desktop app itself, not the offline conversion pipeline.
**Primary Dependencies**: None new. Reuses the runtime's built-in `fetch`/`AbortController` (no `@anthropic-ai/sdk`, matching `scripts/lib/llm_client.py`'s stdlib-only convention), the already-installed `sharp` (image resize, already used in `src/main/fs/photos.ts`), Node's built-in `crypto` (URL hashing), and the existing `shelter://` protocol handler (`src/main/index.ts`) for serving cached files.
**Storage**: No SQLite changes. One new disk cache directory, `app.getPath('userData')/research-thumbnails/`, holding fetched-and-resized photo thumbnails keyed by `sha256(image_url)`. No new `.env`/preference files — reuses the existing `.anthropic_api_key`/`.ai_model` files via two new exported helpers on `ai-settings.ts`.
**Testing**: Jest (`src/main/**/*.test.ts` node env, `src/shared/**/*.test.ts`, `src/renderer/**/*.test.tsx` jsdom). TDD — every listed test below is written and failing before its corresponding implementation:
  - `src/main/ai/models.test.ts` (NEW) — `resolvePrimaryModel('default')`/`('escalation')` map to the correct fixed IDs
  - `src/main/ai/web-research.test.ts` (NEW) — builds the correct request body (model, `web_search` tool, `max_uses: 3`, prompt containing the fixed template + JSON-array instruction); parses a well-formed trailing JSON array out of a mocked response's final text block; drops entries missing `title`/`url`; returns `{ ok: true, results: [] }` on an unparseable response (not an error); maps a non-2xx response to `{ ok: false, error: 'network' }`; maps an aborted/timed-out request to `{ ok: false, error: 'timeout' }` (injectable `fetch`/timeout so the test doesn't wait 45s)
  - `src/main/ai/web-research-images.test.ts` (NEW) — successful fetch writes a resized file under the cache dir and returns its path; a repeat call with the same URL returns the cached path without fetching again; a fetch failure (network error, non-2xx, bad image data) returns `null` without throwing
  - `src/main/ipc/ai-settings.test.ts` (extend) — new exported `readStoredApiKey()`/`readStoredModelTier()` behave identically to the existing `AI_GET_API_KEY`/`AI_GET_MODEL` handlers (which now delegate to them) — same fallback-to-empty/`'default'` behavior, existing tests continue to pass unchanged
  - `src/main/ipc/research-web-search.test.ts` (NEW) — no stored key → `{ ok: false, error: 'no_api_key' }` with zero network calls; stored key present → resolves model, calls `web-research.ts`, fetches/caches images for results that have one, strips `image_url` from the response entirely; a `web-research.ts` error passes through unchanged; per-result image fetch failure yields `localImagePath: null` for that result without failing the others
  - `src/shared/web-research-cite.test.ts` (NEW) — `webResultToSource()` maps `title`→`container_title`, `url`→`url`, today's date→`access_date`, `snippet`→`quote`, `type: 'website'` fixed, all other `Source` fields left at `BLANK_SOURCE` defaults
  - `src/main/preload.test.ts` (extend) — `research` appears in the exposed top-level namespace list; `research.webSearch` is exposed as a function calling `CHANNELS.RESEARCH_WEB_SEARCH`
  - `src/renderer/components/MainPane/tabs/ResearchTab.test.tsx` (extend) — checkbox renders unchecked by default and firing a query change alone never calls `window.api.research.webSearch`; clicking Search Web with the box checked calls it with the current query; button is disabled for the duration of an in-flight call and re-enables after resolve; a second click while disabled is inert; a successful response renders a labeled "Web Sources" section separate from archive results, with a thumbnail only on results that have `localImagePath`; a `no_api_key` response renders the AI-Settings-pointer message; an empty `results: []` response renders the distinct "no web results" state (not the archive "no results" copy); a `timeout`/`network` error renders an inline error state and re-enables the button; unchecking "Search web" clears the section immediately without touching archive results; clicking Add Citation on a web result opens the existing `SourceModal` pre-filled via `webResultToSource()` and saves through the existing `createSource` flow.
**Target Platform**: Electron desktop app (macOS primary). The Anthropic API is now also called live from the main process (previously only from the offline Python pipeline).
**Project Type**: Electron app only for this feature — no `scripts/`/Python changes, unlike specs 013/014/015, since the call site lives entirely in the desktop app.
**Performance Goals**: One Anthropic call per explicit "Search Web" click (never per keystroke), capped at 3 internal `web_search` uses and a ~45s client-side timeout; per-image thumbnail fetch capped at ~5s each so one slow/broken image can't stall the whole response.
**Constraints**: No hotlinking — the renderer only ever receives `localImagePath` (a local file path or `null`), never the original external image URL (FR-006). The Search Web button must be un-clickable while a request is in flight (FR-015). No new npm dependency.
**Scale/Scope**: Touches: `src/shared/ipc-types.ts`, `src/shared/web-research-cite.ts` (new), `src/main/ai/models.ts` (new), `src/main/ai/web-research.ts` (new), `src/main/ai/web-research-images.ts` (new), `src/main/ipc/ai-settings.ts` (extend — export two helpers), `src/main/ipc/research-web-search.ts` (new), `src/main/index.ts` (register the new handler), `src/main/preload.ts` (expose `research.webSearch`), `src/renderer/components/MainPane/tabs/ResearchTab.tsx` (checkbox, button, Web Sources section).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Source of truth identified** (Principle I): The staff member's query text and the already-configured `.anthropic_api_key`/`.ai_model` files (spec 015) are the canonical local inputs, named explicitly in spec.md and data-model.md. The Anthropic API is treated strictly as an external consumer/service the app calls out to, never as a source of repository-owned data — nothing it returns is treated as canon beyond the ephemeral result list and an operator-initiated citation.
- [x] **Test-first scope identified** (Principle II): Failing tests planned first for every new/changed unit, listed under Testing above, spanning `src/main/ai/`, `src/main/ipc/`, `src/shared/`, and `src/renderer/components/MainPane/tabs/` — matching this repo's existing per-module pairing convention.
- [x] **External contract coverage** (Principle III): The Anthropic API call is documented as an internal implementation detail behind one IPC contract (`contracts/research-web-search-ipc.md`) — the renderer never talks to Anthropic directly, so there is no new *out-of-repo consumer contract* to define beyond that internal one (there is no WordPress/theme/export surface here). Operator documentation: `quickstart.md` covers the manual-trigger flow, the cost model (one call per click), and the un-cleaned thumbnail cache.
- [x] **Idempotency and auditability** (Principle IV): N/A in the batch-import/sync sense — this is an interactive, one-shot-per-click research lookup, not a rerunning batch workflow. Repeating the same query is simply a new independent call (no duplicate-detection requirement); the one side effect that persists (a citation) is created only on an explicit Add Citation click, identical to today's archive-citation behavior.
- [x] **Minimal-change fit** (Principle V): All changes stay within `src/shared/`, `src/main/ai/` (new small directory, three focused files, no framework), `src/main/ipc/`, `src/main/preload.ts`, and `src/renderer/components/MainPane/tabs/` — no new top-level directory, no new dependency, reuses the existing `shelter://` protocol and the existing `sharp`/thumbnail-cache pattern rather than inventing a new one.
- [x] **WordPress/theme boundary respected** (Principle V/III): N/A — no theme or WordPress surface touched.

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/018-research-web-search/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── research-web-search-ipc.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/shared/
├── ipc-types.ts                          # extend: CHANNELS.RESEARCH_WEB_SEARCH; WebResearchResult,
│                                          #   WebResearchError, WebSearchResponse types;
│                                          #   ElectronAPI.research.webSearch()
├── web-research-cite.ts                  # NEW: webResultToSource(), mirrors wiki-cite.ts
└── web-research-cite.test.ts             # TDD: NEW — failing tests first

src/main/ai/
├── models.ts                             # NEW: DEFAULT_MODEL/ESCALATION_MODEL (mirrors
│                                          #   scripts/lib/llm_client.py); resolvePrimaryModel(tier)
├── models.test.ts                        # TDD: NEW
├── web-research.ts                       # NEW: builds the web_search request, calls fetch with an
│                                          #   AbortController timeout, parses the trailing JSON array
├── web-research.test.ts                  # TDD: NEW — failing tests first (see Testing above)
├── web-research-images.ts                # NEW: fetch + sharp resize + cache under
│                                          #   userData/research-thumbnails/<sha256(url)>.<ext>
└── web-research-images.test.ts           # TDD: NEW

src/main/ipc/
├── ai-settings.ts                        # extend: export readStoredApiKey()/readStoredModelTier();
│                                          #   existing handlers now delegate to them (behavior unchanged)
├── ai-settings.test.ts                   # TDD: extend — new coverage for the two exported helpers
├── research-web-search.ts                # NEW: registerResearchWebSearchHandlers(); orchestrates
│                                          #   key/model lookup → web-research.ts → per-result thumbnail
│                                          #   fetch → strips image_url before responding
└── research-web-search.test.ts           # TDD: NEW — failing tests first (see Testing above)

src/main/index.ts                         # add registerResearchWebSearchHandlers() alongside the other
                                            #   register*Handlers() calls; no new test needed (existing
                                            #   index.test.ts doesn't assert individual registrations)

src/main/preload.ts                       # add `research: { webSearch }` namespace
src/main/preload.test.ts                  # TDD: extend — namespace list + webSearch exposure

src/renderer/components/MainPane/tabs/
├── ResearchTab.tsx                       # add "Search web" checkbox + "Search Web" button, local
│                                          #   in-flight/error/results state, Web Sources section,
│                                          #   thumbnail via shelter://, Add Citation reusing
│                                          #   webResultToSource() + existing SourceModal/createSource
└── ResearchTab.test.tsx                  # TDD: extend — failing tests first (see Testing above)
```

**Structure Decision**: Pure Electron-app change — no `scripts/`/Python involvement (unlike specs 013–015, all of which touched the Python conversion pipeline). New code lives in a small new `src/main/ai/` directory (parallel to the existing `src/main/fs/` and `src/main/ipc/` directories) for the three focused, non-IPC modules (model resolution, the Anthropic call, image caching); IPC wiring itself stays in `src/main/ipc/`, consistent with every other feature in this repo. No `database/migrations/` — no SQLite involvement.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
