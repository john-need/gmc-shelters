# ADR 0006 — Unsaved-changes navigation guard via a renderer context, not a Redux state machine

**Date**: 2026-06-19
**Status**: Accepted

## Context

The Shelter editor holds edits in `state.shelters.editBuffer` with a `dirty` flag (and the History tab tracks its own `historyDirty`). Several actions navigate away from the currently edited Shelter and silently discard those edits:

- Clicking a different Shelter row in the Sidebar (`setSelectedId`).
- Up/Down arrow-key navigation between Shelters (also `setSelectedId`).
- Creating a new Shelter from the New Shelter modal.

`setSelectedId` blindly resets `dirty = false` and replaces `editBuffer`, so unsaved work is lost with no warning. We want to intercept these navigations, prompt the operator to **Save**, **Discard**, or **Cancel**, take the chosen action, then proceed (or abort) the navigation.

The navigation targets are heterogeneous: two of them swap `editBuffer` via a Redux dispatch, while "new Shelter" opens a modal whose visibility is React component state in `ShelterBrowser`. The guard must also handle an async Save that may fail.

## Decision

The guard lives in the renderer as a React context provider (`NavigationGuardProvider`) exposing a `useGuardedNav()` hook. Every navigation point wraps its action as a closure:

```ts
guardedNav(() => dispatch(setSelectedId(id)));
guardedNav(() => setShowNewModal(true));
```

`guardedNav(fn)` reads `dirty`/`historyDirty` from the store. If neither is set it runs `fn` immediately. Otherwise it stashes `fn` and shows the guard modal. The modal's actions resolve the stashed closure:

- **Save** — dispatches `saveShelter` (when `dirty`) and `saveHistory` (when `historyDirty`); runs the closure only after all succeed. Any failure aborts: the closure is dropped and the operator stays on the current Shelter.
- **Discard** — clears the dirty flags and runs the closure.
- **Cancel** — drops the closure; nothing navigates.

## Alternatives considered

**Redux state machine**: add `pendingNav` to the shelters slice and replace `setSelectedId` calls with a `requestSelectShelter` thunk that checks `dirty` and either navigates or raises the guard. Rejected because the navigation targets do not serialize uniformly — "open the New Shelter modal" is React component state, not a Redux-addressable destination — so the slice would need to enumerate and reach back into component state. Closures capture each heterogeneous target without that coupling, and keep all guard logic in one place.

## Consequences

- Navigation that can discard Shelter edits must go through `guardedNav`; a new navigation path that bypasses it silently loses data. This is the one invariant to preserve when adding navigation.
- The guard couples to both dirty flags (`dirty`, `historyDirty`). A future third dirty source must be added to the guard's check and its Save path.
- The pending action is a closure held in React state, so it is not visible in the Redux devtools timeline — intentional, given the alternative's coupling cost.
