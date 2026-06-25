# Internal IPC Contract: `shelters:update` (`CHANNELS.SHELTERS_UPDATE`)

Internal contract between the renderer (preload bridge) and the Electron main process. No out-of-repo consumer.

## Before this feature

```ts
// preload.ts
update: (shelter: Shelter) => Promise<Shelter>
// invokes ipcRenderer.invoke(CHANNELS.SHELTERS_UPDATE, shelter)

// ipc/shelters.ts handler
ipcMain.handle(CHANNELS.SHELTERS_UPDATE, (_e, shelter: Shelter) => {
  const updated = updateShelter(shelter); // DB only — no filesystem effect
  syncMarkersFromShelter(updated);
  return updated;
});
```

## After this feature

```ts
// preload.ts
update: (shelter: Shelter, sheltersRoot: string) => Promise<Shelter>
// invokes ipcRenderer.invoke(CHANNELS.SHELTERS_UPDATE, { shelter, sheltersRoot })

// ipc/shelters.ts handler
ipcMain.handle(
  CHANNELS.SHELTERS_UPDATE,
  async (_e, { shelter, sheltersRoot }: { shelter: Shelter; sheltersRoot: string }) => {
    const before = getShelterById(shelter.id);
    const oldSlug = before?.slug;

    const updated = updateShelter(shelter); // sanitizes slug, rejects empty/duplicate,
                                             // patches photos.file_name + shelters.history in one transaction

    if (oldSlug && updated.slug !== oldSlug) {
      try {
        await renameShelterDir(oldSlug, updated.slug, sheltersRoot);
      } catch (err) {
        updateShelter({ ...updated, slug: oldSlug }); // roll back DB-side rename
        throw err;
      }
    }

    syncMarkersFromShelter(updated);
    return updated;
  },
);
```

### Request payload change

| Field | Before | After |
|---|---|---|
| Payload shape | `Shelter` (bare object) | `{ shelter: Shelter; sheltersRoot: string }` |

This mirrors the existing `SHELTERS_DELETE` payload shape (`{ id, slug, sheltersRoot }`), which already plumbs `sheltersRoot` through for filesystem operations.

### Response

Unchanged: resolves with the updated `Shelter` (now reflecting the sanitized slug if it changed).

### Error cases (all reject the returned Promise with a plain `Error`, propagated to the renderer)

| Condition | Message thrown |
|---|---|
| Sanitized slug is empty | `Slug cannot be empty after removing invalid characters` |
| Sanitized slug collides with another shelter's slug | `Slug "<value>" is already in use` |
| Target folder already exists on disk (untracked) | `A folder named "<newSlug>" already exists` |
| Disk rename fails for any other reason (e.g., permissions) | Original `fs.rename` error, after DB rollback completes |

### Renderer caller change

`src/renderer/store/sheltersSlice.ts`'s `saveShelter` thunk now calls `window.api.shelters.update(shelter, loadStoredPaths().SHELTERS_ROOT)` — same `loadStoredPaths()` helper already used by the `loadHistory`/`saveHistory` thunks. A rejected thunk (`saveShelter.rejected`) carries the thrown error's message, which `ShelterTab.tsx`'s `handleSave` surfaces via the existing `showToast` action instead of silently swallowing it.
