# Tasks: AI Settings Page

**Input**: Design documents from `/specs/015-ai-settings-page/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-model-ipc.md, quickstart.md
**Tests**: TDD explicitly requested (user input to `/speckit-tasks`) — every behavior-bearing task below writes a failing test before the implementation task that makes it pass.
**Organization**: Tasks are grouped by user story (US1/US2, matching spec.md priorities P1/P2) for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- Every task names an exact file path

## Path Conventions

Hybrid layout (see plan.md's Structure Decision):

- TypeScript/Electron side, tests colocated `*.test.ts`/`*.test.tsx` next to the module (this repo's existing convention): `src/shared/`, `src/main/ipc/`, `src/main/preload.ts`, `src/renderer/components/Settings/`
- Python side, tests under `tests/unit/` (this repo's existing convention): `scripts/`, `scripts/lib/`

## Phase 1: Setup

- [X] T001 Add `.ai_model` to `.gitignore`, immediately below the existing `.anthropic_api_key` entry

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: N/A for this feature. There is no shared groundwork both stories need before either can start — User Story 1 (the new page, relocated key card, Collections link-back) touches no files User Story 2 (the model dropdown) depends on except the page shell itself, which is US1's own deliverable. Per plan.md, US2 explicitly depends on US1 completing first (see Dependencies below) rather than on separate foundational work.

**Checkpoint**: Proceed directly to User Story 1.

---

## Phase 3: User Story 1 - Find AI configuration in its own place (Priority: P1) 🎯 MVP

**Goal**: A new "AI Settings" entry in the Settings nav opens a page holding the Anthropic API key card (moved, unchanged behavior). The Collections page no longer shows that field, but keeps its explanatory note plus a link back to AI Settings so operators are never stuck.

**Independent Test**: Per quickstart.md — open Settings, click "AI Settings," confirm the key field (save/reveal/remove, `sk-ant-` validation) works there; open Collections, confirm the field is gone but the note and a link to AI Settings remain and the link navigates correctly.

### Tests for User Story 1 ⚠️

- [X] T002 [P] [US1] Write failing tests in NEW `src/renderer/components/Settings/AiSettingsPage.test.tsx`: page renders an "AI Settings" header; the API key card loads the saved key via `window.api.ai.getApiKey()`, saves a new key via `window.api.ai.setApiKey()` on Save, rejects a value not starting with `sk-ant-` without calling `setApiKey`, and Remove clears the key (port the assertions currently in `CollectionsManagementPage.test.tsx`'s "still saves the API key from this page" / "still rejects a malformed API key" tests, dropping the "still" framing since the field now lives here natively)
- [X] T003 [P] [US1] Edit `src/renderer/components/Settings/CollectionsManagementPage.test.tsx`: remove the two API-key-field tests moved in T002 (`getByLabelText(/anthropic api key/i)` no longer exists on this page); add a failing test asserting `screen.queryByLabelText(/anthropic api key/i)` is null; add a failing test asserting a link-back note is present and that clicking its button/link calls a mocked `onOpenAiSettings` prop passed into `CollectionsManagementPage`
- [X] T004 [P] [US1] Edit `src/renderer/components/Settings/CollectionsManagementPage.test.tsx`: add a failing test that `NeedsApiKeyDialog`'s copy no longer says "Add it below," and that its action button calls `onOpenAiSettings` (threaded down into `CollectionsCard`, which owns the `needsApiKey` state and renders the dialog)
- [X] T005 [P] [US1] Write failing tests in NEW `src/renderer/components/Settings/SettingsLayout.test.tsx`: the nav renders an "AI Settings" item distinct from "Collections"; clicking it calls `setPage('ai-settings')`; when `page === 'ai-settings'`, `AiSettingsPage` renders; `CollectionsManagementPage` receives an `onOpenAiSettings` prop that, when invoked, results in `setPage` being called with `'ai-settings'`

### Implementation for User Story 1

- [X] T006 [US1] Create `src/renderer/components/Settings/AiSettingsPage.tsx`: page header matching the existing convention (`.settings-page-head` / `.settings-page-title` / `.settings-page-sub`, e.g. "AI Settings" / "§ Settings / AI Settings"), and move the `ApiKeyCard` function (currently `CollectionsManagementPage.tsx` lines ~1059–1158) into this file verbatim, rendered inside a `.settings-body` wrapper — makes T002 pass
- [X] T007 [US1] Edit `src/renderer/components/Settings/CollectionsManagementPage.tsx`: delete the `ApiKeyCard` function definition and its `<ApiKeyCard/>` render call from the top-level `CollectionsManagementPage` component; add an `onOpenAiSettings: () => void` prop to `CollectionsManagementPage` and pass it through to `<CollectionsCard onOpenAiSettings={onOpenAiSettings}/>`; in `CollectionsManagementPage`'s own JSX, replace the removed `<ApiKeyCard/>` with a small `.settings-card` note ("Anthropic API key" + the existing requirement text) containing a button/link that calls `onOpenAiSettings` — makes the T003 assertions pass
- [X] T008 [US1] Edit `src/renderer/components/Settings/CollectionsManagementPage.tsx`: add `onOpenAiSettings: () => void` to `CollectionsCard`'s props and to `NeedsApiKeyDialog`'s props (threaded through from `CollectionsCard`, which renders `NeedsApiKeyDialog`); update `NeedsApiKeyDialog`'s copy to remove "Add it below" and instead prompt the operator to configure the key on AI Settings, with its action button calling `onOpenAiSettings` — makes T004 pass
- [X] T009 [US1] Edit `src/renderer/components/Settings/SettingsLayout.tsx`: add `{ id: 'ai-settings', label: 'AI Settings', sub: 'model & api key', icon: <svg .../> }` to the `pages` array (icon in the same 14×14 stroke style as the existing entries); render `<AiSettingsPage/>` when `page === 'ai-settings'`; pass `onOpenAiSettings={() => setPage('ai-settings')}` into `<CollectionsManagementPage/>` — makes T005 pass

**Checkpoint**: User Story 1 is fully functional and independently testable — AI Settings exists with a working key card, and Collections links over to it instead of embedding the field.

---

## Phase 4: User Story 2 - Choose which Claude model performs AI processing (Priority: P2)

**Goal**: The AI Settings page gains a "Model" dropdown offering the two Claude models already wired into the pipeline (`default` / `escalation`), pre-selected to the current choice, saving immediately on change and persisting across restarts; the next OCR cleanup or captioning run uses the selected model.

**Independent Test**: Per quickstart.md — on AI Settings, switch the Model dropdown, confirm no separate Save action is needed, restart the app and confirm the choice stuck, then run a cleanup pass and confirm (via the request the fake transport receives, in tests) it used the selected model's ID.

### Tests for User Story 2 ⚠️

- [X] T010 [P] [US2] Extend `tests/unit/test_llm_client.py`: add tests for new `load_model_tier(repo_root)` — returns `'default'` when `.ai_model` doesn't exist; returns the file's trimmed contents when it is exactly `'default'` or `'escalation'`; returns `'default'` when the file holds anything else (empty string, unrecognized text); add tests for new `resolve_primary_model(tier)` — maps `'default'` → `llm_client.DEFAULT_MODEL` and `'escalation'` → `llm_client.ESCALATION_MODEL`; extend `AnthropicClient` tests — constructing with `primary_model=llm_client.ESCALATION_MODEL` and calling `complete(...)` (no `escalate`) sends that model, while `complete(..., escalate=True)` still sends `llm_client.ESCALATION_MODEL` regardless of `primary_model` (confirm the existing `test_escalation_model_used_when_requested` keeps passing unchanged)
- [X] T011 [P] [US2] Extend `src/main/ipc/ai-settings.test.ts`: `AI_GET_MODEL` returns `'default'` when no `.ai_model` file exists; returns the saved tier when the file holds `'default'` or `'escalation'`; returns `'default'` when the file holds an unrecognized value. `AI_SET_MODEL` writes a valid tier to `.ai_model` with `0o600` permissions (mirroring the existing key-file permission test); given an invalid tier value, does not write the file and the next `AI_GET_MODEL` call still returns the prior (or default) value
- [X] T012 [P] [US2] Extend `src/renderer/components/Settings/AiSettingsPage.test.tsx`: the Model `<select>` renders exactly two options with the labels from `AI_MODEL_OPTIONS`; on mount, it pre-selects whatever `window.api.ai.getModel()` resolves to; changing the selection calls `window.api.ai.setModel(tier)` immediately, with no separate Save button/action involved

### Implementation for User Story 2

- [X] T013 [US2] Edit `src/shared/ipc-types.ts`: add `AI_GET_MODEL`/`AI_SET_MODEL` to `CHANNELS`; add `export type AiModelTier = 'default' | 'escalation';`; add `export const AI_MODEL_OPTIONS: { id: AiModelTier; label: string }[]` per `contracts/ai-model-ipc.md` (`default` → "Fast (default)", `escalation` → "Capable (escalation)"); extend `ElectronAPI['ai']` with `getModel(): Promise<AiModelTier>` and `setModel(tier: AiModelTier): Promise<void>`
- [X] T014 [US2] Edit `src/main/ipc/ai-settings.ts`: add `MODEL_FILENAME = '.ai_model'`; add the `AI_GET_MODEL` handler (read, validate, fall back to `'default'`) and `AI_SET_MODEL` handler (validate tier, write trimmed value with `0o600` permissions, mirroring the existing key-file write) — makes T011 pass
- [X] T015 [US2] Edit `src/main/preload.ts`: wire `ai.getModel`/`ai.setModel` to `CHANNELS.AI_GET_MODEL`/`AI_SET_MODEL`
- [X] T016 [US2] Edit `src/renderer/components/Settings/AiSettingsPage.tsx`: add a "Model" `.settings-card` with a `<select>` populated from `AI_MODEL_OPTIONS`, calling `window.api.ai.getModel()` on mount to set the initial selection and `window.api.ai.setModel(tier)` directly in the `onChange` handler — makes T012 pass
- [X] T017 [P] [US2] Edit `scripts/lib/llm_client.py`: add `MODEL_FILENAME = '.ai_model'`; add `load_model_tier(repo_root: Path) -> str` and `resolve_primary_model(tier: str) -> str`; add a `primary_model: str = DEFAULT_MODEL` parameter to `AnthropicClient.__init__`, store it as `self.primary_model`, and change `_call` to use `ESCALATION_MODEL if escalate else self.primary_model` — makes T010 pass
- [X] T018 [US2] Edit `scripts/ocr_to_markdown.py`: change the `AnthropicClient(api_key=load_api_key(REPO))` construction to pass `primary_model=resolve_primary_model(load_model_tier(REPO))`

**Checkpoint**: Both user stories are independently functional — the AI Settings page holds a working key card and a working model dropdown, and the next pipeline run picks up whichever model tier is selected.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T019 Run the full suite (`npm test` and `pytest`) to confirm no regressions across `src/main`, `src/renderer`, and `tests/unit`
- [ ] T020 [P] Walk through `quickstart.md`'s three scenarios manually in the running app and confirm each matches its expected outcome
- [X] T021 [P] Run `npx tsc --noEmit` and `npx eslint 'src/**/*.{ts,tsx}'` to confirm the new/changed TypeScript is clean

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: None; T001 can happen any time before T014/T017 start writing `.ai_model` in the real repo.
- **Foundational (Phase 2)**: N/A — skipped, nothing to scaffold (see note above).
- **User Story 1 (Phase 3)**: No dependencies beyond Setup. Independently completable and testable on its own (MVP).
- **User Story 2 (Phase 4)**: Depends on User Story 1 — the model dropdown (T016) is added to `AiSettingsPage.tsx`, which US1 creates (T006). Implement after US1's checkpoint.
- **Polish (Phase 5)**: Depends on both user stories being complete.

### Within Each User Story

- Tests (T002–T005 for US1; T010–T012 for US2) MUST be written and observed failing before their corresponding implementation tasks.
- Within US1, T006 (create `AiSettingsPage.tsx` with the moved `ApiKeyCard`) and T007/T008 (edit `CollectionsManagementPage.tsx` to remove it and add the link-back) are two sides of one cut-and-paste move — do them together, not out of order, since T007 removes the exact code T006 relocates.
- Within US2, `src/shared/ipc-types.ts` (T013) must land before `ai-settings.ts` (T014), `preload.ts` (T015), and `AiSettingsPage.tsx`'s model select (T016), since all three import the types/channels T013 defines.
- The Python side (T017–T018) has no dependency on the TypeScript side (T013–T016) or vice versa — different language, different files, same feature.

### Parallel Opportunities

- T002, T003, T004, T005 (US1 tests) touch three different test files and can be written in parallel.
- T010, T011, T012 (US2 tests) touch three different files (one Python, two TypeScript) and can be written in parallel.
- T017 (Python implementation) can run in parallel with T013–T016 (TypeScript implementation) — no shared files, no import dependency between them.
- T020, T021 (Polish) can run in parallel with each other.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup (T001).
2. Complete User Story 1 (T002–T009): AI Settings page exists with a working, relocated key card; Collections links over to it.
3. Validate via quickstart.md's first two sections before expanding scope.

### Incremental Delivery

1. Setup → US1 (MVP: page + relocated key card + Collections link-back) → US2 (model dropdown, wired end-to-end into the Python pipeline) → Polish.
2. Each story's checkpoint is independently demoable per quickstart.md.
