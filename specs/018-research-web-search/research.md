# Research: Research Tab Web Search Citations

No `NEEDS CLARIFICATION` markers remain in the Technical Context — all eight open questions were resolved across two `/speckit-clarify` sessions (see spec.md's Clarifications section). This document records the implementation-approach decisions made while grounding the plan in the existing codebase.

## Decision: Call Anthropic's server-side `web_search` tool directly with a single non-streaming request — no manual tool-execution loop

**Decision**: The new main-process module sends one `POST /v1/messages` request with `tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]` and `stream: false`. `allowed_callers: ['direct']` is required for the default (Haiku) model tier — without it, Anthropic rejects the request with `invalid_request_error: '...does not support programmatic tool calling'` (discovered via a live 400 during manual testing). `web_search` is a server tool — Anthropic executes the searches server-side and returns the final answer (interleaved with `server_tool_use`/`web_search_tool_result` content blocks) in that same response. No client-side tool-result round trip is needed, unlike client-executed tools.

**Rationale**: This matches the spec's "one deliberate click, one call" cost model (FR-002/FR-015) — a manual multi-turn tool loop would risk firing several billed requests per click. `max_uses: 3` caps how many searches Claude can run per click, bounding both cost and latency inside the FR-016 timeout window.

**Alternatives considered**: A client-executed search tool (e.g. calling a separate search API ourselves and feeding results back to Claude in a second turn) — rejected; it's more code, a second external dependency (a search API/key), and multiple round trips, all working against the cost/latency goals the clarifications already set.

## Decision: No Anthropic SDK — call the Messages API with the runtime's built-in `fetch`, mirroring `scripts/lib/llm_client.py`'s stdlib-only approach

**Decision**: A new `src/main/ai/web-research.ts` posts to `https://api.anthropic.com/v1/messages` with `fetch` (available globally in Electron 32's bundled Node 20, no import needed) and an `AbortController`-driven timeout. No `@anthropic-ai/sdk` dependency is added.

**Rationale**: `scripts/lib/llm_client.py`'s docstring is explicit that the pipeline avoids the SDK ("stdlib only, no SDK dependency"); this TS module is the desktop app's first live Anthropic call, so it should follow the same house convention rather than introduce a new dependency for one call site (Constitution Principle V / ponytail: native `fetch` already covers this).

**Alternatives considered**: Add `@anthropic-ai/sdk` — rejected; one call site does not justify a new dependency when `fetch` + a small typed request/response shape does the same job.

## Decision: Ask for a trailing JSON array in the same prompt; parse it, don't hand-parse prose

**Decision**: The user message sent to Claude is the spec's exact fixed prompt, followed by one appended instruction: respond with *only* a JSON array of `{"title": string, "url": string, "snippet": string, "image_url"?: string}` after finishing research — no prose, no markdown fences. The app extracts the first `[...]` substring from the final `text` block(s) and `JSON.parse`s it.

**Rationale**: The spec's "no additional steering" assumption is about not narrowing *what Claude searches for* (e.g. domain allow-lists, source-type filters) — it does not forbid telling Claude how to format its answer, which is a structural necessity for the app to render results at all. A trailing JSON array is the smallest instruction that makes the response machine-parseable; not a scope constraint.

**Alternatives considered**: Parse Claude's free-text answer with regex/heuristics — rejected as fragile (result count, punctuation, and phrasing would drift across model versions and prompts). Use Claude's native tool-call/structured-output mechanism for the *final* answer (a client tool Claude must call to "return" results) — rejected as unnecessary ceremony for one array of three string fields; adds a second tool definition and a stricter, harder-to-debug failure mode for no material benefit over asking for JSON directly.

## Decision: A parse failure degrades to zero results, not an error state

**Decision**: If the trailing JSON can't be found or doesn't parse, the handler returns `{ ok: true, results: [] }` (the same shape as "Claude found nothing"), not `{ ok: false, error: ... }`. A warning is logged for diagnosis; nothing user-facing distinguishes "no sources found" from "the model didn't follow the format this time."

**Rationale**: The spec's edge cases define exactly two failure axes that matter to a user: "zero primary sources" (FR-010) and "the call failed" (network/timeout/no-key, FR-009/FR-016). An occasional formatting slip is neither — surfacing it as an error would train staff to distrust a transient hiccup that a retry (re-clicking Search Web) usually resolves silently.

**Alternatives considered**: Surface a distinct "couldn't understand the response" error — rejected; adds a fourth error state the spec never asked for, for a condition indistinguishable in practice from "no results" to the person using the tool.

## Decision: Reuse the two Claude models already wired in AI Settings (spec 015), resolved via a small TypeScript mirror of `llm_client.py`'s constants

**Decision**: A new `src/main/ai/models.ts` defines `DEFAULT_MODEL`/`ESCALATION_MODEL` (same literal IDs as `scripts/lib/llm_client.py`) and `resolvePrimaryModel(tier: AiModelTier): string`. The IPC handler reads the persisted tier the same way `ai-settings.ts` already does and resolves it to a model ID before calling `web-research.ts`.

**Rationale**: Spec 015 already established that exactly two models are "wired into the app's AI-powered processing" and operator-selectable; this feature is a third caller of that same preference, not a new configuration surface. Duplicating the two constants in TS (with a same-file-comment convention already used for `AI_MODEL_OPTIONS`) is the established, accepted pattern in this repo for small stable vocab shared across the Python/TS boundary.

**Alternatives considered**: Add a third model tier just for web research — rejected; not requested, and duplicates spec 015's whole settings surface for no stated need.

## Decision: Reuse `.anthropic_api_key`/`.ai_model` reads via two small exported helpers from `ai-settings.ts`, instead of re-reading the files in a second module

**Decision**: `src/main/ipc/ai-settings.ts` gains two exported functions, `readStoredApiKey()` and `readStoredModelTier()`, extracted from the existing `AI_GET_API_KEY`/`AI_GET_MODEL` handler bodies (behavior unchanged — those handlers now just call them). The new `research-web-search.ts` handler imports both.

**Rationale**: Two call sites reading the same two files is exactly the "single source of truth, one-line change if it ever needs updating" bar the constitution and spec 015 already apply elsewhere; inlining a second copy of the file-path/parsing logic would let the two readers drift.

**Alternatives considered**: Have the research handler call `ai.getApiKey()`/`ai.getModel()` over IPC from itself — not possible (IPC is renderer→main; both readers live in the main process) and unnecessary indirection even if it were.

## Decision: Fetch and cache thumbnail images inline, as part of the same search IPC round trip, using `sharp` (already a dependency) — not a second per-image channel

**Decision**: After parsing Claude's result list, the IPC handler fetches each result's optional `image_url` (plain `fetch`, ~5s per-image timeout so one bad image can't eat the whole request's budget), resizes it with `sharp` to 120px wide (matching the existing `grid` thumbnail size class in `src/main/fs/thumbnails.ts`, for visual consistency with the photo thumbnails already used elsewhere in this app), and writes it to `app.getPath('userData')/research-thumbnails/<sha256(url)>.<ext>` (`crypto`'s built-in `createHash`, no new dependency). The response sent to the renderer carries `localImagePath: string | null` — never the original external URL — so the renderer has no way to accidentally hotlink even by mistake.

**Rationale**: This directly satisfies the clarified requirement (fetch-and-cache, never hotlink) and mirrors the existing photo-thumbnail cache's shape (`src/main/fs/thumbnails.ts`: a `userData`-rooted cache directory, deterministic filename, regenerate-on-miss) while using a content hash instead of a source-file mtime, since a remote URL has no local mtime to key on. Doing it inline keeps this a single request/response contract instead of a second IPC channel plus a loading/placeholder state per image.

**Alternatives considered**: A second `research:cacheImage` channel the renderer calls per-thumbnail after getting text results — rejected; two round trips per result for no benefit, and it re-introduces the exact hotlink risk (renderer would need the raw URL to know what to fetch) that this feature exists specifically to avoid.

## Decision: Serve cached thumbnails through the existing `shelter://` protocol handler — no new protocol

**Decision**: The renderer builds `shelter://${encodeURI(localImagePath)}` for any result with a cached thumbnail, exactly the way `src/renderer/utils/paths.ts`'s `buildPhotoUrl` already does for shelter photos. No changes are needed to `src/main/index.ts`'s `protocol.handle('shelter', ...)` — it already serves any absolute path it's given, with no shelter-specific assumption in the handler itself.

**Rationale**: The handler is already a generic "serve this absolute local file" bridge; registering a second custom scheme for the same job would be pure duplication.

**Alternatives considered**: A new `research-thumb://` protocol — rejected, no behavioral difference, just a second `protocol.registerSchemesAsPrivileged`/`protocol.handle` pair to maintain.

## Decision: "Search web" checkbox, loading/error state, and web results live in `ResearchTab`'s local component state, not Redux

**Decision**: Unlike the archive query/results (persisted in `researchSlice` so they survive a tab switch), the web-search checkbox, in-flight/disabled state, error state, and result list are plain `useState` in `ResearchTab.tsx`, reset on unmount.

**Rationale**: The spec's own Assumptions call web results "ephemeral and session-only" (nothing persists but an explicit Add Citation). Adding a new Redux slice (or extending `researchSlice`) to preserve them across a tab switch is scope the spec doesn't ask for, and the existing local-state pattern (`loading`, `noIndex` in the same component) is the established precedent for exactly this kind of transient UI state.

**Alternatives considered**: Persist web results in `researchSlice` alongside the archive query, matching archive-result tab-switch persistence — rejected for now as an unrequested behavior; easy to add later (`ponytail:` — flagged in the component) if operators want it.

## Decision: "No API key configured" is a static message, not a click-to-navigate link to AI Settings

**Decision**: FR-009's "clear message directing the operator to AI Settings" is plain text in the Web Sources section (e.g. "No Anthropic API key configured — add one in Settings → AI Settings.") — not an interactive button that opens the AI Settings page directly.

**Rationale**: `CollectionsManagementPage`'s existing one-click "Go to AI Settings" link works because `onOpenAiSettings` is already threaded one prop-level down from `SettingsLayout`. `ResearchTab` sits three components below where that navigation state lives (`ShelterBrowser` → `AppBody` → `MainPane` → `ResearchTab`), none of which currently accept navigation props. Wiring a working callback through all three for one error message is disproportionate; a static pointer satisfies FR-009's literal requirement ("clear message directing the operator") without new prop plumbing through otherwise-prop-less components.

**Alternatives considered**: Thread `onOpenAiSettings` through `AppBody`/`MainPane`/`ResearchTab` — rejected for this change; flagged with a `ponytail:` comment at the message site as the natural upgrade if staff ask for one-click nav.

## Decision: The Search Web timeout is 45 seconds (midpoint of the clarified 30-60s range), implemented with `AbortController`

**Decision**: `web-research.ts` aborts its `fetch` at 45,000ms via `AbortController`; an abort is mapped to `{ ok: false, error: 'timeout' }`.

**Rationale**: Sits in the middle of the clarified range; a single round number avoids inventing a second knob the spec never asked to be configurable.

**Alternatives considered**: Make the timeout operator-configurable — rejected, not requested and adds a settings surface for a value the spec only bounds loosely ("roughly 30-60 seconds").
