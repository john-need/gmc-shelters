# Research: Export Dist Zip (008)

## Decision 1: Zip library

**Decision**: `archiver` npm package (streaming zip builder)

**Rationale**: Archiver is the standard Node.js streaming zip library. It pipes files into the
archive without loading all content into memory — important for large photo sets (≤ 3 000 photos).
`adm-zip` is an alternative but operates in-memory. `zlib` + manual zip format is too low-level.
The `@electron-forge/maker-zip` devDependency is for app packaging only, not runtime use.

**Alternatives considered**:
- `adm-zip` — in-memory; would load all photos at once, unsuitable for large exports
- `jszip` — similar in-memory constraint
- `child_process` + system `zip` — not portable cross-platform; Electron supports Windows
- `@electron-forge/maker-zip` — app packaging only, not a general-purpose archive API

**Action**: Add `archiver` and `@types/archiver` to `package.json`.

---

## Decision 2: Markdown → plain text for the `content` field

**Decision**: Regex-based markdown stripping inline in the builder

**Rationale**: The `content` field in the manifest is the plain-text version of `{slug}.md`. The
Python implementation uses `markdown` + `html2text` for the conversion, but the output is
essentially stripped text with no markup. Shelter history files are plain prose with occasional
`###` headers, `- ` bullets, and `**bold**` — a targeted regex pass produces equivalent output
without adding a new runtime dependency (`marked`, `remark`, etc.).

**Alternatives considered**:
- `marked` + HTML tag stripping — accurate but adds ~500 KB dependency and two conversion steps
- `remark` ecosystem — comprehensive but heavyweight for simple stripping
- Include raw markdown in `content` — breaks WordPress consumer contract (expects plain text)

**Action**: Implement `stripMarkdown(md: string): string` in `src/main/export/builder.ts`.
Patterns to strip: `### ` headers, `**` / `*` emphasis markers, `- ` list markers,
`[text](url)` links (keep text), `[text]` inline citations.

---

## Decision 3: `timelines` table vs `map_markers`

**Decision**: TypeScript builder queries `map_markers`; Python build script queries `timelines`
(pre-migration artifact — leave Python script as-is to avoid scope creep).

**Rationale**: Migration 004 dropped the `timelines` table and migrated rows into `map_markers`.
The existing Python `manifest_db.py` still queries `timelines`, meaning `build_shelter_manifest.py`
is broken against the current schema. The TypeScript builder is a clean reimplementation and
MUST query `map_markers`. The Python script breakage is out of scope for this feature — note it
as a separate tech-debt item.

`map_markers` columns: `id, shelter_id, latitude, longitude, name, start_year, end_year,
change_type, is_extant, notes, photo_id, created, updated`.

**Assembler mapping**:
- `map_markers.start_year` → manifest `startYear`
- `map_markers.end_year` → manifest `endYear`
- `map_markers.is_extant` → manifest `isExtant` (boolean)
- `map_markers.change_type` → manifest `changeType`
- `map_markers.name` → manifest `name`
- No `slug` field in map_markers; join via `shelter_id` → `shelter.slug`

**Action**: TypeScript builder queries `SELECT * FROM map_markers ORDER BY shelter_id, start_year`.
Pre-existing Python breakage tracked as tech debt outside this feature.

---

## Decision 4: `historyFile` and `historyUpdated` population

**Decision**: Read `fs.stat()` on `{repoRoot}/shelters/{slug}/{slug}.md` to get mtime.
Set `historyFile = "{slug}/{slug}.md"` and `historyUpdated` = ISO 8601 mtime. If file is
absent, set both to `null`.

**Rationale**: The file system mtime is the authoritative timestamp for when history content
changed. Using `fs.statSync()` (synchronous, consistent with `better-sqlite3` sync reads) in
the builder keeps the assembly pipeline simple.

**ISO 8601 format**: `new Date(stats.mtimeMs).toISOString()` — same pattern used throughout
the app for `updated` fields.

---

## Decision 5: IPC channel design

**Decision**: Single `EXPORT_BUILD` channel. The handler in the main process performs the full
pipeline (build → zip → dialog → save) and returns `ExportResult`.

**Rationale**: The existing IPC pattern is request/response (`ipcMain.handle` / `ipcRenderer.invoke`).
The renderer shows a "building…" toast while awaiting the response. No streaming progress
events are needed — the 60-second budget is acceptable given the async wait, and the
existing toast/spinner UI pattern is sufficient.

The folder-picker dialog is invoked inside the main-process handler (after build + zip complete)
so the user sees the picker only after the potentially long build succeeds, not before.

**ExportResult shape**:
```ts
interface ExportResult {
  cancelled: boolean;      // true if user dismissed folder picker
  savedTo: string | null;  // absolute path of written zip, null if cancelled
  shelterCount: number;
  photoCount: number;
  skippedPhotos: number;
}
```

---

## Decision 6: Temporary build directory

**Decision**: `{repoRoot}/.export-tmp/` — cleaned up before build starts and after zip completes
(or after error).

**Rationale**: Using `dist/` (as the Python script does) would clobber any existing `dist/`
used by the Vite build. A dedicated `.export-tmp/` directory avoids this collision and is
clearly identifiable as ephemeral. Added to `.gitignore` if not already present.
