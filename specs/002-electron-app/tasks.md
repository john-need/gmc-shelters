---

description: "Task list for GMC Shelters Electron Desktop App scaffold"
---

# Tasks: GMC Shelters Electron Desktop App

**Input**: Design documents from `specs/002-electron-app/`
**Tests**: TDD — write failing tests first in each phase, confirm they fail (red), implement (green), lint-clean.
**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `T### [P?] [US?] Description — file/path`

- **[P]**: Can run in parallel (different files, no incomplete dependencies)
- **[US1]**–**[US4]**: User story label (maps to spec.md priorities)
- Exact file paths are in each task description

## Path Conventions

- Electron source lives in `src/main/`, `src/renderer/`, `src/shared/`
- DB migrations live in `database/migrations/`
- Config files live at the repo root (`package.json`, `tsconfig.json`, `forge.config.ts`, `vite.*.config.ts`, `jest.config.ts`, `.eslintrc.cjs`)
- Test files co-locate with source as `*.test.ts` / `*.test.tsx`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: All config files and directory structure needed before any story work begins.

- [ ] T001 Create directory structure at repo root: `src/main/db/`, `src/main/fs/`, `src/main/ipc/`, `src/main/__mocks__/`, `src/renderer/components/AppShell/`, `src/renderer/components/Sidebar/`, `src/renderer/components/MainPane/tabs/`, `src/renderer/components/modals/`, `src/renderer/components/ui/`, `src/renderer/hooks/`, `src/renderer/routes/`, `src/renderer/store/`, `src/renderer/theme/`, `src/shared/`, `database/migrations/`, `assets/`
- [ ] T002 [P] Write `package.json`: dependencies (`electron`, `@electron-forge/plugin-vite`, `vite`, `@vitejs/plugin-react`, `react@18`, `react-dom@18`, `@reduxjs/toolkit`, `react-redux`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `react-router-dom@6`, `better-sqlite3`, `electron-log`); devDependencies (`typescript@5`, `jest`, `ts-jest`, `@types/jest`, `@types/better-sqlite3`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `@testing-library/react`, `@testing-library/jest-dom`); scripts: `"start": "electron-forge start"`, `"test": "jest"`, `"lint": "eslint 'src/**/*.{ts,tsx}'"`, `"lint:fix": "eslint 'src/**/*.{ts,tsx}' --fix"`, `"make": "electron-forge make"`, `"package": "electron-forge package"`
- [ ] T003 [P] Write `tsconfig.json`: `strict: true`, `target: "ES2022"`, `module: "CommonJS"`, `moduleResolution: "node"`, `jsx: "react-jsx"`, `esModuleInterop: true`, `skipLibCheck: true`; `include: ["src"]`
- [ ] T004 [P] Write `vite.main.config.ts`: `build.lib.entry: 'src/main/index.ts'`, `build.target: 'node18'`; mark `electron`, `better-sqlite3`, `electron-log`, `path`, `fs` as external
- [ ] T005 [P] Write `vite.preload.config.ts`: `build.lib.entry: 'src/main/preload.ts'`, `build.target: 'node18'`; mark `electron` as external; `build.rollupOptions.output.format: 'cjs'`
- [ ] T006 [P] Write `vite.renderer.config.ts`: `plugins: [react()]`, `build.rollupOptions.input: 'src/renderer/index.html'`; no Node externals
- [ ] T007 [P] Write `forge.config.ts`: `plugins: [new VitePlugin({ build: [...main, preload, renderer configs], renderer: [...] })]`; `packagerConfig: { appBundleId: 'tech.inulabs.gmc-shelters', executableName: 'gmc-shelters', icon: 'assets/icon' }`; `makers: [@electron-forge/maker-dmg (macOS), @electron-forge/maker-zip (linux/windows)]`
- [ ] T008 [P] Write `jest.config.ts`: two projects — `{ displayName: 'main', testEnvironment: 'node', testMatch: ['<rootDir>/src/main/**/*.test.ts'], transform: { '^.+\\.ts$': 'ts-jest' }, moduleNameMapper: { '^electron$': '<rootDir>/src/main/__mocks__/electron.ts' } }` and `{ displayName: 'renderer', testEnvironment: 'jsdom', testMatch: ['<rootDir>/src/renderer/**/*.test.tsx'], setupFilesAfterFramework: ['<rootDir>/src/renderer/setupTests.ts'], transform: { '^.+\\.(ts|tsx)$': 'ts-jest' } }`
- [ ] T009 [P] Write `.eslintrc.cjs`: `parser: '@typescript-eslint/parser'`; `parserOptions: { project: './tsconfig.json' }`; `plugins: ['@typescript-eslint', 'react', 'react-hooks']`; `extends: ['plugin:@typescript-eslint/recommended', 'plugin:react/recommended', 'plugin:react-hooks/recommended']`; `settings: { react: { version: 'detect' } }`; `ignorePatterns: ['node_modules', 'out', '.vite', '*.js', '*.cjs']`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared code that all user stories depend on. Must complete before user story phases.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [ ] T010 Write `src/shared/ipc-types.ts`: export channel name string constants for all IPC channels (`shelters:getAll`, `shelters:getById`, `shelters:create`, `shelters:update`, `shelters:delete`, `photos:getByShelter`, `photos:update`, `photos:delete`, `photos:setDefault`, `photos:upload`, `history:read`, `history:write`, `sources:getByShelter`, `sources:create`, `sources:update`, `sources:delete`, `shell:openExternal`, `app:getVersion`, `app:getRepoRoot`); export `Shelter`, `Photo`, `Source`, `SourceType`, `SourceInput`, `ShelterCreateInput`, `PhotoUpdateInput`, `PhotoUploadInput` interfaces per data-model.md; export `ElectronAPI` interface and `Window` augmentation (`declare global { interface Window { api: ElectronAPI } }`)
- [ ] T010b Write `src/main/db/__tests__/migration-002.test.ts` (node env, **RED phase gate for T011** — Constitution Principle II): using `better-sqlite3` with an in-memory DB (`':memory:'`), read `database/migrations/002-add-sources-table.sql` via `fs.readFileSync` and execute it; assert `SELECT name FROM sqlite_master WHERE type='table' AND name='sources'` returns exactly one row; assert `SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sources_shelter'` returns one row; assert `PRAGMA table_info(sources)` includes columns `id`, `shelter_id`, `type`, `author`, `title`, `url`, `created`, `updated`; run this test FIRST and confirm it fails before writing T011
- [ ] T011 [P] Write `database/migrations/002-add-sources-table.sql`: `CREATE TABLE IF NOT EXISTS sources (id INTEGER PRIMARY KEY AUTOINCREMENT, shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE, type TEXT NOT NULL DEFAULT 'other', ...)` with all columns per data-model.md; `CREATE INDEX IF NOT EXISTS idx_sources_shelter ON sources(shelter_id)`
- [ ] T012 [P] Write `src/main/logger.ts`: import `{ app }` from `'electron'`; import `log` from `electron-log`; configure `log.transports.file.level = 'info'`, `log.transports.console.level = app.isPackaged ? false : 'debug'`; export named `log` singleton
- [ ] T012a Create `src/main/__mocks__/electron.ts`: export mocked `app` (`requestSingleInstanceLock: jest.fn(() => true)`, `quit: jest.fn()`, `on: jest.fn()`, `getPath: jest.fn(() => '/tmp')`, `getVersion: jest.fn(() => '0.0.1')`, `isPackaged: false`); export mocked `BrowserWindow` class (constructor `jest.fn()`, instance methods `loadURL`, `loadFile`, `on`, `restore`, `focus`, `webContents.openDevTools` all `jest.fn()`); export mocked `ipcMain` (`handle: jest.fn()`); export mocked `ipcRenderer` (`invoke: jest.fn()`); export mocked `contextBridge` (`exposeInMainWorld: jest.fn()`); export mocked `Menu` (`setApplicationMenu: jest.fn()`, `buildFromTemplate: jest.fn()`); export mocked `shell` (`openExternal: jest.fn()`) — **moved here from Phase 4**: T013/T014 in Phase 3 need this mock to exist before their Jest red-phase run

