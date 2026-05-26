# Data Model: Photos Tab Reconcile

**Feature**: `005-photos-reconcile`  
**Date**: 2026-05-26

## Database Schema Changes

**None.** The `photos` table and `shelters` table already contain all columns needed:
- `photos.file_name` — used for filesystem comparison
- `photos.shelter_id` — used to scope the query to the current shelter
- `shelters.default_photo_id` — cleared when the default photo's orphaned record is deleted

No migrations are required.

---

## New IPC Channel Constants

Added to `src/shared/ipc-types.ts` under the `CHANNELS` object:

```typescript
PHOTOS_RECONCILE_SCAN: 'photos:reconcileScan',
PHOTOS_RECONCILE_APPLY: 'photos:reconcileApply',
```

---

## New Types

### `UntrackedFile`

Represents an image file on disk with no corresponding database record for this shelter.

```typescript
export interface UntrackedFile {
  fileName: string;   // bare filename, e.g. "IMG_1234.jpg"
}
```

### `OrphanedRecord`

Represents a `photos` table row whose referenced file does not exist on disk.

```typescript
export interface OrphanedRecord {
  id: number;         // photos.id
  fileName: string;   // normalised bare filename from photos.file_name
  title: string;      // photos.title (for display in the modal)
}
```

### `ReconcileScanResult`

Returned by `PHOTOS_RECONCILE_SCAN`. Both arrays may be empty (clean shelter).

```typescript
export interface ReconcileScanResult {
  untrackedFiles: UntrackedFile[];
  orphanedRecords: OrphanedRecord[];
}
```

### `ReconcileApplyInput`

Sent by the renderer to `PHOTOS_RECONCILE_APPLY`. Contains the operator's selections.

```typescript
export interface ReconcileApplyInput {
  shelterId: number;
  sheltersRoot: string;
  filesToAdd: string[];       // bare filenames selected from untrackedFiles
  recordIdsToDelete: number[]; // photo IDs selected from orphanedRecords
}
```

### `ReconcileItemOutcome`

Per-item result included in `ReconcileApplyResult.failures`.

```typescript
export interface ReconcileItemOutcome {
  item: string;   // filename (for additions) or "id:<n>" (for deletions)
  reason: string; // brief human-readable error message
}
```

### `ReconcileApplyResult`

Returned by `PHOTOS_RECONCILE_APPLY`. Never throws — always returns a summary.

```typescript
export interface ReconcileApplyResult {
  added: number;
  deleted: number;
  failed: number;
  failures: ReconcileItemOutcome[];
}
```

---

## `ElectronAPI` Extension

Added to the `photos` namespace in `ElectronAPI`:

```typescript
photos: {
  // ... existing methods ...
  reconcileScan: (shelterId: number, sheltersRoot: string) => Promise<ReconcileScanResult>;
  reconcileApply: (input: ReconcileApplyInput) => Promise<ReconcileApplyResult>;
}
```

---

## Preload Bridge

Two new entries added to `src/main/preload.ts` (or equivalent preload file) under the `photos` namespace, forwarding to `ipcRenderer.invoke(CHANNELS.PHOTOS_RECONCILE_SCAN, ...)` and `ipcRenderer.invoke(CHANNELS.PHOTOS_RECONCILE_APPLY, ...)`.
