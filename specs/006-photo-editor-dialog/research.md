# Research: Photo Editor Dialog

**Feature**: 006-photo-editor-dialog  
**Date**: 2026-05-26

## Decision 1: Dialog/Overlay CSS Pattern

**Decision**: Extend the existing `.modal-bg` CSS class with a new `.photo-editor-dialog` modifier for the full-screen dialog box (replacing the centered, width-constrained `.modal` box).

**Rationale**: The codebase has two dialog patterns — `NewShelterModal` uses CSS classes (`modal-bg`, `modal`) with backdrop blur and `fade`/`pop` animations; `ReconcileModal` uses inline styles. The CSS-class approach is cleaner and reusable. The new dialog needs to fill the viewport rather than be a small centered box, so a new `.photo-editor-dialog` CSS class alongside the existing `.modal-bg` overlay gives the right result without duplicating animation keyframes. The existing `shelter-photo-modal-backdrop`/`shelter-photo-modal` classes are for a read-only lightbox; they are not reused here to avoid coupling with a different use case.

**Alternatives considered**:
- Inline styles throughout (ReconcileModal pattern) — rejected: verbose, hard to override in tests, inconsistent with NewShelterModal.
- Reuse `.modal.wide` class — rejected: still centers and constrains width; unsuitable for a full-viewport layout.

## Decision 2: Focus Trap Implementation

**Decision**: Implement focus trapping inline inside `PhotoEditorDialog` using a `useEffect` hook that queries all focusable elements inside the dialog `<div>` ref on mount and intercepts Tab/Shift+Tab keydown events to cycle within that set. No external library required.

**Rationale**: No focus-trap utility exists in the codebase. The project has no `focus-trap-react` or similar dependency. The inline approach is lightweight for a single dialog, consistent with the project's minimal-dependency philosophy, and straightforward to test with `@testing-library/react` (fireEvent.keyDown). Return focus is handled via a `ref` capturing the element that had focus before the dialog opened.

**Alternatives considered**:
- `focus-trap-react` npm package — rejected: adds a dependency for functionality easily implemented inline in ~20 lines.
- No focus trap (rely on browser default) — rejected: spec explicitly requires FR-012; tabbing outside the dialog would be a bug.

## Decision 3: Double-Click Detection on Photo Cards

**Decision**: Add an `onDoubleClick` prop to `PhotoCard` and `ListRow` components, passed through from `PhotosTab`. Single-click continues to call `onClick` (select only). Double-click calls a new `onDoubleClick` handler that sets `selectedId` and opens the dialog.

**Rationale**: React's synthetic `onDoubleClick` event is the standard pattern; it fires independently of `onClick` (both fire on double-click — first click selects, second click opens dialog, which is acceptable UX). No custom timer logic is needed.

**Alternatives considered**:
- Using a `setTimeout`-based single vs double-click discriminator — rejected: adds complexity and delays single-click response; unnecessary given that selecting then opening on double-click is acceptable.
- Opening dialog only from right-aside panel — rejected: spec clarification Q2 explicitly adds double-click on grid/list cards as a trigger.

## Decision 4: Escape Key Handling

**Decision**: Attach a `keydown` listener via `useEffect` on `window` inside `PhotoEditorDialog` (matching the `Sidebar.tsx` pattern) for the Escape key. The listener calls the `onCancel` callback.

**Rationale**: The existing `Sidebar.tsx` uses `window.addEventListener('keydown', ...)` with cleanup on unmount. This is the established pattern in this codebase. Attaching at window level ensures the event fires regardless of which element inside the dialog has focus.

**Alternatives considered**:
- `onKeyDown` on the dialog div with `tabIndex={-1}` — rejected: would miss key events when focus is on a child input; window-level is more reliable.

## Decision 5: Component File Location

**Decision**: Create `PhotoEditorDialog.tsx` and `PhotoEditorDialog.test.tsx` alongside `PhotosTab.tsx` in `src/renderer/components/MainPane/tabs/`.

**Rationale**: The dialog is tightly coupled to the Photos tab — it shares photo state, dispatch, and photo URL utilities already imported in `PhotosTab.tsx`. Co-locating it with `PhotosTab` follows the pattern of `ReconcileModal` (defined inline in `PhotosTab.tsx` today) but promotes the dialog to a separate file given its size and test surface.

**Alternatives considered**:
- `src/renderer/components/modals/PhotoEditorDialog.tsx` — considered; the `modals/` directory hosts app-level modals (NewShelterModal). A photo-editing dialog is tab-scoped, not app-scoped, so co-location with the tab is a better fit.
