# Quickstart: GMC Shelters Electron App

**Feature**: 002-electron-app | **Date**: 2026-05-15  
**Audience**: Developers setting up the app for the first time; operators running or packaging the app.

---

## Prerequisites

- Node.js 22.x LTS (`node --version` → `v22.x.x`)
- npm 10.x (`npm --version`)
- The existing `database/gmc_shelters.sqlite` at the repo root (contains shelters and photos tables)
- Shelter photo directories at `shelters/<slug>/photos/` (can be empty for development)

---

## First-Time Setup

```bash
# From the repo root
npm install
```

This installs all Electron, React, MUI, Jest, and ESLint dependencies declared in `package.json`.

> **Note**: `better-sqlite3` requires a native build step. If `npm install` fails with a node-gyp error, ensure Xcode Command Line Tools are installed (`xcode-select --install`) on macOS, or the appropriate build tools on Windows/Linux.

---

## Running in Development

```bash
npm start
```

This runs `electron-forge start`, which:
1. Starts the Vite dev server for the renderer (with HMR)
2. Compiles the main process and preload via Vite
3. Launches the Electron window pointed at the dev server

The app opens automatically. File changes in `src/renderer/` trigger HMR; changes in `src/main/` require a restart (`Ctrl+C` then `npm start`).

---

## Running Tests

```bash
npm test
```

Runs Jest across both project environments:
- `main` (node): IPC handlers, DB access layer, filesystem utilities
- `renderer` (jsdom): React components, RTK slices, Chicago citation formatter

To run a specific environment:

```bash
npm test -- --selectProjects main
npm test -- --selectProjects renderer
```

To run in watch mode:

```bash
npm test -- --watch
```

---

## Linting

```bash
npm run lint
```

Lints all `src/**/*.ts` and `src/**/*.tsx` files using ESLint with TypeScript and React rules. Fix auto-fixable issues:

```bash
npm run lint -- --fix
```

---

## Building for Distribution

```bash
npm run make
```

Runs `electron-forge make`, producing platform-specific distributables in `out/make/`:

| Platform | Output |
|---|---|
| macOS | `.dmg` (default maker) |
| Windows | `.zip` / NSIS installer |
| Linux | `.deb` / `.rpm` |

Cross-compilation is not supported — build on each target OS for that platform's artifact.

---

## Database Migration

The app applies `database/migrations/002-add-sources-table.sql` automatically at startup if the `sources` table does not exist. No manual migration step is needed.

To inspect the database manually:

```bash
sqlite3 database/gmc_shelters.sqlite
.tables
.schema sources
```

---

## Log Files

**Development**: Logs print to stdout in the terminal where `npm start` was run.

**Production (packaged app)**:
- macOS: `~/Library/Logs/gmc-shelters/main.log`
- Windows: `%USERPROFILE%\AppData\Roaming\gmc-shelters\logs\main.log`
- Linux: `~/.config/gmc-shelters/logs/main.log`

Log rotation: files are rotated at 10 MB, keeping the last 5 rotations.

---

## Filesystem Layout (data assets)

The app reads and writes the following paths relative to the repo root:

```
database/
└── gmc_shelters.sqlite     ← operational store (shelters, photos, sources)

shelters/
└── <slug>/
    ├── history.md           ← per-shelter narrative (History tab)
    └── photos/
        └── *.jpg / *.png   ← shelter photographs (Photos tab)
```

> **Important**: These directories are part of the repository. Photo uploads via the app copy files into `shelters/<slug>/photos/`. Do not delete or reorganize these directories while the app is running.

---

## Stub Features (not yet implemented)

The following header buttons are present in the UI but are stubs in this feature:

- **Export**: Shows a toast "Export not yet implemented."
- **Publish to web**: Shows a toast "Publish to web not yet implemented." The integration with the existing Python publish workflow is a separate feature.

---

## Troubleshooting

**App won't start — "Cannot find module 'better-sqlite3'"**  
Run `npm run rebuild` to rebuild native modules against the current Electron version:
```bash
npx electron-rebuild
```

**SQLite "no such table: sources"**  
Should not happen — the migration runs at startup. If it does, run:
```bash
sqlite3 database/gmc_shelters.sqlite < database/migrations/002-add-sources-table.sql
```

**Photos not showing**  
Photos are loaded from `shelters/<slug>/photos/` relative to the repo root. Confirm the directory exists and contains files. The app displays gradient placeholder cards when no image file is found.

**Window doesn't open**  
Check the terminal output for errors. Common causes: port conflict on the Vite dev server (default 5173), or `database/gmc_shelters.sqlite` not found at the repo root.

---

## Testing the Main Process Without a Live Electron Binary

Main-process Jest tests (`src/main/**/*.test.ts`) use a manual mock for the `electron` module. This
allows IPC handlers, window creation logic, and the logger to be tested without launching a real
Electron binary.

**How it works:**

- `jest.config.ts` maps `^electron$` → `src/main/__mocks__/electron.ts` for the `main` project.
- The mock exports `app`, `BrowserWindow`, `ipcMain`, `ipcRenderer`, `contextBridge`, `Menu`, and
  `shell` as jest functions. All async methods return `Promise.resolve(undefined)` by default.

**Overriding `app.isPackaged` per test:**

```typescript
const { app } = await import('electron');
Object.defineProperty(app, 'isPackaged', { value: true, configurable: true });
```

Reset it after each test with `jest.resetModules()` and `jest.clearAllMocks()`.

**Running main-process tests only:**

```bash
npm test -- --selectProjects main
```

**Running renderer tests only:**

```bash
npm test -- --selectProjects renderer
```

---

## Manual Verification Checklist (run after `npm install`)

Complete these steps after first-time setup and after significant changes:

- [ ] `npm start` → desktop window opens within 5 seconds; title bar shows "gmc-shelters"
- [ ] Edit a file in `src/renderer/` → change appears in the running app without a full restart (HMR)
- [ ] Open a second terminal and run `npm start` again → second process exits immediately; original window gains focus
- [ ] Close the main window → terminal process exits cleanly with code 0 (no hang, no error)
- [ ] `npm test` → both `main` and `renderer` projects report green (0 failures)
- [ ] `npm run lint` → exits with code 0 and reports 0 problems

---

## Cross-Platform Distribution

macOS, Windows, and Linux builds require running `npm run make` on the target OS (cross-compilation
is not supported). Expected output paths:

| Platform | Command | Artifact |
|---|---|---|
| macOS | `npm run make` | `out/make/*.dmg` |
| Windows | `npm run make` | `out/make/zip/win32/*.zip` |
| Linux | `npm run make` | `out/make/zip/linux/*.zip` |

Before distributing, replace `assets/icon.png` (and `assets/icon.icns` / `assets/icon.ico` for
macOS and Windows respectively) with a real application icon at 1024×1024 pixels.