**Checkpoint**: Shared types, migration SQL, logger, and electron Jest mock are ready. User story phases can begin.

---

## Phase 3: User Story 1 — Launch Desktop Application (Priority: P1) 🎯 MVP

**Goal**: An Electron window opens titled "gmc-shelters" with custom titlebar, MUI archival theme, Redux store, React Router, and a branded splash/home screen. Single-instance lock enforced.

**Independent Test**: Run `npm start`; verify a desktop window appears with the title "gmc-shelters" and renders the splash screen without errors in the console.

### Tests for US1 ⚠️ — write these first and confirm they fail before implementing

- [ ] T013 [P] [US1] Write `src/main/index.test.ts`: mock `electron` via `moduleNameMapper` (mock created in T012a); assert `app.requestSingleInstanceLock()` is called on import; assert `BrowserWindow` is constructed with `webPreferences: { contextIsolation: true, nodeIntegration: false, preload: expect.stringContaining('preload') }`; assert `app.quit()` is called when `requestSingleInstanceLock()` returns `false`; assert `app.on('second-instance', ...)` is registered; **FR-015 coverage**: assert `Menu.setApplicationMenu` is called with an argument whose items include a menu with label matching `'File'` or `'gmc-shelters'` (app menu), one with label `'Edit'`, and one with label `'Window'`
- [ ] T014 [P] [US1] Write `src/main/preload.test.ts`: mock `electron`; assert `contextBridge.exposeInMainWorld` is called with `'api'` and an object whose top-level keys are `['shelters', 'photos', 'history', 'sources', 'shell', 'app']`; assert `shelters.getAll` is a function
- [ ] T015 [P] [US1] Write `src/renderer/store/uiSlice.test.ts`: assert initial state has `sidebarCollapsed: false`, `activeTab: 'shelter'`, `filter: 'all'`, `toast: null`; dispatch `setActiveTab('photos')` and assert state updates; dispatch `showToast({ id: '1', message: 'test' })` then `clearToast()` and assert toast returns to null
- [ ] T016 [P] [US1] Write `src/renderer/store/sheltersSlice.test.ts`: assert initial state has `selectedId: null`, `dirty: false`, `historyDirty: false`, `list: []`; dispatch `setSelectedId(5)` and assert state; dispatch `setDirty(true)` and assert state
- [ ] T017 [P] [US1] Write `src/renderer/theme/index.test.ts`: import `theme` from `src/renderer/theme/index.ts`; assert `theme.palette.primary.main === '#2d4a32'`; assert `theme.palette.secondary.main === '#b54d2c'`; assert `theme.palette.background.default === '#f3ecdb'`

