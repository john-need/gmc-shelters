# Feature Specification: History Panel View Toggle

**Feature Branch**: `017-history-panel-toggle`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "on the history tab, add the ability to show and hide source and preview panels. there should be three settings 'source' 'both' and 'preview'"

## Clarifications

### Session 2026-07-07

- Q: Should the History view-mode preference persist only across app restarts and shelter changes, or also when switching away to another tab (e.g. Photos, Sources) and back to History within the same session? → A: Persist across tabs and across selecting shelters — one preference for the whole app session, not reset by any in-app navigation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Focus on writing with Source only (Priority: P1)

An editor working on a shelter's history markdown wants to hide the preview pane so the source editor can use the full width of the tab, reducing distraction and giving more room to write and format text.

**Why this priority**: Writing is the primary activity on this tab; a distraction-free, full-width editor is the most common reason to change the view.

**Independent Test**: Open the History tab, select the "Source" view setting, and confirm only the editable text area is visible and spans the full width of the tab.

**Acceptance Scenarios**:

1. **Given** the History tab is open in "Both" view with unsaved edits, **When** the user selects "Source", **Then** the preview pane is hidden, the source editor expands to full width, and the unsaved content and dirty indicator are unchanged.
2. **Given** the History tab is open in "Source" view, **When** the user types in the editor, **Then** text entry, toolbar formatting actions, and save behave exactly as they do in "Both" view.

---

### User Story 2 - Review formatted output with Preview only (Priority: P2)

An editor wants to review how the history entry will render (headings, lists, links) without the source pane taking up half the screen, especially on smaller windows.

**Why this priority**: Reviewing rendered output is a common secondary task, but less frequent than the act of writing itself.

**Independent Test**: Open the History tab, select the "Preview" view setting, and confirm only the rendered preview is visible and spans the full width of the tab.

**Acceptance Scenarios**:

1. **Given** the History tab is open in "Both" view, **When** the user selects "Preview", **Then** the source editor is hidden, the preview expands to full width, and it continues to reflect the current unsaved content.
2. **Given** the History tab is in "Preview" view, **When** the user edits are pending save, **Then** the dirty/save indicator in the toolbar still reflects unsaved changes even though the editor is hidden.

---

### User Story 3 - Return to the side-by-side Both view (Priority: P3)

An editor who has been writing in "Source" or reviewing in "Preview" wants to go back to seeing both panels at once to compare source and rendered output while editing.

**Why this priority**: This restores today's existing behavior; it's the default and lowest-risk option, needed mainly to round out the three-way toggle.

**Independent Test**: From either "Source" or "Preview" view, select "Both" and confirm the source and preview panels reappear side-by-side, matching current behavior.

**Acceptance Scenarios**:

1. **Given** the History tab is in "Source" or "Preview" view, **When** the user selects "Both", **Then** the source and preview panels are shown side-by-side as they are today, with no loss of unsaved content.

---

### Edge Cases

- Switching view modes while a save is in progress does not interrupt the save, and the resulting saved/dirty state is reported correctly regardless of which panel is visible afterward.
- Switching view modes MUST NOT alter the document content, cursor/selection position (when returning to "Source"), or scroll position of the editor.
- The chosen view mode applies to the History tab generally; switching to another tab and back, navigating between shelters, or restarting the app all keep the last-selected view mode rather than resetting to "Both".
- If the history file is missing (create/browse prompt shown), the view-mode control has no effect since neither panel is rendered yet.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The history markdown content already loaded for the current shelter (unchanged by this feature); the new view-mode preference itself is a local UI setting, not shelter data.
- **Derived Outputs**: None beyond the existing rendered preview HTML already produced from the markdown source.
- **Out-of-Repo Consumers**: None. This is a local editor UI preference with no WordPress, API, or operator-facing effect.

### Contracts & Operations

- **Contract Artifacts**: N/A — no external contract or integration is introduced.
- **Operator Documentation**: N/A — no operator-facing workflow changes.
- **Theme/External Code Boundary**: N/A — the entire feature is contained within this repository's renderer UI.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The History tab MUST provide a visible control letting the user choose one of three view modes: "Source", "Both", or "Preview".
- **FR-002**: The History tab MUST default to "Both" view mode when the user has no prior preference recorded.
- **FR-003**: When "Source" is selected, the system MUST show only the source editor pane, expanded to the full width of the tab, and hide the preview pane.
- **FR-004**: When "Preview" is selected, the system MUST show only the rendered preview pane, expanded to the full width of the tab, and hide the source editor pane.
- **FR-005**: When "Both" is selected, the system MUST show the source and preview panes side-by-side, matching current default behavior.
- **FR-006**: Switching between view modes MUST NOT change the document content, the dirty/save state, or trigger a save or discard of edits.
- **FR-007**: The system MUST remember the user's last-selected view mode and apply it the next time the History tab is viewed, including after switching to another tab and back, after selecting a different shelter, and after restarting the app.
- **FR-008**: The toolbar's save/dirty status indicator MUST remain visible and accurate regardless of which view mode is active.

### Key Entities

- **History View Mode Preference**: The user's currently selected panel visibility setting for the History tab ("source", "both", or "preview"), persisted across sessions independent of any single shelter's history content.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between all three view modes in a single click/selection, with the visible panel(s) updating immediately (no perceptible delay).
- **SC-002**: 100% of view-mode switches preserve unsaved edits and the correct dirty/saved indicator, with zero reported content loss.
- **SC-003**: The last-selected view mode is correctly restored in at least 100% of cases when reopening the History tab or restarting the app.

## Assumptions

- The view mode preference is a single, app-wide setting (not stored per-shelter) — confirmed via clarification — consistent with other persisted UI preferences already stored in this application (e.g., paths and publishing settings).
- "Source" and "Preview" full-width layouts reuse the existing editor and preview rendering as-is; only visibility/layout changes, not their internal behavior.
- This preference persists locally on the user's machine only; it is not part of any shelter's saved history content and has no external/out-of-repo consumers.
