# Implementation Plan: Map Markers Tab

**Branch**: `003-map-markers-tab` | **Date**: 2026-05-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-map-markers-tab/spec.md`

## Summary

Add a "Map Markers" tab to the main pane of the Electron desktop app, backed by a new `map_markers` SQLite table. Users can view, add, edit, and delete historical location records for each shelter. The implementation extends the existing IPC/Redux/Vite pattern used by sources and photos. Coverage validation (no year gaps across a shelter's markers) is enforced in the IPC handler layer; denormalized fields (`slug`, `is_extant`, `photo_id`) on markers are kept in sync inside the existing `SHELTERS_UPDATE` handler.

## Technical Context

**Language/Version**: TypeScript (ESM), Node.js 20 / Electron 32, SQLite 3.x via `better-sqlite3`
**Primary Dependencies**: `better-sqlite3` (synchronous DB), Redux Toolkit, React 18, Vite + electron-forge
**Storage**: SQLite at `database/gmc_shelters.sqlite`, migration at `database/migrations/003-add-map-markers-table.sql`
**Testing**: Jest with two project configs — `main` (Node environment) and `renderer` (jsdom environment)
**Target Platform**: macOS desktop (Electron 32, contextIsolation: true)
**Project Type**: Desktop application (archival data management)
**Performance Goals**: All DB operations are synchronous `better-sqlite3` calls — no async overhead. Coverage validation is O(n) over marker count per shelter (always small).
**Constraints**: ABI must match between Jest (Node v22, ABI 127) and Electron (ABI 128) — run `npm rebuild` before tests, `electron-rebuild` before launching the app. All IPC handlers run in the main process. Renderer accesses DB only via `contextBridge`.
**Scale/Scope**: ~200 shelter records; each shelter is expected to have 1–5 markers. No bulk import in scope.

## Constitution Check

- [x] Source of truth identified: `map_markers` table in `database/gmc_shelters.sqlite`; migration file in `database/migrations/`; no remote systems mutated.
- [x] Test-first scope identified: failing tests planned for DB layer, IPC handlers, Redux slice, and tab component before implementation.
- [x] External contract coverage identified: `ElectronAPI` interface in `src/shared/ipc-types.ts` is the contract between main and renderer; `window.api.mapMarkers` is exposed via preload.
- [x] Idempotency and auditability identified: migration uses `CREATE TABLE IF NOT EXISTS`; denormalized sync `UPDATE` is safe to run zero or N times.
- [x] Minimal-change fit identified: new files in `src/main/db/`, `src/main/ipc/`, `src/renderer/store/`, `src/renderer/components/MainPane/tabs/`; edits to existing files are targeted.
- [x] WordPress/theme boundary respected: N/A — desktop app only.

## Project Structure

### Documentation (this feature)

```text
specs/003-map-markers-tab/
├── plan.md          ← this file
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── (no contracts/ — internal IPC pattern, no external API)
```

### Source Code (repository root)

```text
database/migrations/
└── 003-add-map-markers-table.sql       NEW

src/shared/
└── ipc-types.ts                        EDIT — MapMarker, MapMarkerInput, CHANGE_TYPES, new CHANNELS, mapMarkers in ElectronAPI

src/main/
├── db/
│   └── map-markers.ts                  NEW
├── ipc/
│   ├── map-markers.ts                  NEW
│   └── shelters.ts                     EDIT — add denormalized sync in SHELTERS_UPDATE
├── index.ts                            EDIT — register map-markers handlers
└── preload.ts                          EDIT — expose window.api.mapMarkers

src/renderer/store/
├── mapMarkersSlice.ts                  NEW
├── index.ts                            EDIT — add mapMarkers reducer
└── uiSlice.ts                          EDIT — add 'markers' to activeTab union

src/renderer/components/MainPane/
├── MainPane.tsx                        EDIT — add Map Markers tab, loadMapMarkers in useEffect
└── tabs/
    └── MapMarkersTab.tsx               NEW

tests/
├── src/main/db/map-markers.test.ts     NEW
├── src/main/ipc/map-markers.test.ts    NEW
├── src/renderer/store/mapMarkersSlice.test.ts  NEW
└── src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx  NEW
```

**Structure Decision**: All new files sit within the existing `src/main/`, `src/renderer/`, and `database/` tree. No new top-level directories required.

## Complexity Tracking

> No Constitution Check violations.
