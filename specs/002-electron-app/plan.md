# Implementation Plan: GMC Shelters Electron Desktop App

**Branch**: `002-electron-app` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/002-electron-app/spec.md` + Claude Design bundle (`GMC Shelters App.html`)

## Summary

Build a full-featured Electron desktop application for managing GMC shelter records. The app reads and writes the existing SQLite database (`database/gmc_shelters.sqlite`) and the local filesystem (shelter photo directories, `history.md` files per shelter). The UI follows an "archival field-guide" aesthetic (warm parchment + forest green + rust accents, Newsreader serif / Geist UI / JetBrains Mono typography) and provides: a collapsible sidebar with search and advanced filters; a main record area with four tabs (Shelter, History, Sources, Photos); and header actions for creating new shelters, exporting, and publishing to the web.

The design files (Claude Design bundle) supersede the spec's placeholder "splash screen as home" decision — the app launches directly into the shelter browser with the first record selected.

---

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22.x LTS  
**Primary Dependencies**:
- `electron` — desktop window host
- `electron-forge` + `@electron-forge/plugin-vite` — dev server, packaging, distribution
- `vite` + `@vitejs/plugin-react` — renderer bundler, HMR
- `react` 18, `react-dom` — UI rendering
- `@reduxjs/toolkit`, `react-redux` — state management (RTK slices + `createAsyncThunk`)
- `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled` — component library
- `react-router-dom` v6 — client-side routing
- `better-sqlite3` + `@types/better-sqlite3` — synchronous SQLite access in main process
- `electron-log` — structured logging (stdout dev, rotating file prod)
- `jest`, `@types/jest`, `ts-jest` — test runner (split node/jsdom environments)
- `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks` — linting

**Storage**:
- `database/gmc_shelters.sqlite` — existing SQLite DB (shelters, photos tables; new `sources` table via migration)
- `shelters/<slug>/` — shelter photo directories (JPEG/PNG/TIFF files)
- `shelters/<slug>/history.md` — per-shelter markdown history files

**Testing**: Jest with `jest-environment-node` for main-process tests (`src/main/**`), `jest-environment-jsdom` for renderer tests (`src/renderer/**`)  
**Target Platform**: macOS (primary), Windows, Linux via electron-forge makers  
**Performance Goals**: Window ready within 5 s on developer hardware; HMR updates within 300 ms  
**Constraints**: `contextIsolation: true`, preload bridge via `contextBridge`, single-instance enforcement, rotating log file in production  
**Scale/Scope**: ~12–100 shelter records, hundreds of photos per shelter, sources table (new), history.md per shelter

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design.*

- [x] **Source of truth identified**: SQLite at `database/gmc_shelters.sqlite` is the operational store; shelter photo files under `shelters/<slug>/` and `history.md` files are filesystem assets. The Electron app reads and writes these directly. No remote system is treated as canonical.
- [x] **Test-first scope identified**: Jest test files for each IPC handler, RTK slice, and utility are specified before implementation tasks. See Complexity Tracking for justification of the new test directory.
- [x] **External contract coverage identified**: The IPC bridge (`src/shared/ipc-types.ts`) is the only external interface — documented in `contracts/ipc-contract.md`. The "Publish to web" header button is a stub in this feature; its contract with the existing Python publish workflow is deferred.
- [x] **Idempotency and auditability**: All write operations (shelter save, photo upload, history write, source CRUD) are single-record mutations — inherently idempotent on retry. Photo upload checks file existence before copying. No batch sync workflows in this feature.
- [x] **Minimal-change fit**: The Electron app requires a `src/` directory and `package.json` at the repo root — justified in Complexity Tracking below. All other paths stay within the existing structure.
- [x] **WordPress/theme boundary**: The "Publish to web" button is a stub (no implementation). No WordPress API calls or theme code assumptions are made in this feature.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New `src/` directory at repo root | Electron app source (main, renderer, shared, preload) requires a top-level directory per electron-forge + Vite convention | Placing under `scripts/` would conflict with the Python automation namespace and break electron-forge's default path resolution |
| New `package.json` at repo root | Electron and all JS/TS dependencies are managed by npm; the repo currently has no `package.json` | A nested `app/` directory was considered but would require all paths (SQLite, shelters/) to be expressed as `../` relative paths, creating fragile cross-boundary references to the existing data assets |
| New `database/migrations/` entry | A `sources` table must be added to the existing SQLite database | The sources data belongs in the same operational store as shelters and photos; a separate DB would violate Principle I |
| Jest tests in `src/**/*.test.ts` | Jest for TypeScript/Electron must co-locate with source per standard Jest configuration | The existing `tests/` directory is Python/pytest; mixing JS test runners in the Python test tree would break CI discovery for both |

---

## Project Structure

### Documentation (this feature)

```text
specs/002-electron-app/
├── plan.md          ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ipc-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── index.ts          # Electron app entry, window creation, single-instance lock
│   ├── preload.ts        # contextBridge API bridge
│   ├── logger.ts         # electron-log wrapper
│   ├── db/
│   │   ├── connection.ts # better-sqlite3 singleton
│   │   ├── shelters.ts   # shelter CRUD
│   │   ├── photos.ts     # photo CRUD
│   │   └── sources.ts    # source CRUD
│   ├── fs/
│   │   ├── photos.ts     # photo file copy/delete
│   │   └── history.ts    # history.md read/write
│   └── ipc/
│       ├── shelters.ts   # IPC handler registration
│       ├── photos.ts
│       ├── sources.ts
│       ├── history.ts
│       └── shell.ts      # shell.openExternal
├── renderer/
│   ├── index.html
│   ├── index.tsx
│   ├── App.tsx           # router root
│   ├── theme/
│   │   └── index.ts      # MUI custom theme (forest/rust palette)
│   ├── store/
│   │   ├── index.ts      # configureStore
│   │   ├── sheltersSlice.ts
│   │   ├── photosSlice.ts
│   │   ├── sourcesSlice.ts
│   │   └── uiSlice.ts
│   ├── routes/
│   │   └── ShelterBrowser.tsx  # root route
│   ├── components/
│   │   ├── AppShell/
│   │   │   ├── Titlebar.tsx
│   │   │   ├── AppHeader.tsx
│   │   │   └── AppBody.tsx
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── ShelterRow.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   └── AdvancedFilters.tsx
│   │   ├── MainPane/
│   │   │   ├── RecordHeader.tsx
│   │   │   ├── TabBar.tsx
│   │   │   └── tabs/
│   │   │       ├── ShelterTab.tsx
│   │   │       ├── HistoryTab.tsx
│   │   │       ├── PhotosTab.tsx
│   │   │       └── SourcesTab.tsx
│   │   ├── modals/
│   │   │   ├── NewShelterModal.tsx
│   │   │   └── SourceEditModal.tsx
│   │   └── ui/
│   │       ├── Toast.tsx
│   │       └── CoordVisualizer.tsx
│   └── hooks/
│       └── useIpc.ts
└── shared/
    └── ipc-types.ts      # shared channel names + payload types

