# Research: Map Markers Tab

**Branch**: `003-map-markers-tab` | **Date**: 2026-05-16

---

## Decision 1: Coverage Validation Layer

**Decision**: Year-range coverage validation (FR-011) is enforced at the IPC handler layer, not the database layer.

**Rationale**: SQLite CHECK constraints cannot express the "no-gaps across a set of rows" invariant without triggers, which would complicate migrations and testing. The existing IPC handler pattern (all business logic in `src/main/ipc/`) already handles this kind of pre-save validation for other rules (e.g., coordinate range checking). Keeping validation in the handler keeps migrations simple and keeps all write-path logic testable in Node.js without a running Electron process.

**Alternatives considered**:
- SQL triggers: rejected — complex to write, impossible to unit-test with in-memory SQLite in Jest without re-running the trigger logic
- Renderer-side validation: rejected — the server (main process) is the last defense before persistence; renderer validation alone is insufficient

---

## Decision 2: `change_type` Storage Format

**Decision**: `change_type` is stored as a single `TEXT` column. Standard picklist values are stored verbatim (`"Original"`, `"Relocated"`, etc.). When the user selects "Other" and enters custom text, the value is stored as `"Other: <custom text>"` (colon-space delimiter). The UI reconstructs the two parts on load by splitting on `": "` at the first occurrence.

**Rationale**: A single column is the simplest schema that supports both the picklist and the "Other" escape hatch without adding a second column or a JOIN. The delimiter format is unambiguous because standard picklist values contain no colon.

**Alternatives considered**:
- Separate `change_type` + `change_type_custom` columns: rejected — doubles schema complexity for a rare case
- JSONB: rejected — overkill, not in use elsewhere in the project

---

## Decision 3: Denormalized Field Sync (FR-012)

**Decision**: When the shelter UPDATE IPC handler saves a shelter record, it immediately follows the shelter `UPDATE` with:

```sql
UPDATE map_markers
SET slug = ?, is_extant = ?, photo_id = ?
WHERE shelter_id = ?
```

This runs in the same synchronous `better-sqlite3` call chain (no separate IPC round-trip). The sync is a plain `UPDATE` — safe to run zero times (no markers) or N times (N markers). It is idempotent.

**Rationale**: Piggy-backing on the existing shelter save is the lowest-friction place to ensure consistency. There is no separate "sync markers" command, so archivists cannot forget to run it. The `better-sqlite3` synchronous API means the shelter row and its marker copies are always updated in the same JavaScript event loop tick.

**Alternatives considered**:
- SQLite triggers: rejected — same testability concerns as Decision 1
- Separate IPC channel `MAP_MARKERS_SYNC`: rejected — creates a two-step save that archivists could miss

---

## Decision 4: IPC Channel Set

**Decision**: Four new channels:

| Channel constant | Description |
|---|---|
| `MAP_MARKERS_GET_BY_SHELTER` | Fetch all markers for a shelter (ordered by start_year) |
| `MAP_MARKERS_CREATE` | Insert a new marker; run coverage validation first |
| `MAP_MARKERS_UPDATE` | Update user-editable fields; run coverage validation first |
| `MAP_MARKERS_DELETE` | Delete a marker; warn on gap but proceed if confirmed |

Shelter sync (FR-012) is handled inside the existing `SHELTERS_UPDATE` handler — no new channel.

**Rationale**: Mirrors the four-channel pattern of `sources` and `photos`. Coverage validation lives inside CREATE and UPDATE handlers, not as a separate channel, keeping the API surface minimal.

---

## Decision 5: `activeTab` Union Extension

**Decision**: Add `'markers'` to the `activeTab` discriminated union in `uiSlice.ts`. The new value must also be added to the `MainPane` tab array and the `UiState` type.

**Rationale**: The existing pattern in `uiSlice.ts` uses a string literal union (`'shelter' | 'history' | 'sources' | 'photos'`). Extending it is the only way to make TypeScript enforce tab identity across the app.

---

## Decision 6: End Year Null Handling for "Present" Display

**Decision**: A null `end_year` on a marker is permitted only when `shelter.is_extant = true` AND the marker is the chronologically last one for the shelter (highest `start_year`). The IPC create/update handlers enforce this. In the UI, a null `end_year` is displayed as "present".

**Rationale**: Directly implements FR-009 from the spec. The renderer displays "present" rather than an empty string to make the temporal meaning clear.
