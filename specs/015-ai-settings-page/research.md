# Research: AI Settings Page

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the two open scope questions were resolved in `/speckit-clarify` (see spec.md's Clarifications section). This document records the implementation-approach decisions made while grounding the plan in the existing codebase.

## Decision: Store the model preference as a semantic tier (`'default' | 'escalation'`), not a raw model ID string

**Decision**: The persisted preference (both the Electron-side file and the IPC/UI value) is one of the two tier keys `'default'` or `'escalation'` — not the literal Claude model ID string (e.g. `claude-haiku-4-5-20251001`).

**Rationale**: `scripts/lib/llm_client.py` already names the two wired-in models `DEFAULT_MODEL` and `ESCALATION_MODEL` as version-specific ID strings. Those are the single source of truth for what a "model" is in this app (per Constitution Principle I). If the Electron/TypeScript side stored or round-tripped the raw ID string, a future model version bump (e.g. Haiku 4.5 → 4.6) would require updating the ID in two places and now leaves the risk of the JS side holding a stale/unrecognized ID. Storing the stable tier key instead means only `llm_client.py`'s two constants ever need to change; the tier key they're indexed by does not.

**Alternatives considered**: Store the actual model ID string end-to-end — rejected for the drift risk above. Fetch the current model ID list from Python at UI-load time via a new IPC round-trip to the pipeline — rejected as unjustified complexity for two fixed, rarely-changing options; a small manually-kept label map (see Data Model) is simpler and matches how `SourceType`/`HEADER_SCHEMA` already duplicate small, stable vocab between TS and Python in this repo (`specs/014-wiki-header-schema-form`).

## Decision: New gitignored preference file `.ai_model`, mirroring the existing `.anthropic_api_key` pattern

**Decision**: Add `.ai_model` at the repository root (gitignored, plain text, trimmed tier key), read/written by a new pair of IPC handlers in `src/main/ipc/ai-settings.ts`, and read by a new `load_model_tier()` helper in `scripts/lib/llm_client.py`.

**Rationale**: `ai-settings.ts` already establishes exactly this pattern for the API key (`KEY_FILENAME = '.anthropic_api_key'`, read/write with `fs`, gitignored). Reusing it for the model tier keeps both pieces of AI configuration symmetric, in the same file, using the same storage mechanism, discoverable by the same operators who already know to look for `.anthropic_api_key`. No SQLite involvement is needed — this is a single scalar preference, not structured relational data.

**Alternatives considered**: A JSON config file holding both the key and the model tier — rejected; it would require a breaking read/write change to the already-working API key path for no functional gain, and mixes a secret (the key) with a non-secret preference (the tier) in one file with one set of file permissions. Keeping them as two small files (one already existing, one new) is simpler and lower-risk.

## Decision: `escalate=True` call sites remain hard-wired to `ESCALATION_MODEL`; only the `escalate=False` (default) path becomes configurable

**Decision**: `AnthropicClient.__init__` gains an optional `primary_model: str = DEFAULT_MODEL` parameter. `_call(..., escalate)` uses `ESCALATION_MODEL if escalate else self.primary_model`. The one production call site (`scripts/ocr_to_markdown.py`) passes `primary_model=resolve_primary_model(load_model_tier(REPO))`, where `resolve_primary_model` maps the tier key to `DEFAULT_MODEL` or `ESCALATION_MODEL`.

**Rationale**: Today no caller in this codebase ever passes `escalate=True` (verified: `ocr_to_markdown.py`'s only call is `client.caption_image(data, CAPTION_PROMPT)`, no `escalate` argument) — `ESCALATION_MODEL` is a wired-in constant with an existing, tested code path (`test_escalation_model_used_when_requested` in `tests/unit/test_llm_client.py`) but no live caller opts into it yet. Per the spec's Assumptions, this feature does not touch that internal escalation mechanism at all; it only makes the *primary* (currently hardcoded `DEFAULT_MODEL`) model operator-selectable between the app's two known models. This keeps the diff minimal and the existing escalation test passing unchanged.

**Alternatives considered**: Repoint `ESCALATION_MODEL` itself based on the preference — rejected; conflates two independent concerns (which model is primary vs. the unused escalation path) and risks breaking the existing escalation unit test's fixed expectation.

## Decision: Extract `ApiKeyCard` into the new `AiSettingsPage.tsx`, add a small link-back note on Collections, thread `onOpenAiSettings` as a prop

**Decision**: Move the existing `ApiKeyCard` function (currently `CollectionsManagementPage.tsx:1059-1158`) verbatim into a new `src/renderer/components/Settings/AiSettingsPage.tsx`. `CollectionsManagementPage` gains one new prop, `onOpenAiSettings: () => void`, used by (a) a small replacement card where `<ApiKeyCard/>` used to render, and (b) the existing `NeedsApiKeyDialog`'s copy/button (currently says "Add it below" — no longer true once the field moves). `SettingsLayout.tsx` passes `() => setPage('ai-settings')` for this prop, the same way it already owns `page`/`setPage`.

**Rationale**: This is the smallest change that satisfies FR-003/FR-003a: no new routing/context library, no page-registry abstraction — one prop, passed down one level, exactly like `page`/`setPage` are already passed into `SettingsLayout` from `ShelterBrowser.tsx`. `ApiKeyCard`'s internals (state, save/remove/reveal logic) don't change at all, only its file location and render site.

**Alternatives considered**: A shared navigation context/store for cross-settings-page links — rejected as premature; this is the first and only cross-page link in Settings today, so a one-prop callback is proportionate (Constitution Principle V).

## Decision: New "AI Settings" nav entry gets its own `id` (`'ai-settings'`), distinct from Collections' existing `id: 'ai'`

**Decision**: `SettingsLayout.tsx`'s `pages` array gets a new entry `{ id: 'ai-settings', label: 'AI Settings', ... }`; the existing Collections entry (currently confusingly `id: 'ai'`, `label: 'Collections'`) is left untouched — same id, same label, same page component.

**Rationale**: Renaming the existing `id: 'ai'` would be a pure refactor with no spec-driven need (nothing reads that id string outside `SettingsLayout.tsx`'s own switch), and touching it only adds risk/diff for no behavior change. The spec's Assumptions explicitly say the "Collections" entry keeps its current label and scope.
