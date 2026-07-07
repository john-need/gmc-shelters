# ADR 0008 — Publication date stored as a validated freeform string

**Date**: 2026-07-06
**Status**: Accepted

## Context

The OKF header needed a publication date, but historical shelter-history sources cite
dates at different granularities: a full date, a bare year, a month-year, or a season
tied to a year (e.g. "Spring 1996"). A structured widget (separate granularity picker
plus matching sub-inputs) would model this precisely but adds real UI/test surface for
a field that's optional everywhere and edited rarely.

## Decision

`publication_date` is one text control (`HeaderControl: 'flexible-date'`), validated in
`validateHeader()` against a single regex accepting `YYYY-MM-DD`, `YYYY-MM`, `YYYY`, or
`"Season YYYY"` (Spring/Summer/Fall/Winter). It is optional for every citation type —
consistent with `volume`/`printed_volume`/`printed_issue` already being optional, since
not every historical source has a confirmed date. Same pattern as `language` becoming a
closed `select` (`en`, `fr`): validation lives centrally in the shared schema, not in the
renderer.

## Consequences

Malformed input is only caught on save (blocks Save, same as the existing number-control
behavior), not at the keystroke level. If a use case needs date-range math or sorting by
date later, this string will need a parser — not built now since nothing consumes it but
display.
