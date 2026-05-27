# Implementation Plan: Export Dist Zip

**Branch**: `008-export-dist-zip` | **Date**: 2026-05-27 | **Spec**: [spec.md](spec.md)

## Summary

Implement the **Export** button in the app header. Clicking it triggers a TypeScript manifest
builder (querying `better-sqlite3` directly), assembles photos and history files into a temporary
directory, zips the result with `archiver`, prompts the user to select a destination folder via
Electron's native dialog, and saves the dated zip there. Adds `historyFile` and `historyUpdated`
fields to each shelter entry in the manifest, and explicitly includes `photo.updated` per the
clarified spec.

## Technical Context

**Language/Version**: TypeScript (Electron 32 main process, Node.js 20)
**Primary Dependencies**: `better-sqlite3` (existing), `archiver` + `@types/archiver` (new),
Node.js `fs/promises`, `path`, `os` (built-ins)
**Storage**: `database/gmc_shelters.sqlite` (read-only), `shelters/{slug}/` (read photos + history),
`.export-tmp/` (write, ephemeral)
**Testing**: Jest `main` project (`src/main/**/*.test.ts`); Electron mocks already in place
**Target Platform**: macOS Electron desktop app (same Electron main-process environment as all
other IPC handlers)
**Performance Goals**: ≤ 60 s for ≤ 300 shelters, ≤ 3 000 photos (SC-001)
**Constraints**: No Python subprocess; synchronous DB reads (`better-sqlite3`); async FS ops for
I/O; temporary dir cleaned on success and error; idempotent reruns produce independent zips
**Scale/Scope**: ~250 shelters, ~1 000–3 000 photos; touches 8 source files + 5 new files;
no schema migration needed

## Constitution Check

- [x] **Source of truth identified**: SQLite (`database/gmc_shelters.sqlite`) and local assets
  (`shelters/{slug}/`) are the canonical inputs. The export zip is a derived output. WordPress
  deploy script is an external consumer, unchanged by this feature.
- [x] **Test-first scope identified**: Unit tests for `builder.ts` and `zipper.ts` are planned
  before implementation. IPC handler test planned before wiring. All new automation paths covered.
- [x] **External contract coverage identified**: `specs/008-export-dist-zip/contracts/zip-layout.md`
  documents the archive structure. `quickstart.md` provides operator steps. Consumer validation
  commands are documented in the contract file.
- [x] **Idempotency and auditability identified**: Export is safe to rerun — each run produces
  an independent zip. `ExportResult` returns `shelterCount`, `photoCount`, `skippedPhotos` for
  audit. No external side effects during build; zip write is the only mutation.
- [x] **Minimal-change fit identified**: New files in `src/main/export/` and `src/main/ipc/`;
  modifications to `src/shared/ipc-types.ts`, `src/main/preload.ts`, `src/main/index.ts`,
  `AppHeader.tsx`. All within the existing TypeScript source tree. One new npm dependency (`archiver`).
- [x] **WordPress/theme boundary respected**: The export zip is a documented data payload.
  No WordPress theme or server code is assumed or changed.

## Project Structure

### Documentation (this feature)

```
specs/008-export-dist-zip/
├── spec.md
├── plan.md            ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── zip-layout.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```
src/
├── shared/
│   └── ipc-types.ts            ← add EXPORT_BUILD channel + ExportResult type
├── main/
│   ├── index.ts                ← register exportHandlers()
│   ├── preload.ts              ← expose window.api.export.build()
│   ├── export/
│   │   ├── builder.ts          ← NEW: manifest assembly (DB → ShelterEntry[])
│   │   ├── builder.test.ts     ← NEW: unit tests
│   │   ├── zipper.ts           ← NEW: zip archive creation (archiver)
│   │   ├── zipper.test.ts      ← NEW: unit tests
│   │   ├── index.ts            ← NEW: orchestrator (build→zip→dialog→save→cleanup)
│   │   └── index.test.ts       ← NEW: integration-level tests (mocked dialog)
│   └── ipc/
│       ├── export.ts           ← NEW: IPC handler (EXPORT_BUILD)
│       └── export.test.ts      ← NEW: IPC handler test
└── renderer/
    └── components/
        └── AppShell/
            └── AppHeader.tsx   ← wire Export button (loading state + IPC call)