### Implementation for US1

- [ ] T018 [US1] Implement `src/main/index.ts`: call `app.requestSingleInstanceLock()` — if returns `false`, call `app.quit()` and return; on `ready`, create `BrowserWindow` (width: 1280, height: 800, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`, preload: resolved path to preload script); load `MAIN_WINDOW_VITE_DEV_SERVER_URL` in dev or `index.html` in production; register `second-instance` handler to `mainWindow.restore()` + `mainWindow.focus()`; register `Menu.setApplicationMenu` with App (About, Quit), Edit (clipboard), Window (Minimize, Zoom) menus
- [ ] T019 [P] [US1] Implement `src/main/preload.ts`: `contextBridge.exposeInMainWorld('api', { shelters: { getAll: () => ipcRenderer.invoke('shelters:getAll'), getById: (id) => ipcRenderer.invoke('shelters:getById', { id }), create: (input) => ipcRenderer.invoke('shelters:create', input), update: (shelter) => ipcRenderer.invoke('shelters:update', shelter), delete: (id) => ipcRenderer.invoke('shelters:delete', { id }) }, photos: {...}, history: {...}, sources: {...}, shell: { openExternal: (url) => ipcRenderer.invoke('shell:openExternal', { url }) }, app: { getVersion: () => ipcRenderer.invoke('app:getVersion'), getRepoRoot: () => ipcRenderer.invoke('app:getRepoRoot') } })` — typed against `ElectronAPI` from `src/shared/ipc-types.ts`
- [ ] T020 [P] [US1] Write `src/renderer/index.html`: standard HTML5 shell with `<meta charset="UTF-8">`, `<title>gmc-shelters</title>`, `<div id="root"></div>`, `<script type="module" src="/index.tsx"></script>`
- [ ] T021 [US1] Implement `src/renderer/index.tsx`: `createRoot(document.getElementById('root')!).render(<StrictMode><ThemeProvider theme={theme}><CssBaseline /><Provider store={store}><App /></Provider></ThemeProvider></StrictMode>)`
- [ ] T022 [P] [US1] Implement `src/renderer/theme/index.ts`: `createTheme({ palette: { primary: { main: '#2d4a32', dark: '#1f3524' }, secondary: { main: '#b54d2c', dark: '#8e3a1f' }, background: { default: '#f3ecdb', paper: '#faf4e3' }, text: { primary: '#1c170d', secondary: '#7a6f56' } }, typography: { fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif', h1: { fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif' }, h2: { fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif' }, h3: { fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif' } } })`
- [ ] T023 [P] [US1] Implement `src/renderer/store/index.ts`: `configureStore({ reducer: { shelters: sheltersReducer, photos: photosReducer, sources: sourcesReducer, ui: uiReducer } })`; export `RootState = ReturnType<typeof store.getState>` and `AppDispatch = typeof store.dispatch`
- [ ] T024 [P] [US1] Implement `src/renderer/store/uiSlice.ts`: `createSlice` with `UiState` initial state; reducers: `setActiveTab`, `setSidebarCollapsed`, `setQuery`, `setFilter`, `setAdvancedFilters`, `showToast(state, action: PayloadAction<{id: string; message: string}>)`, `clearToast`; export slice actions and reducer
- [ ] T025 [P] [US1] Implement `src/renderer/store/sheltersSlice.ts`: `createSlice` with `SheltersState` initial state (`list: [], selectedId: null, editBuffer: null, loading: false, saving: false, dirty: false, historyContent: '', historyDirty: false`); reducers: `setSelectedId`, `setDirty`, `setHistoryDirty`, `setEditBuffer`, `clearDirty`; placeholder `loadShelters = createAsyncThunk('shelters/loadAll', async () => [] as Shelter[])` — returns empty array until data layer is built in next feature
- [ ] T026 [P] [US1] Implement `src/renderer/store/photosSlice.ts`: `createSlice` with `PhotosState` initial state (`byShelter: {}, loading: false, uploading: false`); placeholder `loadPhotos = createAsyncThunk('photos/loadByShelter', async (_shelterId: number) => [] as Photo[])`
- [ ] T027 [P] [US1] Implement `src/renderer/store/sourcesSlice.ts`: `createSlice` with `SourcesState` initial state (`byShelter: {}, loading: false`); placeholder `loadSources = createAsyncThunk('sources/loadByShelter', async (_shelterId: number) => [] as Source[])`
- [ ] T028 [US1] Implement `src/renderer/App.tsx`: `createBrowserRouter([{ path: '/', element: <ShelterBrowser /> }])`; export default `function App() { return <RouterProvider router={router} /> }`
- [ ] T029 [P] [US1] Implement `src/renderer/components/AppShell/Titlebar.tsx`: `Box` with `height: 38`, `backgroundColor: '#1c1813'`, `sx={{ WebkitAppRegion: 'drag', display: 'flex', alignItems: 'center', pl: 2 }}`; render three `Box` circles (12px, colors `#ff5f57`, `#febc2e`, `#28c840`) for macOS traffic-light placeholders (non-functional, decorative only)
- [ ] T030 [P] [US1] Implement `src/renderer/components/AppShell/AppHeader.tsx`: 56px `AppBar` with `backgroundColor: theme.palette.primary.main`; left: brand name "GMC Shelters" in Newsreader serif; center: search `TextField` (stub, no handler); right: three `Button` elements ("Export", "Publish to web", "New Shelter") that dispatch `showToast({ id: Date.now().toString(), message: '<action> not yet implemented.' })` on click
- [ ] T031 [P] [US1] Implement `src/renderer/components/AppShell/AppBody.tsx`: `Box` flex row, `flex: 1`, `overflow: 'hidden'`; reads `ui.sidebarCollapsed` from Redux; renders `<Box width={sidebarCollapsed ? 52 : 280} />` placeholder sidebar region and `<Box flex={1} />` placeholder main pane region
- [ ] T032 [US1] Implement `src/renderer/routes/ShelterBrowser.tsx`: root route component; renders `<Titlebar />`, `<AppHeader />`, `<AppBody />`; dispatches `loadShelters()` on mount via `useEffect`; renders `<Toast />` overlay
- [ ] T033 [P] [US1] Implement `src/renderer/components/ui/Toast.tsx`: reads `ui.toast` from Redux via `useSelector`; renders MUI `Snackbar` (open when `toast !== null`, `autoHideDuration: 4000`) containing MUI `Alert`; on close dispatches `clearToast()`
- [ ] T034 [P] [US1] Implement `src/renderer/hooks/useIpc.ts`: export `useIpc()` hook returning `window.api` typed as `ElectronAPI`; if `window.api` is undefined (SSR/test), return a no-op stub; add a `useIpcCall<T>(fn: () => Promise<T>, deps)` helper that calls `fn`, dispatches `showToast` on rejection, and returns `{ data, loading, error }`

