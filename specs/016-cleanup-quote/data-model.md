# Data Model: Clean Up Quote

No schema changes. This feature reads and writes one existing column.

## Citation Source (existing entity, unchanged shape)

Backed by `sources` (bibliographic fields) joined to `shelter_sources` (per-shelter association fields, including `quote`). See `src/main/db/sources.ts`.

| Field | Table | Touched by this feature? |
|---|---|---|
| `quote` | `shelter_sources` | Yes — the only field this feature writes |
| `sources.updated` | `sources` | **No** — must NOT be bumped by a clean-up run (see research.md Decision 2); the existing `updateSource()` path bumps it and is deliberately not reused |
| all other `sources`/`shelter_sources` columns | both | No |

## New transient (non-persisted) renderer state

`sourcesSlice` state gains one field, not written to SQLite:

- `cleaningQuoteIds: number[]` — source IDs with an in-flight clean-up request. Added on thunk `pending`, removed on `fulfilled`/`rejected`. Drives the busy state on `SourceCard`'s button (FR-006).

`aiSettingsSlice` (new, research.md Decision 3) — also not persisted by this feature (it mirrors the existing `.anthropic_api_key` file already owned by `src/main/ipc/ai-settings.ts`):

- `apiKey: string` — the currently-loaded key value, used only to derive `selectHasValidApiKey`.

## Validation rules

- A quote is only clean-up-eligible when non-empty (FR-001, FR-004 depend only on key validity — presence of a quote gates whether the button renders at all).
- `isValidAnthropicKey(key)` (research.md Decision 4): `key.trim().length > 0 && key.trim().startsWith('sk-ant-')`. No live network check.

## State transitions (per source card's clean-up button)

```text
[quote empty]  -> no button rendered
[quote set, no/invalid key] -> disabled, title "Clean up quote (requires AI API key)"
[quote set, valid key]      -> enabled, title "Clean up quote"
        | click
        v
[busy] (cleaningQuoteIds includes this source id; button disabled + busy indicator)
   | success                              | failure
   v                                      v
quote field replaced,                original quote unchanged,
back to enabled/disabled per key     error toast shown,
state above                          back to enabled/disabled per key state above
```
