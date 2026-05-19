# ADR 0003 — `shelters.start_year`/`end_year` Are Constraint Boundaries, Not Derived Values

Date: 2026-05-18  
Status: Accepted

## Context

Both the `shelters` table and the `map_markers` table carry `start_year`/`end_year` columns. This raised the question of whether the Shelter values are redundant, derivable as `MIN`/`MAX` of its Map Markers.

## Decision

`shelters.start_year` and `shelters.end_year` are **authoritative facts** about when a Shelter was built and when it ceased to exist. They are **constraint boundaries** that govern what Map Markers are valid for a Shelter:

- A Map Marker's `start_year` must be ≥ the Shelter's `start_year`.
- A Map Marker's `end_year` must be ≤ the Shelter's `end_year`.
- Map Marker time windows must be contiguous with no gaps.
- Extant Shelters (`is_extant = true`) have no `end_year`; their last Map Marker also has no `end_year`.

These columns are **not removed** from `shelters`.

## Consequences

- Map Marker windows are always validated against Shelter lifespan, not the other way around.
- The default state (one Map Marker per Shelter) has the marker's `start_year`/`end_year` equal to the Shelter's. More markers may be added later as historical detail is researched.
- Application logic and database constraints must enforce no gaps and no out-of-bounds markers.

