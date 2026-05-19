# GMC Shelters — Domain Glossary

This file is a **glossary only**. No implementation details, no specs. Terms are added as they are resolved in grilling sessions.

---

## Shelter

A structure along the Long Trail (or historically associated with it) that provides overnight or day accommodation to hikers. A Shelter has a single canonical **Architecture** and a single **Category**. A Shelter's lifespan is expressed as `start_year` and optionally `end_year` (absent when the shelter is extant).

## Shelter Lifespan

The period from `start_year` to `end_year` (or open-ended when `is_extant = true`) during which a Shelter is considered to exist. This is an **authoritative constraint**, not a value derived from Map Markers.

## Map Marker

A geographic position (latitude/longitude) at which a Shelter was located during a specific time window (`start_year`→`end_year`). A Shelter always has at least one Map Marker. Map Marker time windows must be contiguous, must not precede the Shelter's `start_year`, and must not extend beyond its `end_year`. The last marker of an extant Shelter has no `end_year`.

## Change Type

The reason a new Map Marker was created for a Shelter. One of: `Original`, `Moved`, `Renamed`, `Moved & Renamed`. Enforced as a database CHECK constraint.

## Architecture

The structural/construction style of a Shelter (e.g., Adirondack, Log Cabin, Post and Beam). A Shelter has exactly one Architecture. Architecture is a controlled lookup — new styles require an entry in the `architectures` table.

## Category

The functional type of a Shelter (e.g., Lean To, Lodge, Camp, Inn). A Shelter belongs to exactly one Category. Category is a controlled lookup.

## Builder

The primary individual or organization responsible for constructing a Shelter. A Shelter has at most one Builder. The same Builder may be credited on many Shelters.

## Source

A bibliographic reference (book, article, website, archive, etc.) that documents facts about one or more Shelters. A Source's bibliographic metadata (title, publisher, year, author, etc.) is stored once; its association to specific Shelters is tracked via the `shelter_sources` join.

## Source–Shelter Association

The relationship between a Source and a Shelter, carried by the `shelter_sources` join table. Per-citation `annotation` and `notes` live on this association, not on the Source itself.

## Photo

An image associated with exactly one Shelter. A Shelter designates one Photo as its `default_photo`. A Map Marker may reference a Photo to show representative imagery for that historical location.

