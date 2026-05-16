# IPC Contract: GMC Shelters Electron App

**Feature**: 002-electron-app | **Date**: 2026-05-15

The IPC bridge is the only external interface in this feature. It is defined in `src/shared/ipc-types.ts` and enforced at compile time via TypeScript. All channels use `ipcMain.handle` / `ipcRenderer.invoke` (promise-based, two-way).

---

## Channel Registry

All channels are string constants exported from `src/shared/ipc-types.ts`.

### Shelters

| Channel | Direction | Payload (invoke arg) | Return |
|---|---|---|---|
| `shelters:getAll` | renderer → main | `void` | `Shelter[]` |
| `shelters:getById` | renderer → main | `{ id: number }` | `Shelter \| null` |
| `shelters:create` | renderer → main | `ShelterCreateInput` | `Shelter` |
| `shelters:update` | renderer → main | `Shelter` | `Shelter` |
| `shelters:delete` | renderer → main | `{ id: number }` | `void` |

**ShelterCreateInput**:
```typescript
interface ShelterCreateInput {
  name: string;
  start_year: number;
  category: string;
  is_gmc: boolean;
}
```
Slug, created, updated, and defaults are computed by the main process.

**shelters:update** behavior: Updates all writable fields; sets `updated = date('now')`. Returns the updated record (re-read from DB).

**shelters:delete** behavior: Deletes DB row. Does NOT delete the `shelters/<slug>/` directory (operator action, outside app scope).

---

### Photos

| Channel | Direction | Payload | Return |
|---|---|---|---|
| `photos:getByShelter` | renderer → main | `{ shelterId: number }` | `Photo[]` |
| `photos:update` | renderer → main | `PhotoUpdateInput` | `Photo` |
| `photos:delete` | renderer → main | `{ id: number }` | `void` |
| `photos:setDefault` | renderer → main | `{ shelterId: number; photoId: number }` | `void` |
| `photos:upload` | renderer → main | `PhotoUploadInput` | `Photo` |

**PhotoUpdateInput**: All `Photo` fields except `id`, `shelter_id`, `created`, `file_name`, `file_path`.

**PhotoUploadInput**:
```typescript
interface PhotoUploadInput {
  shelterId: number;
  sourcePath: string;      // absolute path on disk (from dialog or drop)
  title?: string;
}
```
Main process: copies file to `shelters/<slug>/photos/`, INSERTs row, returns new `Photo`.

**photos:delete** behavior: Deletes DB row first. Attempts file delete; logs error on failure (does not re-insert the DB row).

---

### History

| Channel | Direction | Payload | Return |
|---|---|---|---|
| `history:read` | renderer → main | `{ slug: string }` | `string` (markdown) |
| `history:write` | renderer → main | `{ slug: string; content: string }` | `void` |

**history:read**: Returns file content, or a starter template if the file does not exist (file is NOT created on read).

**history:write**: Creates parent directory if absent; writes atomically via temp-file-then-rename.

---

### Sources

| Channel | Direction | Payload | Return |
|---|---|---|---|
| `sources:getByShelter` | renderer → main | `{ shelterId: number }` | `Source[]` |
| `sources:create` | renderer → main | `SourceInput` | `Source` |
| `sources:update` | renderer → main | `Source` | `Source` |
| `sources:delete` | renderer → main | `{ id: number }` | `void` |

**SourceInput**: All `Source` fields except `id`, `shelter_id`, `created`, `updated`. `shelter_id` is passed separately in the wrapping call context (not in SourceInput to avoid renderer forgery of shelter association — the main process resolves it from the selected shelter).

Actually: `shelter_id` IS included in `SourceInput` (the renderer knows the selected shelter ID; no security boundary is at risk in a local desktop app).

```typescript
interface SourceInput extends Omit<Source, 'id' | 'created' | 'updated'> {}
```

---

### Shell

| Channel | Direction | Payload | Return |
|---|---|---|---|
| `shell:openExternal` | renderer → main | `{ url: string }` | `void` |

Main process validates URL scheme (`https://` or `http://` only) before calling `shell.openExternal`. Rejects others silently with a log warning.

---

### App

| Channel | Direction | Payload | Return |
|---|---|---|---|
| `app:getVersion` | renderer → main | `void` | `string` |
| `app:getRepoRoot` | renderer → main | `void` | `string` (absolute path) |

`app:getRepoRoot` is used by the renderer to display filesystem paths in the Shelter tab's System section.

---

## contextBridge API Shape

Exposed on `window.api` via `src/main/preload.ts`:

```typescript
interface ElectronAPI {
  shelters: {
    getAll: () => Promise<Shelter[]>;
    getById: (id: number) => Promise<Shelter | null>;
    create: (input: ShelterCreateInput) => Promise<Shelter>;
    update: (shelter: Shelter) => Promise<Shelter>;
    delete: (id: number) => Promise<void>;
  };
  photos: {
    getByShelter: (shelterId: number) => Promise<Photo[]>;
    update: (input: PhotoUpdateInput) => Promise<Photo>;
    delete: (id: number) => Promise<void>;
    setDefault: (shelterId: number, photoId: number) => Promise<void>;
    upload: (input: PhotoUploadInput) => Promise<Photo>;
  };
  history: {
    read: (slug: string) => Promise<string>;
    write: (slug: string, content: string) => Promise<void>;
  };
  sources: {
    getByShelter: (shelterId: number) => Promise<Source[]>;
    create: (input: SourceInput) => Promise<Source>;
    update: (source: Source) => Promise<Source>;
    delete: (id: number) => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    getRepoRoot: () => Promise<string>;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
```

---

## Error Handling Contract

All `ipcMain.handle` callbacks MUST catch errors and rethrow with a structured message. The renderer receives the error as a rejected Promise. RTK `createAsyncThunk` surfaces this in `rejected` action payloads.

```typescript
// main process pattern:
ipcMain.handle('shelters:update', async (_event, shelter: Shelter) => {
  try {
    return db.updateShelter(shelter);
  } catch (err) {
    log.error('shelters:update failed', err);
    throw new Error(`Failed to update shelter ${shelter.id}: ${(err as Error).message}`);
  }
});
```

The renderer MUST display a toast notification on any IPC rejection. The message shown to the user is the `Error.message` from the rejected promise.

---

## Type File Location

```
src/shared/ipc-types.ts    — channel name constants, Shelter, Photo, Source, SourceInput,
                              ShelterCreateInput, PhotoUpdateInput, PhotoUploadInput,
                              ElectronAPI, and the Window augmentation
```

This file is imported by both `src/main/` and `src/renderer/` — it is the single source of truth for the IPC contract.
