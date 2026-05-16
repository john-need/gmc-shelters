# Research: GMC Shelters Electron App

**Feature**: 002-electron-app | **Date**: 2026-05-15

---

## 1. SQLite Access in Electron

**Decision**: `better-sqlite3` in the main process; all DB access goes through IPC.

**Rationale**: `better-sqlite3` is synchronous and works correctly in the Electron main process (Node.js). The renderer process never touches SQLite directly — all reads/writes go through `ipcMain.handle` handlers. This preserves `contextIsolation: true` and avoids the serialization complexity of async SQLite drivers in a multi-process architecture.

**Alternatives considered**:
- `node-sqlite3` (async, callback-based) — adds complexity without benefit; synchronous access in the main process is safe and simpler.
- `sql.js` (WASM) — runs in renderer, violating the contextIsolation contract and making every write a full-DB serialization round-trip.

---

## 2. IPC Pattern

**Decision**: `ipcMain.handle` / `ipcRenderer.invoke` (promise-based, two-way) for all data operations. `ipcMain.on` / `ipcRenderer.send` (fire-and-forget) for log-only events.

**Rationale**: `handle`/`invoke` is the current Electron-recommended pattern for request-response IPC. It returns a Promise, integrates naturally with RTK's `createAsyncThunk`, and surfaces errors cleanly in the renderer. All channels are typed in `src/shared/ipc-types.ts` to enforce payload shape at compile time.

**Alternatives considered**:
- Exposing `better-sqlite3` directly via `contextBridge` — rejected; exposes raw DB handle to renderer, breaks the security model.
- REST server running in the main process — over-engineered for a desktop app with a single renderer.

---

## 3. Photo File Access

**Decision**: Main process resolves the repo root at startup (via `app.isPackaged` check: dev uses `process.cwd()`, packaged uses a path relative to `app.getAppPath()`). All file operations on `shelters/<slug>/photos/` use `path.join(repoRoot, 'shelters', slug, 'photos', fileName)`.

**Rationale**: The existing repo layout stores photos at `shelters/<slug>/photos/`. The main process (Node.js) has full filesystem access. Resolving `repoRoot` once at startup avoids hardcoding paths.

**Upload behavior**: On upload, the main process copies the source file to `shelters/<slug>/photos/<original-filename>`. If a file with that name already exists, it appends `_2`, `_3`, etc. to avoid silent overwrites. The photo record is then INSERTed into SQLite.

**Alternatives considered**:
- Storing photos in `app.getPath('userData')` — rejected; photos are repo assets under version control.

---

## 4. History Markdown Files

**Decision**: `shelters/<slug>/history.md` at the repo root. Main process reads/writes via `fs/promises`. On first save for a new shelter, the directory and file are created if absent.

**Rationale**: Existing repo convention already uses this path (confirmed by design file `history.md` references and `historyForShelter()` scaffolding in `data.js`).

**Alternatives considered**:
- Storing history in SQLite — rejected; markdown files are versioned repo assets. SQLite is for structured operational data.

---

## 5. Sources Table

**Decision**: New `sources` table added via `database/migrations/002-add-sources-table.sql`. Migration applied at app startup (main process checks for table existence before applying).

**Rationale**: Sources are structured relational data linked to shelters by `shelter_id`. SQLite is the correct store. A migration file ensures the schema change is versioned and reproducible.

**Schema**: See `data-model.md`.

**Alternatives considered**:
- Storing sources as JSON in a per-shelter file — rejected; loses query capability (filter by type, year, search across fields).

---

## 6. Logging

**Decision**: `electron-log` — writes to console in development, rotating file at `app.getPath('logs')` in production builds.

**Rationale**: `electron-log` is the de facto standard for Electron logging. It auto-detects dev vs. packaged mode, handles log rotation, and requires zero configuration for the baseline behavior we need.

**Alternatives considered**:
- `winston` — overkill for a desktop app; requires manual transport wiring.
- `console.log` only — no file logging in production; makes crash diagnosis impossible.

---

## 7. MUI Theme Mapping

**Decision**: Custom MUI theme defined in `src/renderer/theme/index.ts` using `createTheme`. Design CSS variables map to MUI palette tokens as follows:

| Design var | Value | MUI token |
|---|---|---|
| `--forest` | `#2d4a32` | `palette.primary.main` |
| `--forest-deep` | `#1f3524` | `palette.primary.dark` |
| `--rust` | `#b54d2c` | `palette.secondary.main` |
| `--rust-deep` | `#8e3a1f` | `palette.secondary.dark` |
| `--bg-app` | `#f3ecdb` | `palette.background.default` |
| `--surface` | `#faf4e3` | `palette.background.paper` |
| `--ink-1` | `#1c170d` | `palette.text.primary` |
| `--ink-3` | `#7a6f56` | `palette.text.secondary` |

**Typography**:
- `fontFamily` (body): `"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif`
- `h1`–`h3`: `"Newsreader", "Iowan Old Style", Georgia, serif`
- Mono spans: styled via `sx` prop with `fontFamily: '"JetBrains Mono", "SF Mono", ui-monospace, Menlo, monospace'`

**Note**: The archival design uses many custom CSS classes not directly expressible as MUI component overrides. The approach is: use MUI for structural components (buttons, inputs, modals, typography scale) and supplement with CSS Modules or `sx` props for fine-grained design tokens.

---

## 8. electron-forge + Vite Configuration

**Decision**: `@electron-forge/plugin-vite` with three Vite configs:
- `vite.main.config.ts` — bundles `src/main/index.ts` targeting Node.js
- `vite.preload.config.ts` — bundles `src/main/preload.ts` targeting Node.js (sandbox-off for contextBridge)
- `vite.renderer.config.ts` — bundles `src/renderer/index.tsx` targeting browser with `@vitejs/plugin-react`

**Rationale**: electron-forge's Vite plugin handles the dev-server-to-Electron wiring automatically, including the `MAIN_WINDOW_VITE_DEV_SERVER_URL` env var that the main process uses to load the renderer in development.

---

## 9. Jest Configuration

**Decision**: Single `jest.config.ts` with two projects:
```ts
projects: [
  { displayName: 'main', testEnvironment: 'node', testMatch: ['<rootDir>/src/main/**/*.test.ts'] },
  { displayName: 'renderer', testEnvironment: 'jsdom', testMatch: ['<rootDir>/src/renderer/**/*.test.tsx'] },
]
```

**Rationale**: Main-process tests need Node.js APIs (fs, path, better-sqlite3 mocks); renderer tests need a DOM. Splitting by directory matches the source layout and avoids environment mismatches.

**Note**: `better-sqlite3` must be mocked in main-process tests (`jest.mock('better-sqlite3')`); it cannot run in Jest's Node environment without the native binary built for the test runner's architecture.

---

## 10. Single-Instance Lock

**Decision**: `app.requestSingleInstanceLock()` in `src/main/index.ts`. If lock not acquired, call `app.quit()`. On `second-instance` event, restore and focus the existing `BrowserWindow`.

**Rationale**: Standard Electron pattern; prevents duplicate windows from competing for SQLite writes.