package.json                    ← add archiver, @types/archiver
.gitignore                      ← add .export-tmp/
```

## Phase 0: Research

Resolved in `research.md`. Key decisions:

| Topic | Decision |
|---|---|
| Zip library | `archiver` (streaming, avoids full in-memory load) |
| Markdown stripping | Regex-based `stripMarkdown()` in `builder.ts` (no new dep) |
| Map markers source | `map_markers` table (timelines dropped in migration 004) |
| `historyFile` value | `"{slug}/{slug}.md"` — relative path from archive root |
| `historyUpdated` value | ISO 8601 `fs.statSync(path).mtime.toISOString()` |
| Temp directory | `.export-tmp/` at repo root (not `dist/` to avoid Vite collision) |
| IPC shape | Single `EXPORT_BUILD` channel; full pipeline in main process |

## Phase 1: Design & Contracts

### New IPC types (`src/shared/ipc-types.ts`)

```ts
// Add to CHANNELS:
EXPORT_BUILD: 'export:build'

// New types:
interface ExportResult {
  cancelled: boolean;
  savedTo: string | null;       // absolute path of written zip
  shelterCount: number;
  photoCount: number;
  skippedPhotos: number;        // photos listed in manifest but absent from disk
}
```

### `ElectronAPI` extension

```ts
// Add to ElectronAPI interface:
export: {
  build: () => Promise<ExportResult>;
};
```

### `builder.ts` responsibilities

1. Open DB via `getDb()` (existing connection module)
2. Query shelters (show_on_web=1) with JOINs for architecture / category / builtBy
3. Query all photos (include_in_post=1)
4. Query all map markers
5. For each shelter: resolve map markers, resolve photos, check photo files exist on disk, read `{slug}.md` stat for `historyFile` / `historyUpdated`, strip markdown for `content`
6. Return `BuildResult = { manifest: ManifestJson; shelterCount: number; photoCount: number; skippedPhotos: number }` after populating `tmpDir` with photos and `{slug}.md` files

### `zipper.ts` responsibilities

1. Accept `(srcDir: string, destZipPath: string) => Promise<void>`
2. Use `archiver` to stream files from `srcDir` into a zip at `destZipPath`
3. Resolve promise on `finish`, reject on `error`

### `index.ts` (orchestrator) responsibilities

1. Create and clean `.export-tmp/`
2. Call `builder.buildManifest(repoRoot, tmpDir)` → writes files to `tmpDir`, returns `BuildResult` metadata
3. Call `zipper.createZip(tmpDir, zipTmpPath)` → zip written to a temp path
4. Show `dialog.showOpenDialog` (openDirectory mode) → user picks destination folder
5. If cancelled → cleanup and return `{ cancelled: true, ... }`
6. Copy zip from temp path to `{destFolder}/{filename}`
7. Cleanup `.export-tmp/` and temp zip
8. Return `ExportResult`

### `AppHeader.tsx` changes

- Add `const [exporting, setExporting] = useState(false)`
- On click: `setExporting(true)` + `showToast('Building export…')`
- Await `window.api.export.build()`
- On result: show success or error toast, `setExporting(false)`
- Button disabled while `exporting === true`

### Contracts generated

- `specs/008-export-dist-zip/contracts/zip-layout.md` ✅ (written in Phase 1)
- `specs/008-export-dist-zip/quickstart.md` ✅ (written in Phase 1)

## Implementation Quickstart

```bash
# Install new dependency first
npm install archiver
npm install --save-dev @types/archiver

# Run main-process tests
npx jest --testPathPattern="src/main"

# Full test suite
npm test

# Manual smoke test: click Export in running app
npm start
```

## Tech Debt Note

`scripts/build_dist_package.py` calls `manifest_db.py` which queries the `timelines` table,
dropped in migration 004. The Python script will fail against the current schema. This is a
pre-existing breakage outside this feature's scope — tracked as a separate tech-debt item.
The in-app TypeScript builder queries `map_markers` (correct current schema).
