# Implementation Plan: Schema-Driven Wiki Header Editor

**Branch**: `014-wiki-header-schema-form` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-wiki-header-schema-form/spec.md`

## Summary

Replace the wiki header editor's single free-text `<textarea>` (`CollectionsManagementPage.tsx`'s `HeaderEditorDialog`, backed by `wiki:getHeader`/`wiki:saveHeader`) with a form of individual, per-property controls, and add a collection-level citation-type setting. A shared schema (`src/shared/wiki-header-schema.ts`) defines, per `SourceType` (the app's existing 12-value citation type enum), which header properties are required/optional/not-applicable and what control each uses; the main process — not the renderer — owns YAML serialization, so the renderer can never write malformed frontmatter. `WIKI_GET_HEADER`/`WIKI_SAVE_HEADER` change from raw-text to structured field values; a new `COLLECTIONS_SET_CITATION_TYPE` channel writes a collection's default into its `metadata.yaml` via a small Python line-patcher (mirroring the existing `scripts/patch_citation_types.py` technique), and `collection_status.py`'s scan surfaces that value for the UI to read. The legacy `type` field is preserved verbatim on every save (per spec clarification), never exposed for editing. **User explicitly requested TDD**: every new/changed unit gets a failing test first, per this repo's existing per-module test pairing (`*.test.ts` / `*.test.tsx` / `test_*.py`).

## Technical Context

**Language/Version**: TypeScript (Electron 32 main/renderer/preload, Node runtime bundled with Electron) for the header editor and IPC; Python 3 (matching the existing `scripts/`/`scripts/lib/` conversion-pipeline code) for the collection-level `metadata.yaml` read/write.
**Primary Dependencies**: No new dependency in either language. Frontmatter parsing/serialization is a small hand-rolled module (the format is a flat `key: "value"` list, already hand-parsed the same way by Python's `load_collection_meta`/`patch_citation_types.py`) — adding `yaml`/`js-yaml` would be unjustified weight for a fixed, already-understood format. Reuses `SourceType` (already defined in `src/shared/ipc-types.ts`) as the citation-type vocabulary, and the existing `spawn('python3', …)` pattern in `src/main/ipc/collections.ts` for the new collection-metadata write.
**Storage**: The YAML frontmatter block at the top of each `wiki/**/*.md` file (per-file header); `collections/<name>/metadata.yaml` (collection-level `citation_type` default). No SQLite involvement.
**Testing**: Jest (`src/main/**/*.test.ts` node env, `src/renderer/**/*.test.tsx` jsdom) + pytest (`tests/unit/`, `tests/integration/`). **TDD explicitly requested** — failing tests are written first for every unit below:
  - `src/shared/wiki-header-schema.test.ts` (NEW) — schema table shape + `validateHeader()`
  - `src/main/ipc/wiki-search.test.ts` (extend) — frontmatter parse/serialize, structured `WIKI_GET_HEADER`/`WIKI_SAVE_HEADER`, validation rejection, `type` preserved verbatim
  - `src/main/ipc/collections.test.ts` (extend) — `COLLECTIONS_SET_CITATION_TYPE` handler
  - `src/renderer/components/Settings/CollectionsManagementPage.test.tsx` (extend) — per-type field rendering, blocked save on invalid input, collection citation-type `<select>` wiring
  - `tests/unit/test_collection_status.py` (extend) — `scan()` surfaces each collection's `citation_type`
  - `tests/unit/test_wiki_convert.py` (extend) — new `set_collection_citation_type()` patches `metadata.yaml` in place, preserving `organization`/`files:`/comments
**Target Platform**: Electron desktop app (macOS primary), local filesystem only — no network/external consumer.
**Project Type**: Hybrid Electron app + Python conversion-pipeline scripts, matching the existing split already established by `specs/013-research-and-citation` (the app owns `wiki/*.md` I/O directly; `collections/` metadata and PDF conversion stay in Python).
**Performance Goals**: Form open/edit/save operates on a single small file each time (frontmatter read/write, or one `metadata.yaml` patch) — well under 1 second, no batch or bulk path introduced.
**Constraints**: The renderer MUST NOT construct raw YAML text — all frontmatter serialization happens in the main process from structured field values, which is what eliminates the "malformed header" failure class (FR-005/FR-006). The legacy `type` field is round-tripped byte-for-byte, never derived or edited (FR-011). Changing a collection's default citation type MUST NOT touch already-converted files (FR-009).
**Scale/Scope**: ~24 collections, ~1,300 converted wiki files. Touches: `src/shared/wiki-header-schema.ts` (new), `src/shared/ipc-types.ts`, `src/main/ipc/wiki-search.ts`, `src/main/ipc/collections.ts`, `src/main/preload.ts`, `src/renderer/hooks/useIpc.ts`, `src/renderer/components/Settings/CollectionsManagementPage.tsx`, `scripts/lib/collection_status.py`, `scripts/lib/wiki_convert.py`, `scripts/set_collection_citation_type.py` (new).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Source of truth identified** (Principle I): `wiki/**/*.md` frontmatter and `collections/<name>/metadata.yaml` are the canonical inputs/outputs named in the spec's Source of Truth section; no remote system is involved.
- [x] **Test-first scope identified** (Principle II): User explicitly requested TDD. Failing tests planned first for all six units listed under Testing above, spanning `src/shared/`, `src/main/ipc/`, `src/renderer/components/Settings/` (Jest) and `scripts/lib/` (pytest) — matching this repo's existing per-module pairing.
- [x] **External contract coverage** (Principle III): N/A for out-of-repo consumers (none — Source of Truth section confirms headers are consumed only by this app's own search/citation features). This feature does change two *internal* IPC contracts, documented in `contracts/wiki-header-ipc.md` and `contracts/collections-citation-type-ipc.md`, following the same internal-contract convention used in `specs/012-shelter-slug-rename/contracts/shelters-update-ipc.md`.
- [x] **Idempotency and auditability** (Principle IV): N/A in the batch-import/sync sense — this is direct, single-file/single-collection operator edits, not a rerunning batch workflow (spec Assumptions). Saving identical values twice is a no-op overwrite with byte-identical output.
- [x] **Minimal-change fit** (Principle V): All changes stay within `scripts/`, `scripts/lib/`, `tests/unit/` (Python side, literal constitution paths) and the existing `src/shared/`, `src/main/ipc/`, `src/main/preload.ts`, `src/renderer/components/Settings/`, `src/renderer/hooks/` trees already used by the sibling collections/wiki feature (`specs/013-research-and-citation`) on the Electron side. No new top-level directory, no new npm or pip dependency.
- [x] **WordPress/theme boundary respected** (Principle V/III): N/A — no theme or WordPress surface touched.

No violations. Complexity Tracking section left empty.

## Project Structure

### Documentation (this feature)

```text
specs/014-wiki-header-schema-form/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── wiki-header-ipc.md
│   └── collections-citation-type-ipc.md
└── tasks.md
```

### Source Code (repository root)

```text
src/shared/
├── wiki-header-schema.ts               # NEW: per-SourceType field schema table + validateHeader()
└── wiki-header-schema.test.ts          # TDD: failing tests first

