# Implementation Plan: AI Settings Page

**Branch**: `015-ai-settings-page` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/015-ai-settings-page/spec.md`

## Summary

Add a new "AI Settings" entry to the Settings menu. Relocate the existing Anthropic API key card (`ApiKeyCard`, currently embedded in `CollectionsManagementPage.tsx`) onto that new page unchanged, and add a model-selection dropdown next to it. The dropdown offers exactly the two Claude models already wired into the Python conversion pipeline (`scripts/lib/llm_client.py`'s `DEFAULT_MODEL`/`ESCALATION_MODEL`) via a stable tier key (`'default' | 'escalation'`), persisted in a new gitignored `.ai_model` file mirroring the existing `.anthropic_api_key` pattern. The Collections page keeps its explanatory note about needing a key, now with a link over to AI Settings instead of a dead end. Both clarifications from `/speckit-clarify` (exact model list = the two already-wired models; Collections keeps a note + link) are carried through directly into the requirements below.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/renderer/preload) for the new page, nav entry, and IPC; Python 3 (matching `scripts/lib/llm_client.py`) for resolving the persisted tier into an actual model ID at the one call site that constructs `AnthropicClient`.
**Primary Dependencies**: None new. Reuses the existing `fs`-based settings-file pattern already in `src/main/ipc/ai-settings.ts`, the existing `<select>`/`.settings-card` UI conventions, and the existing `AnthropicClient`/`llm_client.py` module.
**Storage**: Two flat files at the repository root, both gitignored, owner-readable: `.anthropic_api_key` (existing, untouched) and `.ai_model` (new — one of `default`/`escalation`, plain text). No SQLite involvement.
**Testing**: Jest (`src/main/**/*.test.ts` node env, `src/renderer/**/*.test.tsx` jsdom) + pytest (`tests/unit/`). Failing tests planned first for every new/changed unit:
  - `src/main/ipc/ai-settings.test.ts` (extend) — `AI_GET_MODEL`/`AI_SET_MODEL` round-trip, fallback to `'default'` on missing/invalid file, rejects an invalid tier on set
  - `src/renderer/components/Settings/AiSettingsPage.test.tsx` (NEW) — API key save/reveal/remove (moved assertions from `CollectionsManagementPage.test.tsx`), model dropdown shows current selection, changing it saves immediately with no separate Save action
  - `src/renderer/components/Settings/CollectionsManagementPage.test.tsx` (extend/edit) — API key field no longer renders on this page; explanatory note + link to AI Settings is present; `NeedsApiKeyDialog` copy/button navigates to AI Settings instead of saying "Add it below"
  - `src/renderer/components/Settings/SettingsLayout.test.tsx` (NEW — no test file exists for this component today) — "AI Settings" nav entry present and renders `AiSettingsPage`; clicking Collections' link-back button switches to it
  - `tests/unit/test_llm_client.py` (extend) — `load_model_tier()` env-free file read + fallback behavior; `resolve_primary_model()` tier→ID mapping; `AnthropicClient` uses `primary_model` for `escalate=False` calls and still uses `ESCALATION_MODEL` for `escalate=True` (existing test `test_escalation_model_used_when_requested` must keep passing unchanged)
**Target Platform**: Electron desktop app (macOS primary), local filesystem only — no network/external consumer beyond the pipeline's existing calls to the Anthropic API.
**Project Type**: Hybrid Electron app + Python conversion-pipeline scripts, same split established by `specs/013-research-and-citation`/`specs/014-wiki-header-schema-form`: the app owns the settings UI and its own local preference files; Python reads the same files directly for the one call site that needs the model choice.
**Performance Goals**: Single scalar read/write per interaction (dropdown change, page load) — well under existing IPC latency norms elsewhere in this app; no batch or bulk path introduced.
**Constraints**: Model preference persists as the semantic tier key, never the raw model ID string (research.md) — the raw IDs stay solely in `llm_client.py`'s two constants. Selecting a model tier MUST NOT change the untouched `escalate=True` code path or its existing passing test. No new npm/pip dependency.
**Scale/Scope**: Touches: `src/shared/ipc-types.ts` (new channels + `AiModelTier`/`AI_MODEL_OPTIONS`), `src/main/ipc/ai-settings.ts` (model get/set handlers), `src/main/preload.ts`, `src/renderer/components/Settings/AiSettingsPage.tsx` (new), `src/renderer/components/Settings/CollectionsManagementPage.tsx` (remove `ApiKeyCard`, add link-back note + `onOpenAiSettings` prop, update `NeedsApiKeyDialog`), `src/renderer/components/Settings/SettingsLayout.tsx` (new nav entry, wiring), `src/renderer/routes/ShelterBrowser.tsx` (pass `onOpenAiSettings` through, if needed by the prop chain), `scripts/lib/llm_client.py` (`load_model_tier`, `resolve_primary_model`, `AnthropicClient.primary_model`), `scripts/ocr_to_markdown.py` (pass `primary_model` at construction).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Source of truth identified** (Principle I): Two local, repository-root preference files (`.anthropic_api_key`, existing; `.ai_model`, new) are the canonical inputs, named explicitly in spec.md's Source of Truth section and data-model.md. The Anthropic API remains the only out-of-repo consumer, unchanged.
- [x] **Test-first scope identified** (Principle II): Failing tests planned first for all units listed under Testing above, spanning `src/main/ipc/` and `src/renderer/components/Settings/` (Jest) and `scripts/lib/` (pytest) — matching this repo's existing per-module pairing (same convention `specs/014-wiki-header-schema-form` used).
- [x] **External contract coverage** (Principle III): N/A for out-of-repo consumers (none — the Anthropic API call shape is unchanged, only which model ID is sent). This feature adds one new *internal* IPC contract, documented in `contracts/ai-model-ipc.md`, following the same internal-contract convention as `specs/014-wiki-header-schema-form/contracts/wiki-header-ipc.md`.
- [x] **Idempotency and auditability** (Principle IV): N/A in the batch-import/sync sense — this is a single-operator settings toggle, not a rerunning batch workflow. Setting the same tier twice is a no-op overwrite with identical file contents.
- [x] **Minimal-change fit** (Principle V): All changes stay within the existing `src/shared/`, `src/main/ipc/`, `src/main/preload.ts`, `src/renderer/components/Settings/`, `src/renderer/routes/` trees, and `scripts/lib/`/`scripts/` on the Python side — the same trees `specs/013-research-and-citation`/`specs/014-wiki-header-schema-form` already touch. No new top-level directory, no new dependency, no new storage mechanism (reuses the exact file-based pattern `.anthropic_api_key` already established).
- [x] **WordPress/theme boundary respected** (Principle V/III): N/A — no theme or WordPress surface touched.

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/015-ai-settings-page/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ai-model-ipc.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/shared/ipc-types.ts                 # new CHANNELS.AI_GET_MODEL/AI_SET_MODEL; AiModelTier type;
                                         #   AI_MODEL_OPTIONS constant (tier -> display label);
                                         #   ElectronAPI.ai gains getModel()/setModel()

src/main/ipc/
├── ai-settings.ts                      # NEW: MODEL_FILENAME = '.ai_model'; getModel()/setModel()
│                                        #   handlers; validates tier, falls back to 'default'
└── ai-settings.test.ts                 # TDD: extend — failing tests first for the new handlers

src/main/preload.ts                     # ai.getModel/ai.setModel wired to the new channels

src/renderer/components/Settings/
├── AiSettingsPage.tsx                  # NEW: page header + relocated <ApiKeyCard/> (moved verbatim
│                                        #   from CollectionsManagementPage.tsx) + new model <select>
├── AiSettingsPage.test.tsx             # TDD: NEW — failing tests first (key save/reveal/remove
│                                        #   moved here, model dropdown selection + immediate persist)
├── CollectionsManagementPage.tsx       # ApiKeyCard removed; small link-back card added; gains
│                                        #   onOpenAiSettings prop; NeedsApiKeyDialog copy/button updated
├── CollectionsManagementPage.test.tsx  # TDD: extend — key-field assertions removed/moved; new
│                                        #   assertions for the link-back note and dialog copy
├── SettingsLayout.tsx                  # new `{ id: 'ai-settings', label: 'AI Settings', ... }` nav
│                                        #   entry; renders <AiSettingsPage/>; passes onOpenAiSettings
│                                        #   down to CollectionsManagementPage as () => setPage('ai-settings')
└── SettingsLayout.test.tsx             # TDD: NEW — no test file exists for this component today

src/renderer/routes/ShelterBrowser.tsx  # no functional change expected — already owns/passes
                                         #   page/setPage into SettingsLayout

scripts/lib/
├── llm_client.py                       # NEW: MODEL_FILENAME = '.ai_model'; load_model_tier(repo_root);
│                                        #   resolve_primary_model(tier); AnthropicClient gains
│                                        #   primary_model param, used only for escalate=False calls
└── (test_llm_client.py lives under tests/unit/, see below)

scripts/
└── ocr_to_markdown.py                  # AnthropicClient construction passes
                                         #   primary_model=resolve_primary_model(load_model_tier(REPO))

tests/unit/
└── test_llm_client.py                  # TDD: extend — load_model_tier fallback/validation,
                                         #   resolve_primary_model mapping, primary_model wired
                                         #   into escalate=False calls, escalate=True unaffected

.gitignore                              # add `.ai_model` alongside the existing `.anthropic_api_key` entry
```

**Structure Decision**: Same hybrid Electron-app-plus-Python-scripts split already established by `specs/013-research-and-citation`/`specs/014-wiki-header-schema-form`: the app owns the settings UI and both local preference files directly; the one Python call site that needs the model choice reads the same file `llm_client.py` already reads the key file from. No `database/migrations/` or new top-level directory — no SQLite involvement.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
