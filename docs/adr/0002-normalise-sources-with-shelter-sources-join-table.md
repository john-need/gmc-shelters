# ADR 0002 — Normalise `sources` With a `shelter_sources` Join Table

Date: 2026-05-18  
Status: Accepted

## Context

The `sources` table had a `shelter_id` FK, making each bibliographic record belong to exactly one Shelter. A widely-cited reference (e.g., the Long Trail Guide) would need a separate row — with all bibliographic metadata duplicated — for every Shelter that cites it.

## Decision

Remove `shelter_id` from `sources`. Introduce a `shelter_sources` join table:

```sql
CREATE TABLE shelter_sources (
  shelter_id  INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  source_id   INTEGER NOT NULL REFERENCES sources(id)  ON DELETE CASCADE,
  annotation  TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (shelter_id, source_id)
);
```

Bibliographic metadata lives once in `sources`. Per-citation context (`annotation`, `notes`) lives on `shelter_sources`.

## Consequences

- A Source can be cited by any number of Shelters without duplicating data.
- `sources.annotation` and `sources.notes` are dropped and replaced by the equivalent columns on `shelter_sources`.
- Existing data has zero rows in `sources`, so there is no data to migrate.
- Any code constructing citations must JOIN through `shelter_sources`.