**Checkpoint**: `npm start` opens a desktop window titled "gmc-shelters". Custom titlebar renders. MUI archival theme (parchment background, forest header) is visible. Stub header buttons show toasts. Tests T013–T017 pass.

---

## Phase 4: User Story 2 — Run Automated Tests (Priority: P1)

**Goal**: `npm test` runs both the `main` (node) and `renderer` (jsdom) Jest projects; all scaffold tests pass; failure messages identify file and line.

**Independent Test**: Run `npm test`; observe Jest reports a summary for both projects with all tests passing and zero failures.

### Tests for US2 ⚠️ — write these first and confirm Jest picks them up

- [ ] T035 [P] [US2] Write `src/main/logger.test.ts` (node env): import `log` from `src/main/logger.ts`; assert `typeof log.info === 'function'`; assert `typeof log.warn === 'function'`; assert `typeof log.error === 'function'`; assert calling `log.info('test')` does not throw
- [ ] T036 [P] [US2] Write `src/renderer/App.test.tsx` (jsdom env): render `<Provider store={store}><ThemeProvider theme={theme}><App /></ThemeProvider></Provider>` using `@testing-library/react`; assert it renders without throwing; assert `document.title` is `'gmc-shelters'` (or that a Titlebar element is present in the DOM)

### Implementation for US2

