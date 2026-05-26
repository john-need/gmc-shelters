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
  quote       TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (shelter_id, source_id)
);
```

Bibliographic metadata lives once in `sources`. Per-citation context (`annotation`, `notes`, `quote`) lives on `shelter_sources`. `quote` is a verbatim extract from the source relevant to the specific shelter being cited.

## Consequences

- A Source can be cited by any number of Shelters without duplicating data.
- `sources.annotation` and `sources.notes` are dropped and replaced by the equivalent columns on `shelter_sources`.
- `quote` was added to `shelter_sources` (not `sources`) following the same rationale: the verbatim extract cited as evidence is specific to a particular shelter, not a property of the bibliographic record itself. The same source can yield different relevant passages for different shelters.
- Existing data has zero rows in `sources`, so there is no data to migrate.
- Any code constructing citations must JOIN through `shelter_sources`.

