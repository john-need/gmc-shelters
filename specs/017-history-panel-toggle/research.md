# Research: History Panel View Toggle

No items in Technical Context were marked `NEEDS CLARIFICATION` — this feature is a small, self-contained renderer UI change with direct precedent elsewhere in the codebase. The decisions below record why the existing patterns were reused as-is rather than introducing anything new.

## Decision: Persist the view mode via a `localStorage`-backed settings module

**Decision**: Add `src/renderer/historyViewSettings.ts`, a small module exposing `DEFAULT_HISTORY_VIEW`, a `HistoryViewMode` type (`'source' | 'both' | 'preview'`), `normalizeHistoryViewMode()`, `loadHistoryViewMode()`, and `saveHistoryViewMode()`, reading/writing `localStorage` key `gmc.historyView`.

**Rationale**: This repo already has two modules with the exact same shape — `pathSettings.ts` (`gmc.paths`) and `publishSettings.ts` (`gmc.publishing`) — each with a default value, a `normalize*` function that falls back safely on missing/invalid data, and a `load*`/`save*` pair wrapped in `try/catch`. Reusing this pattern means the preference persists across tab switches, shelter selection, and app restarts for free (per the clarification in spec.md), with no Redux slice, IPC channel, or main-process involvement required.

**Alternatives considered**:
- **Redux slice + IPC-backed file** (like `.ai_model` in `specs/015-ai-settings-page`): rejected — that pattern exists because the AI model tier needs to be read from Python (`scripts/lib/llm_client.py`). This preference has no cross-process or cross-language consumer, so a file round-tripped through IPC would be unjustified complexity.
- **Component-local `useState` only (no persistence)**: rejected — fails FR-007 and the explicit clarification that the mode must survive tab switches, shelter changes, and restarts.
- **Persist per-shelter (e.g., on the `Shelter` record)**: rejected — the clarification session confirmed this is a single app-wide preference, not shelter data, so it does not belong in the SQLite-backed shelter model.

## Decision: Conditionally render panes; switch `.md-split` to a single-column grid via a modifier class

**Decision**: Keep the existing `.md-pane` markup and `renderMarkdown()` logic untouched. In `HistoryTab.tsx`, conditionally render the source `.md-pane` when mode is `'source'` or `'both'`, and the preview `.md-pane` when mode is `'preview'` or `'both'`. Add `.md-split.mode-source` / `.md-split.mode-preview` CSS rules setting `grid-template-columns: 1fr` (the default two-column `1fr 1fr` covers `'both'`).

**Rationale**: `.md-split` is already a CSS grid with exactly two children; not rendering the hidden pane (rather than hiding it with `display: none`) avoids paying for an editor/preview that isn't visible and avoids the `.md-pane + .md-pane` border-left rule applying when only one pane exists. This is the smallest diff that reuses 100% of existing pane content and styling.

**Alternatives considered**:
- **CSS-only hide/show (`display: none`) keeping both panes mounted**: rejected — no behavioral difference for the user, but keeps an idle textarea/preview mounted for no benefit; conditional rendering is equally simple in React and slightly cheaper.
- **A new dedicated single-pane component**: rejected — would duplicate the toolbar/pane-head markup already in `HistoryTab.tsx` for no reuse benefit.

## Decision: Toggle control is a 3-button group in the existing `.md-toolbar`, styled like `.md-tool.active`

**Decision**: Add a small group of three labeled buttons ("Source", "Both", "Preview") in `.md-toolbar`, using `role="group"` with `aria-pressed` per button, styled with a new minimal `.md-view-toggle`/`.md-view-btn` CSS pair that reuses the existing `--selected`/`--forest-deep` tokens already used by `.md-tool.active`.

**Rationale**: `.md-toolbar` already hosts icon buttons with an `.active` state convention (`.md-tool.active`); a labeled 3-way group in the same bar is consistent with the existing toolbar's visual language and requires no new component library or dependency.

**Alternatives considered**:
- **`<select>` dropdown**: rejected — three mutually exclusive, always-visible options are better served by a segmented control than a dropdown that hides the current state's siblings; a dropdown is also slower to operate for a setting used frequently while writing.