database/
└── migrations/
    └── 002-add-sources-table.sql

package.json
tsconfig.json
vite.main.config.ts
vite.renderer.config.ts
vite.preload.config.ts
forge.config.ts
jest.config.ts
.eslintrc.cjs
```

---

## Phase 0: Research

See [`research.md`](./research.md) for all resolved decisions.

Key decisions resolved:
1. **SQLite access**: `better-sqlite3` (synchronous) in the main process via IPC — renderer never accesses SQLite directly.
2. **IPC pattern**: `ipcMain.handle` / `ipcRenderer.invoke` (promise-based). All channels typed in `src/shared/ipc-types.ts`.
3. **Photo file access**: Main process reads from `shelters/<slug>/photos/` relative to `app.getPath('userData')` parent (i.e., the repo root resolved at runtime via `__dirname` traversal or an env var set by electron-forge).
4. **History file storage**: `shelters/<slug>/history.md` at repo root; main process reads/writes via `fs/promises`.
5. **Sources table**: New `sources` table added via `database/migrations/002-add-sources-table.sql`; migration applied at app startup if not yet present.
6. **Logging**: `electron-log` — auto-routes to console in dev, rotating file at `app.getPath('logs')` in production.
7. **MUI theme**: Custom tokens defined in `src/renderer/theme/index.ts`; palette matches design CSS vars (`--forest: #2d4a32`, `--rust: #b54d2c`).

---

## Phase 1: Design & Contracts

See [`data-model.md`](./data-model.md) and [`contracts/ipc-contract.md`](./contracts/ipc-contract.md).