src/shared/ipc-types.ts                 # CollectionStatus gains citationType: string | null;
                                         #   WIKI_GET_HEADER/WIKI_SAVE_HEADER payload types become
                                         #   structured; new COLLECTIONS_SET_CITATION_TYPE channel
                                         #   + request/result types

src/main/ipc/
├── wiki-search.ts                      # NEW parseFrontmatter()/serializeFrontmatter(); WIKI_GET_HEADER
│                                        #   returns structured fields + preserved `type`; WIKI_SAVE_HEADER
│                                        #   accepts structured fields, validates via wiki-header-schema,
│                                        #   writes `type` back unchanged
├── wiki-search.test.ts                 # TDD: failing tests first (parse/serialize round-trip,
│                                        #   validation rejection, type preserved, body untouched)
├── collections.ts                      # NEW: COLLECTIONS_SET_CITATION_TYPE handler shells out to
│                                        #   scripts/set_collection_citation_type.py
└── collections.test.ts                 # TDD: failing tests first

src/main/preload.ts                     # wiki.getHeader/saveHeader signatures updated;
                                         #   collections.setCitationType added
src/renderer/hooks/useIpc.ts            # test-mode stubs updated to match new signatures

src/renderer/components/Settings/
├── CollectionsManagementPage.tsx       # HeaderEditorDialog replaced with schema-driven form
│                                        #   (one control per applicable property); collection row
│                                        #   gets a citation-type <select> wired to setCitationType
└── CollectionsManagementPage.test.tsx  # TDD: failing tests first (fields per citation type,
                                         #   validation blocks save, collection select wiring)

scripts/lib/
├── collection_status.py                # scan() adds citation_type per collection via the
│                                        #   already-existing load_collection_meta() read
└── wiki_convert.py                     # NEW: set_collection_citation_type(collection_dir, value) —
                                         #   targeted line patch of metadata.yaml (mirrors
                                         #   patch_citation_types.py's technique), preserves
                                         #   organization/files:/comments

scripts/
└── set_collection_citation_type.py     # NEW: thin CLI wrapper, mirrors collection_status.py's shape

tests/unit/
├── test_collection_status.py           # TDD: extend — citation_type surfaced in scan() output
└── test_wiki_convert.py                # TDD: extend — set_collection_citation_type patches/preserves
                                         #   metadata.yaml correctly, including no-file-yet case
```

**Structure Decision**: This is the same hybrid Electron-app-plus-Python-scripts split already established by `specs/013-research-and-citation`: the app owns `wiki/*.md` reads/writes directly (no Python round-trip needed there), while `collections/` metadata stays in Python next to the existing `metadata.yaml` parser/patcher it already owns. No `database/migrations/` or new top-level directory is touched — this feature has no SQLite involvement.

## Complexity Tracking

*No constitution violations — section intentionally left empty.*
