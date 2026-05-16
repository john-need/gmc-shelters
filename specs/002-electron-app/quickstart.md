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