### Design decisions

**Window layout** (from design files):
- Custom titlebar (38 px, `--bg-frame: #1c1813`, `-webkit-app-region: drag`, macOS traffic-light dots)
- App header (56 px): brand logo + name/sub, global search (⌘K hint), DB sync indicator, Export / Publish to web (stub) / New Shelter buttons
- Body: collapsible sidebar (280 px → 52 px) + main pane (flex-1)

**Sidebar** (from `sidebar.jsx`):
- Text search across name, slug, built_by
- Filter chips: All / Extant / Lost / GMC
- Advanced filters drawer: year range (overlap semantics), category, architecture, built_by substring, show_on_web tri-toggle
- Grouped list: Extant (sorted α) / Removed (sorted α), with section counts
- Footer: version + filtered/total count

**Main pane** (from design files):
- Record header: serif title with extant/GMC badges + coordinates subline, action buttons
- Four tabs with rust underline active indicator: Shelter | History | Sources | Photos
- Dirty-state tracked independently per tab; unsaved changes prevent navigation with confirmation

**Shelter tab** (from `shelter-tab.jsx`):
- §01 Identity: name*, slug, category, start_year*, end_year, description
- §02 Provenance: architecture, built_by, internal notes
- §03 Location: latitude, longitude + coordinate visualizer (pin on green Vermont map placeholder)
- §04 Flags: is_extant, is_gmc, show_on_web (custom checkbox cards)
- §05 System (read-only): id, default_photo_id, photo_count, created, updated, filesystem path
- Sticky save bar: "Unsaved changes" dot + Revert + Save buttons

**History tab** (from `history-tab.jsx`):
- Split pane: JetBrains Mono source textarea (left) / Newsreader serif rendered preview (right)
- Toolbar: H1, H2, Bold, Italic, UL, OL, Blockquote, Link buttons + file label
- Status bar: word count, char count, line count
- Save to disk writes to `shelters/<slug>/history.md`

**Photos tab** (from `photos-tab.jsx`):
- Toolbar: photo count + published count, Grid / List toggle, Upload button
- Drag-drop upload zone; accepts JPEG, PNG, TIFF; copies to `shelters/<slug>/photos/`
- Grid view: 4:3 cards with Default ★ and Published badges
- List view: tabular with thumbnail, title, photographer, date, ID, flags
- Detail pane (380 px): title, filename, rotate/flip/crop/zoom tools, all metadata fields, include_in_post toggle, set-as-default star, delete
- Transforms (rotate, flip, zoom) are preview-only in this feature; destructive crop deferred

**Sources tab** (from `sources-tab.jsx`):
- 12 source types (book, chapter, journal, newspaper, magazine, website, archive, manuscript, interview, map, report, other)
- Chicago Manual of Style notes-bibliography formatter
- Source cards: type badge (color-coded), formatted citation, chips, clickable URL (shell.openExternal), annotation expand, Edit / Delete actions
- Toolbar: search, type filter dropdown, sort (author/year/title/type asc/desc), Add Source button
- Add/Edit modal: type-aware field visibility, live Chicago preview
- Status bar: shown/total count, style indicator, db table + shelter_id, URL count

**New Shelter modal**:
- Fields: name, start_year, category, is_gmc
- Auto-slug from name
- Preview panel: shows prospective DB row, folder path, history.md that will be created
- On confirm: INSERT shelter, create `shelters/<slug>/`, create `shelters/<slug>/history.md`

### Redux state shape

```typescript
interface RootState {
  shelters: {
    list: Shelter[];
    selectedId: number | null;
    loading: boolean;
    dirty: boolean;        // Shelter tab has unsaved changes
    historyDirty: boolean; // History tab has unsaved changes
  };
  photos: {
    byShelter: Record<number, Photo[]>;
    loading: boolean;
  };
  sources: {
    byShelter: Record<number, Source[]>;
    loading: boolean;
  };
  ui: {
    sidebarCollapsed: boolean;
    activeTab: 'shelter' | 'history' | 'sources' | 'photos';
    query: string;
    filter: 'all' | 'extant' | 'gone' | 'gmc';
    advancedFilters: AdvancedFilters;
    toast: { message: string; id: string } | null;
  };
}
```

---

## Agent Context

`CLAUDE.md` updated to reference this plan. See plan for quickstart, contracts, and data model.
