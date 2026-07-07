# Implementation Plan: History Panel View Toggle

**Branch**: `017-history-panel-toggle` | **Date**: 2026-07-07 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/017-history-panel-toggle/spec.md`

## Summary

Add a three-way view-mode toggle ("Source" / "Both" / "Preview") to the History tab's toolbar. Selecting a mode conditionally renders one or both of the existing `.md-pane` panels (source textarea, rendered preview) inside `.md-split`, switching its grid to a single column when only one pane is shown. The chosen mode is persisted in `localStorage` (mirroring the existing `gmc.paths`/`gmc.publishing` pattern in `pathSettings.ts`/`publishSettings.ts`) so it survives tab switches, shelter changes, and app restarts, per the clarification recorded in spec.md. No Redux, IPC, or database changes are needed — this is a pure renderer UI preference with no content or save-state impact.

## Technical Context

**Language/Version**: TypeScript (Electron 32 renderer), React 18
**Primary Dependencies**: None new. Reuses existing React/Redux renderer stack and the `localStorage` settings-file pattern already established by `pathSettings.ts` and `publishSettings.ts`.
**Storage**: `localStorage` key `gmc.historyView` (new), holding one of `'source' | 'both' | 'preview'`. No SQLite involvement — this is a local UI preference, not shelter data.
**Testing**: Jest + React Testing Library (`src/renderer/**/*.test.ts(x)`, jsdom env). TDD — failing tests planned first:
  - `src/renderer/historyViewSettings.test.ts` (NEW) — defaults to `'both'` when nothing stored; normalizes invalid/missing localStorage values back to `'both'`; round-trips a saved value through `loadHistoryViewMode()`/`saveHistoryViewMode()`
  - `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx` (extend) — toggle control renders with three options and correct `aria-pressed` state; selecting "Source" hides the preview pane and expands the source pane to full width; selecting "Preview" hides the source pane; selecting "Both" restores the two-pane layout; switching modes does not change `historyContent`/dirty state; the last-selected mode is read from `localStorage` on mount (persistence across tab/shelter navigation and restart)
**Target Platform**: Electron desktop app (macOS primary), renderer process only.
**Project Type**: Hybrid Electron app + Python conversion-pipeline scripts (established by `specs/013`–`specs/016`); this feature touches only the Electron renderer side, no Python involvement.
**Performance Goals**: Instant (single synchronous state update + re-render); no perceptible delay per SC-001.
**Constraints**: Switching view modes MUST NOT alter document content, dirty/save state, or trigger save/discard (FR-006). No new npm dependency.
**Scale/Scope**: Touches `src/renderer/historyViewSettings.ts` (new), `src/renderer/components/MainPane/tabs/HistoryTab.tsx`, `src/renderer/components/MainPane/tabs/HistoryTab.test.tsx`, `src/renderer/index.css`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Source of truth identified** (Principle I): The `localStorage` key `gmc.historyView` is the sole canonical input for this preference, named explicitly in spec.md and data-model.md. No remote system is involved.
- [x] **Test-first scope identified** (Principle II): Failing tests planned first for `historyViewSettings.ts` (new unit) and `HistoryTab.tsx` (extended component tests), matching this repo's existing per-module Jest pairing (same convention as `specs/015-ai-settings-page`).
- [x] **External contract coverage** (Principle III): N/A — no out-of-repo consumer, API, CLI, or export is introduced or changed; this is a local renderer UI preference only.
- [x] **Idempotency and auditability** (Principle IV): N/A — not an import/sync workflow. Setting the same view mode twice is a no-op overwrite of an identical string in `localStorage`.
- [x] **Minimal-change fit** (Principle V): All changes stay within `src/renderer/` (component, its test, one new small settings module, and shared CSS), the same tree `specs/015-ai-settings-page` and `specs/016-cleanup-quote` already touch. No new top-level directory, dependency, or storage mechanism.
- [x] **WordPress/theme boundary respected** (Principle V/III): N/A — no theme or WordPress surface touched.

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/017-history-panel-toggle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

No `contracts/` directory — this feature has no external or cross-process interface (pure renderer UI preference), matching spec.md's "Contract Artifacts: N/A".

### Source Code (repository root)

```text
src/renderer/
├── historyViewSettings.ts              # NEW: DEFAULT_HISTORY_VIEW = 'both'; HistoryViewMode type;
│                                        #   normalizeHistoryViewMode(); loadHistoryViewMode()/
│                                        #   saveHistoryViewMode() using localStorage key 'gmc.historyView'
│                                        #   — mirrors pathSettings.ts/publishSettings.ts exactly
├── historyViewSettings.test.ts         # TDD: NEW — failing tests first (default, normalization,
│                                        #   round-trip through load/save)
├── index.css                           # extend: `.md-split.mode-source`/`.md-split.mode-preview`
│                                        #   (grid-template-columns: 1fr); small `.md-view-toggle`/
│                                        #   `.md-view-btn` styles for the 3-way control, reusing
│                                        #   existing `--selected`/`--forest-deep` tokens (same
│                                        #   convention as `.md-tool.active`)
└── components/MainPane/tabs/
    ├── HistoryTab.tsx                  # extend: view-mode state (init from
    │                                    #   loadHistoryViewMode()), 3-button toggle group in
    │                                    #   `.md-toolbar`, conditional rendering of the source/
    │                                    #   preview `.md-pane` elements, saveHistoryViewMode() on change
    └── HistoryTab.test.tsx             # TDD: extend — toggle rendering/aria-pressed, pane
                                         #   visibility per mode, content/dirty state untouched,
                                         #   persistence across remount
```

**Structure Decision**: All changes stay within `src/renderer/` — one new small settings module (following the exact pattern of `pathSettings.ts`/`publishSettings.ts`), one extended component and its test, and a CSS extension. No `database/`, `scripts/`, or top-level directory is touched; no `contracts/` artifact is needed since nothing outside this repository's renderer consumes this preference.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
