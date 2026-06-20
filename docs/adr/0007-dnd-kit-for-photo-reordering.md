# ADR 0007 — dnd-kit for Photo Order drag-and-drop

**Date**: 2026-06-19
**Status**: Accepted

## Context

Photo Order (see `CONTEXT.md`) is edited in the Photos tab by dragging photos. The
original implementation used native HTML5 drag-and-drop hand-rolled in
`PhotosTab.tsx`: `draggable` tiles, `onDragStart/Over/Drop/End` handlers, the dragged
tile dimmed to `opacity: 0.5` in place, and the hovered target given an outline. Order
committed only on drop (`reorderPhotosLocal` + `api.photos.reorder`).

We wanted two UX upgrades: a floating clone of the photo following the cursor while
dragging, and live animation of the other photos shifting to reveal the drop position.
Native HTML5 DnD provides neither for free — both require a custom drag image plus
manual FLIP measurement/animation, owned forever, across grid wrap, list, scroll, and
touch.

## Decision

Adopt `@dnd-kit/core` + `@dnd-kit/sortable` for Photo Order in both views:

- `DragOverlay` renders the floating photo clone (the "outline" — clone + accent
  outline/shadow); the source slot becomes a dimmed placeholder.
- `useSortable` transforms animate sibling photos to the prospective order live, without
  mutating the photo list mid-drag.
- Grid uses `rectSortingStrategy` (wrapping rows); list uses
  `verticalListSortingStrategy`.
- Persistence is unchanged: the list is reordered (`arrayMove` active→over) and
  committed via `reorderPhotosLocal` + `api.photos.reorder` only in `onDragEnd`. IPC
  failure still rolls back via `loadPhotos` + toast.

Reorder logic is extracted to a pure function and an `onDragEnd` handler so behavior is
tested at that seam rather than through simulated pointer gestures.

## Alternatives considered

**Hand-roll FLIP on native DnD**: keep the existing native handlers, add a custom
`setDragImage` clone and First-Last-Invert-Play transforms. Rejected: significant
bespoke code and edge cases (grid wrap, scroll, touch) we would maintain indefinitely,
for behavior dnd-kit provides and battle-tests.

## Consequences

- New runtime deps (`@dnd-kit/core`, `@dnd-kit/sortable`, ~30KB).
- dnd-kit's pointer DnD cannot be driven by `fireEvent.drag*` in jsdom. Reorder behavior
  is verified at the pure-logic + `onDragEnd`-handler seam; tests that previously fired
  native drag events were rewritten to call that seam. Full gesture coverage would need
  an e2e/browser harness, which we do not have.
- Keyboard reordering comes free via dnd-kit's `KeyboardSensor` (accessibility bonus).
- Any new Photo Order entry point must go through the same `DndContext`/`onDragEnd`
  seam to preserve the persist-on-drop + rollback invariant.
