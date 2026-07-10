# Implementation Plan: Generate History

**Branch**: `019-generate-history` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-generate-history/spec.md`

## Summary

Add a "Generate History" button to the History tab, after the Source/Both/Preview view-mode toggle. Clicking it gathers the current shelter's facts (Shelter tab fields), its included citations (Sources tab, `include_in_history`), and the current History tab content (with its mechanical `### Sources` section stripped), and sends them to Claude — via the app's existing AI Settings key/model (spec 015) — with the `web_search` tool enabled (spec 018's exact tool config) so it can add its own grounded research. The returned narrative body is shown in a new `GenerateHistoryModal`, rendered as the full document that would result (heading + narrative + reattached Sources section) via the History tab's existing markdown preview renderer (extracted to a shared module so both places use one implementation). Accept replaces the History tab's in-editor content (marks it dirty, same as a manual edit — the existing Save button still persists it); Reject/dismiss discards the draft with zero side effects. Built test-first per user request: every new unit below has a failing test written before its implementation.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/preload/renderer) — no Python involved, same as spec 018.
**Primary Dependencies**: None new. Reuses the runtime's built-in `fetch`/`AbortController` (same as `src/main/ai/web-research.ts`), the existing `sk-ant-` key-format check (`src/shared/anthropic-key.ts`), and the existing citation-sync helpers (`src/shared/history-sources.ts`).
**Storage**: No SQLite changes, no new files on disk. The generated narrative is held only in React component state until Accept, at which point it becomes ordinary (unsaved) History tab content — persistence still goes through the existing `saveHistory` flow.
**Testing**: Jest, TDD (explicit user request) — every listed unit below has its failing test(s) written before implementation, following this repo's per-module pairing convention (`X.ts` + `X.test.ts`):
  - `src/shared/generate-history.test.ts` (NEW) — `stripSourcesSection()` removes an existing `### Sources` section and leaves prose untouched when there is no section to remove; `assembleAcceptedHistory()` produces `# {name}\n\n{trimmed body}\n` followed by the reattached Sources section for the given citations, and produces no Sources section when no citations are included
  - `src/main/ai/generate-history.test.ts` (NEW) — builds a request body containing the shelter facts, the Chicago-formatted citations, and the stripped history text, with the `web_search` tool enabled (mirrors `web-research.test.ts`'s assertions style); returns `{ ok: true, narrative }` from a well-formed response (joined text blocks, trimmed); maps a non-2xx response to `{ ok: false, error: 'network' }`; maps an aborted/timed-out request to `{ ok: false, error: 'timeout' }` (injectable `fetch`/timeout, no real 45s wait in the test)
  - `src/main/ipc/generate-history.test.ts` (NEW) — no stored key → `{ ok: false, error: 'no_api_key' }` with zero network calls; stored key present → resolves model, calls `generate-history.ts`, returns its outcome unchanged
  - `src/main/preload.test.ts` (extend) — `history.generate` is exposed as a function calling `CHANNELS.HISTORY_GENERATE`
  - `src/renderer/markdown.test.ts` (NEW) — the extracted `renderMarkdown()` behaves identically to today's inline version (headings, lists, blockquotes, bold/italic, links)
  - `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` (extend) — "Generate History" button renders after the view-mode toggle; disabled with a "requires AI API key" title when no valid key is configured; clicking it (with a valid key) calls `window.api.history.generate` with the current shelter facts, included citations, and Sources-stripped history content; button shows a busy state for the duration of an in-flight call and a second click while busy is inert; a successful response opens `GenerateHistoryModal` with the narrative; a `no_api_key`/`network`/`timeout` response shows an inline error and never opens the modal; the History tab's content and dirty state are untouched until Accept
  - `src/renderer/components/MainPane/tabs/GenerateHistoryModal.test.tsx` (NEW) — renders the assembled preview document (heading + body + reattached Sources section) via the shared markdown renderer; clicking Accept calls `onAccept` once; clicking Reject or dismissing calls `onReject` once; neither is called before a click
**Target Platform**: Electron desktop app (macOS primary).
**Project Type**: Electron app only — no `scripts/`/Python changes.
**Performance Goals**: One Anthropic call per explicit "Generate History" click (never automatic), same ~45s client-side timeout convention as spec 018's web search (research.md Decision 4).
**Constraints**: The History tab's content and dirty state MUST NOT change until an explicit Accept (FR-003); the "Generate History" button MUST be un-clickable while a request is in flight (FR-008); no new npm dependency.
**Scale/Scope**: Touches: `src/shared/ipc-types.ts`, `src/shared/generate-history.ts` (new), `src/main/ai/generate-history.ts` (new), `src/main/ipc/generate-history.ts` (new), `src/main/index.ts` (register the new handler), `src/main/preload.ts` (expose `history.generate`), `src/renderer/markdown.ts` (new — extracted from `HistoryTab.tsx`), `src/renderer/components/MainPane/tabs/HistoryTab.tsx` (button, state, wiring), `src/renderer/components/MainPane/tabs/GenerateHistoryModal.tsx` (new).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Source of truth identified** (Principle I): The Shelter tab's fields, the Sources tab's `include_in_history` citations, and the History tab's own current content are the canonical local inputs — all named explicitly in spec.md and data-model.md. The Anthropic API is treated strictly as an external generation service; its output is never canonical shelter data until a human explicitly accepts it (spec.md Clarifications).
- [x] **Test-first scope identified** (Principle II): Failing tests planned first for every new/changed unit, listed under Testing above, spanning `src/shared/`, `src/main/ai/`, `src/main/ipc/`, and `src/renderer/`.
- [x] **External contract coverage** (Principle III): The Anthropic call is documented as one internal IPC contract (`contracts/history-generate-ipc.md`) — the renderer never talks to Anthropic directly, so there is no new out-of-repo consumer contract (no WordPress/theme/export surface here). Operator documentation: `quickstart.md` covers the manual-trigger flow and cost model (one call per click).
- [x] **Idempotency and auditability** (Principle IV): N/A in the batch-import/sync sense — this is an interactive, one-shot-per-click generation, not a rerunning batch workflow. The one persistent side effect (replacing History tab content) only happens on an explicit Accept, identical in shape to today's manual-edit-then-Save flow.
- [x] **Minimal-change fit** (Principle V): All changes stay within `src/shared/`, `src/main/ai/` (extends the small existing directory from spec 018 with one more focused file, no framework), `src/main/ipc/`, `src/main/preload.ts`, and `src/renderer/`. No new top-level directory, no new dependency; reuses the exact Anthropic call shape, timeout convention, and `web_search` tool config already established by `web-research.ts`, and the exact citation-sync helpers already established by `history-sources.ts` — nothing reinvented.
- [x] **WordPress/theme boundary respected** (Principle V/III): N/A — no theme or WordPress surface touched.

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/019-generate-history/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── history-generate-ipc.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/shared/
├── ipc-types.ts                            # extend: CHANNELS.HISTORY_GENERATE; GenerateHistoryShelterFacts,
│                                            #   GenerateHistoryRequest, GenerateHistoryError, GenerateHistoryResponse
│                                            #   types; ElectronAPI.history.generate()
├── generate-history.ts                     # NEW: stripSourcesSection(), assembleAcceptedHistory() — thin,
│                                            #   well-tested wrappers over the existing history-sources.ts sync
└── generate-history.test.ts                # TDD: NEW — failing tests first

src/main/ai/
├── generate-history.ts                     # NEW: builds the narrative-generation request (shelter facts +
│                                            #   Chicago citations + stripped history), calls fetch with the
│                                            #   same web_search tool config and AbortController timeout as
│                                            #   web-research.ts, returns the joined/trimmed narrative text
└── generate-history.test.ts                # TDD: NEW — failing tests first (see Testing above)

src/main/ipc/
├── generate-history.ts                     # NEW: registerGenerateHistoryHandlers(); key/model lookup →
│                                            #   src/main/ai/generate-history.ts → response
└── generate-history.test.ts                # TDD: NEW — failing tests first

src/main/index.ts                           # add registerGenerateHistoryHandlers() alongside the other
                                             #   register*Handlers() calls; no new test needed (existing
                                             #   index.test.ts doesn't assert individual registrations)

src/main/preload.ts                         # add `history.generate` alongside the existing `history.read`/
│                                            #   `history.write`
src/main/preload.test.ts                    # TDD: extend — history.generate exposure

src/renderer/
├── markdown.ts                             # NEW: renderMarkdown() extracted verbatim from HistoryTab.tsx so
│                                            #   GenerateHistoryModal can reuse the same hand-rolled preview
│                                            #   renderer instead of a second copy
└── markdown.test.ts                        # TDD: NEW — failing tests first (behavior parity, see Testing above)

src/renderer/components/MainPane/tabs/
├── HistoryTab.tsx                           # add "Generate History" button after the view-mode toggle;
│                                            #   import renderMarkdown from ../../../markdown instead of the
│                                            #   local copy; generating/error/draft state; opens
│                                            #   GenerateHistoryModal on success
├── HistoryTab.test.tsx                      # TDD: extend — failing tests first (see Testing above)
├── GenerateHistoryModal.tsx                 # NEW: review modal — renders the assembled preview document,
│                                            #   Accept/Reject actions
└── GenerateHistoryModal.test.tsx            # TDD: NEW — failing tests first
```

**Structure Decision**: Pure Electron-app change, directly parallel to spec 018's structure — no `scripts/`/Python involvement, no SQLite migration. `src/main/ai/generate-history.ts` sits alongside `web-research.ts` in the small existing `src/main/ai/` directory rather than starting a new one. The one cross-cutting refactor is extracting `renderMarkdown()` out of `HistoryTab.tsx` into `src/renderer/markdown.ts` so the new review modal doesn't duplicate the hand-rolled markdown renderer — everything else is additive.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
