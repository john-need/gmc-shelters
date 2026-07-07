# Data Model: History Panel View Toggle

## History View Mode Preference

A local, app-wide UI preference — not shelter data, not stored in SQLite.

| Field | Type | Values | Notes |
|---|---|---|---|
| view mode | `'source' \| 'both' \| 'preview'` | exactly these three strings | Persisted as the raw string value |

**Storage**: `localStorage` key `gmc.historyView`, plain string (no JSON wrapper needed — a single scalar, unlike the object-shaped `gmc.paths`/`gmc.publishing`).

**Default**: `'both'` — used when the key is absent, unreadable, or holds any value outside the three above (`normalizeHistoryViewMode()` falls back safely, mirroring `normalizeStoredPaths()`).

**Lifecycle / state transitions**: Simple three-state toggle, no ordering or transition restrictions — any mode can switch to any other mode directly (Source ↔ Both ↔ Preview, and Source ↔ Preview).

**Relationships**: None. It is independent of the currently selected shelter, the `historyContent`/`historyDirty`/`historyMissing` Redux state, and of any other tab. Switching shelters or tabs does not reset or scope this value (per spec.md's clarification).

**Validation rules**: Any value read from `localStorage` that is not exactly `'source'`, `'both'`, or `'preview'` (including `null`, malformed JSON, or a stray legacy value) MUST normalize to the default `'both'`, per FR-002 and the existing `normalize*` convention used elsewhere in this repo.
