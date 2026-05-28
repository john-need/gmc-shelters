# ADR 0005 — Two-phase publish IPC: preflight holds state, confirm consumes it

**Date**: 2026-05-27  
**Status**: Accepted

## Context

The "Publish to web" flow was changed to show a Publish Diff Modal before any Drive upload occurs. Computing the diff requires two expensive operations: building the local manifest (which copies ~1000 photos into `.publish-tmp/`) and fetching the prior Drive manifest over the network. The operator then reviews the diff and may adjust selections before confirming.

This created a design choice about when the build runs and how the result is passed to the upload step.

## Decision

The publish flow is split into two IPC calls:

1. **`publish:preflight`** — runs `buildManifest()`, fetches the prior Drive manifest, computes the diff, and returns a `PublishDiff` to the renderer. Leaves `.publish-tmp/` on disk and holds the preflight result in main-process memory (`preflightResult`).

2. **`publish:toWeb`** — accepts the operator's selections (which uploads/updates/deletes to include), executes Drive operations against the already-built `.publish-tmp/`, and cleans up on completion or error.

A **`publish:cancel`** channel clears `preflightResult` and deletes `.publish-tmp/`.

## Alternatives considered

**Rebuild on confirm**: pre-flight returns only a diff preview with no disk side effects; `publish:toWeb` rebuilds the manifest from scratch before uploading. Rejected because `buildManifest()` copies all photos into `.publish-tmp/` — doing this twice for ~1000 photos wastes meaningful I/O and adds latency after the operator has already waited through the pre-flight.

## Consequences

- Main process holds transient publish state (`preflightResult`, `isPublishing`) between two IPC calls. This is bounded: the state is cleared on confirm, cancel, or error.
- A second click of "Publish to web" while a preflight is in progress is rejected by the existing `isPublishing` guard (extended to cover the preflight phase).
- `.publish-tmp/` must be cleaned up on all exit paths: confirm (success or error) and cancel.
