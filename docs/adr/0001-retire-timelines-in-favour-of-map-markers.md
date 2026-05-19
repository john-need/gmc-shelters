# ADR 0001 — Retire `timelines` in Favour of `map_markers`

Date: 2026-05-18  
Status: Accepted

## Context

Two tables stored the geographic location history of a Shelter:

- `timelines` — an earlier model with a single `year` (point-in-time), `latitude`, `longitude`, `name`, and `notes`. Contains 11 rows of real data.
- `map_markers` — a richer model with `start_year`/`end_year` (a range), `latitude`, `longitude`, `name`, `change_type`, `is_extant`, and a `photo_id`. Currently empty.

Keeping both tables means the same fact (where a shelter was at a given time) has two representations, creating a join-dependency violation and requiring every consumer to know which table is authoritative.

## Decision

`map_markers` is the single canonical store for Shelter location history. The 11 rows in `timelines` will be migrated into `map_markers` (mapping `timelines.year` → `map_markers.start_year`, inferring `end_year` where possible). The `timelines` table will then be dropped.

## Consequences

- All location-history queries target `map_markers` only.
- `shelters.latitude` and `shelters.longitude` are also dropped; current location is obtained by querying the active Map Marker (the one with no `end_year`, or the latest `end_year`).
- The migration must assign a `change_type` to each imported row (default: `'Original'`).
- Any code or scripts that read from `timelines` must be updated.

