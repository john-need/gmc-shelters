# Research: Schema-Driven Wiki Header Editor

No `NEEDS CLARIFICATION` markers remain in the Technical Context — the two open scope questions were resolved in `/speckit-clarify` (see spec.md's Clarifications section and Assumptions). This document records the implementation-approach decisions made while grounding the plan in the existing codebase.

## Decision: No new YAML dependency — hand-rolled frontmatter parse/serialize

**Decision**: Write a small `parseFrontmatter`/`serializeFrontmatter` pair in `src/main/ipc/wiki-search.ts` instead of adding `yaml` or `js-yaml`.

**Rationale**: The frontmatter format produced by `scripts/lib/wiki_convert.py`'s `okf_header()` is a flat list of `key: "value"` lines between `---` fences — no nesting, no lists, no YAML edge cases (anchors, multi-line scalars, etc.). Python already hand-parses/patches this exact format twice (`load_collection_meta`, `patch_citation_types.py`'s regex substitution) rather than using PyYAML. Matching that precedent keeps the two implementations symmetric and avoids a dependency whose generality (arbitrary YAML) this feature will never use.

**Alternatives considered**: `js-yaml` — rejected; correct for the 1% of YAML this doesn't need, and a full parse/re-serialize round-trip risks reformatting quoting/whitespace in ways that could show up as noisy diffs on every save.

## Decision: Main process owns serialization; renderer only ever sends/receives structured values

**Decision**: `WIKI_GET_HEADER` returns parsed field values (plus the citation type and the preserved raw `type` string) instead of the raw fenced text block; `WIKI_SAVE_HEADER` accepts structured field values and the main process is solely responsible for producing valid frontmatter text.

**Rationale**: This is the direct mechanism for FR-005/FR-006 ("without the risk of breaking the header format") — if the renderer can never construct the YAML text itself, it cannot produce malformed YAML, full stop. Validation against the schema (`wiki-header-schema.ts`, shared so main and renderer use the identical rules) happens before serialization, so an invalid save is rejected before any file write is attempted.

**Alternatives considered**: Keep the raw-text IPC contract and validate the renderer-constructed string against a regex per field — rejected; still lets a bug in string-building corrupt the file, and duplicates parsing logic on both sides of the IPC boundary for no benefit.

## Decision: Collection-level citation type lives in `metadata.yaml`, written via a targeted line patch

**Decision**: `set_collection_citation_type(collection_dir, value)` (new, in `scripts/lib/wiki_convert.py`) finds and replaces (or inserts) the top-level `citation_type: "..."` line in `metadata.yaml`, leaving `organization:`, `files:`, and any comments untouched — the same technique `scripts/patch_citation_types.py` already uses for markdown frontmatter.

**Rationale**: `load_collection_meta()` already reads any top-level scalar key generically, so `citation_type` is already readable with zero changes on that side — this only adds the write path. A full YAML parse-modify-serialize round-trip risks losing comments (e.g., `# TODO: verify author` in `collections/Books/metadata.yaml`) or reordering the `files:` block; a line-level patch does not.

**Alternatives considered**: Store the collection citation-type default somewhere in the Electron app's own storage (e.g., a JSON sidecar or SQLite) instead of `metadata.yaml` — rejected; `metadata.yaml` is already the established, Python-pipeline-readable source of truth for collection-level data (`organization`, per-file `author`/`title`), and the conversion pipeline (`wiki_convert.py`'s `okf_header()`) already reads `citation_type` from exactly this file. Splitting the setting into a second storage location would create two sources of truth for the same value.

## Decision: Header Schema is a static table keyed by `SourceType`, not user-configurable

**Decision**: The per-citation-type field applicability table (see `data-model.md`) is a fixed constant in `src/shared/wiki-header-schema.ts`, not something an operator can edit through the UI.

**Rationale**: The spec's citation-type vocabulary (`SourceType`, already defined in `src/shared/ipc-types.ts`) is itself fixed — the app doesn't support inventing new citation types, only choosing among the existing 12. A configurable schema-of-schemas would be scope well beyond "establish a schema for the header based on citation type," and the spec's Assumptions explicitly note only one citation type is active per file, with no mention of extensibility.

**Alternatives considered**: Loading the schema from a JSON/YAML config file for easier future tuning without a code change — rejected as premature; nothing in the spec asks for operator-editable schema, and the 12-type table is small enough to review and change in code same as any other constant.
