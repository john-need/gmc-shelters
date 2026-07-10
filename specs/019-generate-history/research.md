# Research: Generate History

No `NEEDS CLARIFICATION` markers remain in Technical Context — all decisions below are technical/implementation choices made during planning (not spec-level ambiguities; those were resolved in `/speckit-clarify`).

## Decision 1: Direct main-process `fetch` call, not a Python subprocess

**Decision**: Model `src/main/ai/generate-history.ts` on `src/main/ai/web-research.ts` (spec 018's direct `fetch`/`AbortController` call to `https://api.anthropic.com/v1/messages` from the Electron main process), not on spec 016's `clean_quote.py` subprocess pattern.

**Rationale**: This repo has two established AI-call shapes: (a) a Python script spawned via `child_process` that itself loads the key/model and calls Anthropic (`scripts/clean_quote.py`, `scripts/ocr_to_markdown.py`), and (b) a direct TypeScript `fetch` call from the main process (`web-research.ts`). Generate History assembles a multi-part prompt from disparate live UI state (Shelter tab fields, filtered Sources-tab citations, current History content) — state that only exists in the running Electron app, never in a file the Python pipeline processes. Building that prompt in Python would mean serializing all of it across a subprocess boundary for no benefit; the direct-`fetch` shape already handles exactly this "build a prompt from live app data, call Anthropic, return text" case with no subprocess, no argv-escaping concerns, and an existing test-mocking convention (inject `fetchImpl`).

**Alternatives considered**: A new Python script mirroring `clean_quote.py` — rejected; adds a subprocess hop and argv-serialization work for data that already lives in the Node process, with no reuse benefit since `clean_quote.py`'s single-string-in/single-string-out shape doesn't fit a multi-field prompt.

## Decision 2: Enable the `web_search` tool for "add its own research"

**Decision**: Reuse the exact `tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, allowed_callers: ['direct'] }]` block from `web-research.ts` in the Generate History request.

**Rationale**: The spec (FR-002, User Story 1) requires Claude to "add its own relevant research" to the given facts. Relying solely on the model's static training data risks stale or fabricated specifics; giving it the same live web-search tool already validated in spec 018 grounds that supplementary research in real, current sources — and it's a zero-new-code reuse of an existing, tested tool configuration (Constitution Principle V).

**Alternatives considered**: No tool, relying on training-data knowledge only — rejected as weaker grounding for a feature explicitly framed as "factual" (spec Success Criteria) with no corresponding reduction in complexity (the tool config is copy-paste, not new work).

## Decision 3: Plain narrative text response, not JSON

**Decision**: Unlike `web-research.ts` (which parses a trailing JSON array out of the response), `generate-history.ts` returns the joined, trimmed text of the response's `text`-type content blocks directly as the narrative body — no JSON parsing/validation step.

**Rationale**: The output is prose, not structured records; there's nothing to validate field-by-field. The prompt (Decision 5) explicitly asks for markdown prose only, so the simplest correct extraction is "join the text blocks, trim."

**Alternatives considered**: Asking for a JSON envelope (e.g. `{ "narrative": "..." }`) then parsing it — rejected as pure extra complexity; it adds a failure mode (malformed JSON) for no benefit over reading the text blocks directly, which is exactly what `research-web-search.ts`'s own final-text join already does before that module's JSON-array extraction step.

## Decision 4: Timeout and token budget

**Decision**: Reuse the same `DEFAULT_TIMEOUT_MS = 45_000` convention as `web-research.ts` (a local module constant, not a shared one — matching that file's own style of not centralizing a single-use constant). Use a larger `max_tokens` (4096) than `web-research.ts`'s 2048, since a multi-paragraph shelter narrative needs more room than a short JSON array of search snippets.

**Rationale**: 45s already proved workable for a comparable "Claude + web_search tool" round trip in spec 018; there's no basis in the spec for a different budget, and inventing one would be an unjustified new NFR. The larger token budget is sized to the difference in output shape (prose narrative vs. snippet array), not a new tunable exposed to the user.

**Alternatives considered**: A configurable timeout/token setting — rejected as speculative; no request for it, and it would add a new settings surface for a single internal parameter.

## Decision 5: Prompt structure — plain markdown body, no heading, no Sources section, blended research

**Decision**: The prompt instructs Claude to return only markdown prose (no top-level `#`/`##` title heading, no "Sources"/bibliography section, no in-text distinction between given facts and its own added research), built from: the shelter's name and fact fields (architecture, built-by, description, notes, start/end year, extant/GMC/category flags), the given citations formatted via the existing `citeChicagoMarkdown()` (`src/shared/cite-chicago.ts`), and the current History content with its mechanical Sources section already stripped (Decision 6).

**Rationale**: Directly implements the three `/speckit-clarify` answers: the app supplies the `# {Shelter Name}` heading and reattaches the mechanical Sources section itself (FR-004, FR-006), so Claude must not duplicate either; and the narrative is one blended account (no provenance markers), matching the third clarification.

**Alternatives considered**: Asking Claude to also emit the Sources section in Chicago format — rejected; the app already has an authoritative, tested citation formatter (`citeChicagoMarkdown`) wired into `history-sources.ts`'s existing sync, so having the LLM re-derive the same formatted list risks drift from the mechanical version and duplicated content.

## Decision 6: Reuse `history-sources.ts` for strip/reattach instead of new logic

**Decision**: `src/shared/generate-history.ts` implements `stripSourcesSection(markdown)` as `syncHistorySourcesSection(markdown, [])` (passing an empty citation list removes any existing `### Sources` section via the existing split/rebuild logic) and `assembleAcceptedHistory(shelterName, narrativeBody, citations)` as `syncHistorySourcesSection(`# ${shelterName}\n\n${narrativeBody.trim()}\n`, citations)` (reattaching the current mechanical section).

**Rationale**: `history-sources.ts`'s `syncHistorySourcesSection` already handles "remove old Sources section, insert current one" idempotently and is already covered by its own tests (`history-sources.test.ts`). Calling it with an empty array is a documented, already-tested code path (`buildHistorySourcesSection([])` returns `''`, which the sync function's own empty-section branch already handles by stripping any existing section) — no new stripping logic to write or test from scratch.

**Alternatives considered**: A new regex/string-split implementation duplicating `splitAroundSourcesSection`'s logic — rejected; that function already exists (unexported) in the same module and is exercised by `syncHistorySourcesSection`, so reuse avoids a second, divergent implementation of "find the `### Sources` heading and everything until the next heading."

## Decision 7: `hasValidApiKey` availability on the History tab

**Decision**: `HistoryTab.tsx` dispatches `loadApiKey()` in a mount effect, mirroring `SourcesTab.tsx`'s existing `useEffect(() => { dispatch(loadApiKey()); }, [dispatch])`.

**Rationale**: `loadApiKey` is currently only dispatched from `SourcesTab`, so a user who opens a shelter and goes straight to the History tab without visiting Sources would see `aiSettings.apiKey` at its initial (empty) value, incorrectly disabling "Generate History" even with a valid key configured. `loadApiKey` is a cheap, idempotent read of a local file via IPC — dispatching it from a second tab is safe and matches the one-line-per-consumer pattern already used for `loadSources` (dispatched from `MainPane.tsx` on shelter selection, independent of active tab).

**Alternatives considered**: Hoisting `loadApiKey` to `MainPane.tsx` (app-wide, like `loadSources`) — rejected as a broader change than this feature needs; `SourcesTab` already establishes the "dispatch on the tab that needs it" precedent, so `HistoryTab` following the same precedent is the smaller, more consistent diff.

## Decision 8: Extract `renderMarkdown` into `src/renderer/markdown.ts`

**Decision**: Move the existing hand-rolled `renderMarkdown()`/`inline()` functions out of `HistoryTab.tsx` into a new `src/renderer/markdown.ts`, imported by both `HistoryTab.tsx` (unchanged behavior) and the new `GenerateHistoryModal.tsx`.

**Rationale**: FR-004 requires the review modal to render "the exact document that would replace the History tab's content" in markdown preview mode — i.e., the same rendering the History tab's own Preview pane already uses. Duplicating the ~70-line hand-rolled renderer into the modal would create two implementations of the same markdown subset that could silently drift; extracting it is a pure move (no behavior change), covered by a parity test.

**Alternatives considered**: Adding a markdown library dependency (e.g. `marked`) — rejected; the existing renderer already covers the subset this app uses (headings, lists, blockquotes, bold/italic, links) and works today, so swapping it for a new dependency is unrelated scope creep for this feature.