- [ ] T037 [US2] Verify `src/main/__mocks__/electron.ts` (created in Phase 2 as T012a) satisfies all US2 test requirements: confirm `ipcRenderer.invoke` mock returns `Promise.resolve(undefined)` by default (so T035/T036 don't hang); extend the mock with `dialog: { showOpenDialog: jest.fn() }` if any renderer test needs it; confirm `app.isPackaged` can be overridden per-test via `Object.defineProperty` for production-branch tests (T043)
- [ ] T038 [P] [US2] Create `src/renderer/setupTests.ts`: `import '@testing-library/jest-dom'`; set `window.api` to a jest stub object matching all `ElectronAPI` namespaces where each method is `jest.fn().mockResolvedValue(undefined)`; export nothing (side-effects only)
- [ ] T039 [P] [US2] Update `jest.config.ts` renderer project: add `setupFilesAfterFramework: ['<rootDir>/src/renderer/setupTests.ts']`; confirm `ts-jest` diagnostics are enabled; add `moduleNameMapper` for `src/renderer` that maps `\\.css$` to `identity-obj-proxy` (add `identity-obj-proxy` to devDependencies in `package.json`)

**Checkpoint**: `npm test` executes both projects. `main` project runs T013–T014, T035. `renderer` project runs T015–T017, T036. All pass with a green summary.

---

## Phase 5: User Story 3 — Lint Source Code (Priority: P2)

**Goal**: `npm run lint` checks all `src/**/*.{ts,tsx}` and exits with code 0 on the scaffold.

**Independent Test**: Run `npm run lint`; confirm zero errors and zero warnings on all scaffold source files.

### Tests for US3 ⚠️

- [ ] T040 [P] [US3] Audit `jest.config.ts` for correct Jest 24+ option name `setupFilesAfterFramework` (the deprecated pre-v24 name was `setupTestFrameworkScriptFile` — if either renderer project config uses the old name, update it); also confirm `.eslintrc.cjs`: `parserOptions.project` points to `'./tsconfig.json'`, and `ignorePatterns` includes `'out'`, `'.vite'`, `'node_modules'`, `'*.cjs'`, `'*.js'` so ESLint doesn't attempt to parse its own config file or build output

### Implementation for US3

- [ ] T041 [US3] Audit all scaffold source files from T010, T012, T019, T021–T034, T037–T039 for ESLint compliance: fix any `@typescript-eslint/no-explicit-any` violations (replace `any` with typed alternatives), fix `react-hooks/exhaustive-deps` warnings in `useEffect` calls, fix `react/react-in-jsx-scope` (disable rule in config since React 17+ JSX transform doesn't require the import), confirm no unused variables
- [ ] T042 [P] [US3] Add `"react/react-in-jsx-scope": "off"` to `.eslintrc.cjs` rules (React 17+ JSX transform does not require `import React`); add `"@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]` to allow underscore-prefixed unused args

**Checkpoint**: `npm run lint` exits with code 0 and reports 0 problems on all `src/` files.

---

## Phase 6: User Story 4 — Build for Distribution (Priority: P3)

**Goal**: `npm run make` produces a platform-appropriate distributable artifact in `out/make/`.

**Independent Test**: Run `npm run make` on macOS; verify a `.dmg` file appears in `out/make/`.

### Tests for US4 ⚠️

- [ ] T043 [US4] Extend `src/main/index.test.ts` with two additional test cases: (1) when `app.isPackaged` mock is `true`, the window loads a file path (not a dev-server URL); (2) when `app.isPackaged` mock is `false`, the window loads `MAIN_WINDOW_VITE_DEV_SERVER_URL` — set `process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5173'` in the test setup

### Implementation for US4

- [ ] T044 [US4] Update `forge.config.ts` makers array: add `{ name: '@electron-forge/maker-dmg', config: { format: 'ULFO' } }` for macOS; add `{ name: '@electron-forge/maker-zip', platforms: ['linux', 'win32'] }` as fallback; ensure `packagerConfig.ignore` excludes `specs/`, `tests/`, `.specify/`, `node_modules` that electron-forge handles automatically
- [ ] T045 [P] [US4] Add `assets/icon.png` placeholder (1024×1024 transparent PNG with "GMC" text — manually create or use a placeholder; document in `specs/002-electron-app/quickstart.md` that a real icon must be added before distribution); update `forge.config.ts` `packagerConfig.icon: 'assets/icon'` (no extension — electron-forge picks the right format per platform)
- [ ] T046 [P] [US4] Verify `package.json` has `"main": ".vite/build/main.js"` (the electron-forge Vite plugin output path) so Electron knows the entry point for the packaged app; confirm `"version"` field is set to `"0.1.0"`

**Checkpoint**: `npm run make` completes without errors and produces a distributable in `out/make/`.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T047 [P] Add `src/shared/cite-chicago.ts` stub: `export function citeChicago(source: Source): string { return '' }`; add `src/shared/cite-chicago.test.ts`: assert `citeChicago({ type: 'book', title: 'Test', author: 'Doe', ...defaultSource })` returns a string (even empty is valid at this stage) — this stub reserves the module path for the data-integration feature
- [ ] T048 [P] Update `specs/002-electron-app/quickstart.md` "Troubleshooting" section: document the Jest manual mock at `src/main/__mocks__/electron.ts` and the `moduleNameMapper` entry so future contributors know how to test main-process code without a live Electron binary
- [ ] T049 Re-run `npm test` (both projects) and `npm run lint` after all implementation tasks are marked complete; fix any regressions before marking this task done
- [ ] T050 [P] Manual verification checklist (document results in `specs/002-electron-app/quickstart.md`): (1) `npm start` → window opens within 5 s; (2) edit a `src/renderer/` file → HMR updates without restart; (3) launch a second `npm start` terminal → second process exits, first window gains focus; (4) close main window → app process exits cleanly with code 0

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Requires Phase 1 (`src/` directories and `package.json` must exist).
- **US1 (Phase 3)**: Requires Phase 2 (`ipc-types.ts` needed by `preload.ts`; `logger.ts` needed by `index.ts`).
- **US2 (Phase 4)**: Requires Phase 3 complete. Electron mock (T012a) is already created in Phase 2 — Phase 4 only verifies and extends it.
- **US3 (Phase 5)**: Requires Phase 3 complete (lints real source files from US1).
- **US4 (Phase 6)**: Requires Phase 3 complete (forge needs a working window entry point).
- **Polish (Phase 7)**: Requires all desired user stories complete.

### User Story Dependencies

US1 is the foundation — US2, US3, and US4 all depend on US1 completing first. After US1, US2 and US3 may proceed in parallel. US4 should follow US2 (confirms tests pass before producing a distributable).

### Within Each User Story (TDD Red-Green Loop)

1. Write all tests for the story (T013–T017 for US1, etc.)
2. Run `npm test` — confirm the new tests **fail** (red phase)
3. Implement the story tasks
4. Run `npm test` — confirm all tests **pass** (green phase)
5. Run `npm run lint` — fix any violations before moving on

### Parallel Opportunities

**Phase 1**: T002–T009 all parallel (separate config files, no shared state).  
**Phase 2**: T010b after T010; T011, T012, T012a parallel after T010b exists (migration SQL and mock are independent of each other).  
**Phase 3 Tests**: T013–T017 all parallel (separate test files).  
**Phase 3 Impl**: T019, T020, T022–T027, T029–T031, T033, T034 parallel (separate source files); T018, T021, T028, T032 sequential (main entry → renderer mount → router → root route).  
**Phase 4**: T035–T036 parallel; T037, T038, T039 all parallel (T037 is now a verification task with no blocking dependencies).  
**Phase 5**: T040, T042 parallel; T041 sequential (audits all prior files).  
**Phase 6**: T045, T046 parallel after T044.  
**Phase 7**: T047, T048, T050 parallel; T049 sequential (runs after all prior tasks).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) — ~1 hour.
2. Complete Phase 2 (Foundational) — ~30 min.
3. Write T013–T017, confirm they fail (red).
4. Implement T018–T034, confirm T013–T017 pass (green).
5. `npm start` opens the window — US1 MVP done.

### Incremental Delivery

1. US1 → launch window (scaffold MVP).
2. US2 → `npm test` passes in both environments.
3. US3 → `npm run lint` exits 0 on all source files.
4. US4 → `npm run make` produces a distributable.
5. Polish → verify HMR, single-instance, quickstart docs.

### Parallel Team Strategy

After Phase 2: one developer implements US1 (T013–T034); a second developer prepares the electron Jest mock (T037) in parallel, since it doesn't depend on any US1 source file existing yet. After US1 lands: split US2, US3, and US4 across contributors — they modify different config files and test files.

---

## Summary

| Phase | Tasks | Parallel? |
|---|---|---|
| Setup | T001–T009 (9 tasks) | T002–T009 all parallel |
| Foundational | T010–T012a (6 tasks: T010, T010b, T011, T012, T012a) | T011, T012, T012a parallel after T010b |
| US1 Tests | T013–T017 (5 tasks) | All parallel |
| US1 Impl | T018–T034 (17 tasks) | Most parallel |
| US2 Tests | T035–T036 (2 tasks) | Both parallel |
| US2 Impl | T037–T039 (3 tasks) | All parallel |
| US3 Tests | T040 (1 task) | — |
| US3 Impl | T041–T042 (2 tasks) | T042 parallel |
| US4 Tests | T043 (1 task) | — |
| US4 Impl | T044–T046 (3 tasks) | T045, T046 parallel |
| Polish | T047–T050 (4 tasks) | T047, T048, T050 parallel |
| **Total** | **53 tasks** | |

**MVP scope**: Phase 1 + Phase 2 + Phase 3 (US1) = 31 tasks.

## Notes

- `[P]` tasks target different files with no incomplete dependencies — safe to parallelize.
- TDD: tests MUST be written and confirmed failing before implementation begins.
- `better-sqlite3` is NOT used in this feature — it is mocked. The DB access layer (IPC handlers, `db/shelters.ts`, etc.) is deferred to the data-integration feature.
- All thunks (`loadShelters`, `loadPhotos`, `loadSources`) return empty arrays as stubs — the UI wires them up but displays no data until the next feature.
- `shelters/<slug>/` filesystem operations are deferred to the data-integration feature.
