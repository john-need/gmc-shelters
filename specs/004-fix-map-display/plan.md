# Implementation Plan: Map Markers — Map Section Display

**Branch**: `004-fix-map-display` | **Date**: 2026-05-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-fix-map-display/spec.md`

## Summary

The map in `MapMarkersTab` renders at a hard-coded centre/zoom and never adjusts to show the
shelter's markers. The fix adds a `fitMapToBounds` helper that is called after every marker-set
change, using Leaflet 2.0's `flyToBounds` (animated, maxZoom 15) for multiple pins and `flyTo`
for the single-pin and no-markers cases. Two-way pin↔list selection sync is completed by adding
explicit `map.flyTo` calls to the list row and detail-panel click handlers.

## Technical Context

**Language/Version**: TypeScript (ESM), Node.js 20 / Electron 32  
**Primary Dependencies**: `leaflet@2.0.0-alpha.1` (already installed), `@types/leaflet@^1.9.21`
(1.x types retained — see research.md §3), React 18, Redux Toolkit, Vite + electron-forge  
**Storage**: N/A — no database or migration changes  
**Testing**: Jest renderer project (jsdom environment); existing mock at
`src/renderer/__mocks__/leaflet.ts` extended with `flyToBounds`, `flyTo`, `getZoom`  
**Target Platform**: macOS desktop (Electron 32, contextIsolation: true)  
**Project Type**: Desktop application (archival data management)  
**Performance Goals**: `flyToBounds`/`flyTo` calls are O(1) over marker count; the bounding-box
build is O(n) where n ≤ 5.  
**Constraints**: Leaflet 2.0 removed lowercase factory aliases — component already uses uppercase
constructors. `@types/leaflet` 1.x types require a narrow cast for `LatLngBounds` construction.  
**Scale/Scope**: ~200 shelters × 1–5 markers each; renderer-only change.

## Constitution Check

- [x] Source of truth identified: `map_markers` rows via `state.mapMarkers.byShelter[shelterId]`
  (Redux); no new tables or migrations.
- [x] Test-first scope identified: failing tests planned before implementation for
  `fitMapToBounds` behaviour, list→map pan, and mock extension.
- [x] External contract coverage identified: N/A — no new IPC channels or out-of-repo consumers.
- [x] Idempotency and auditability identified: N/A — renderer-only; no sync side effects.
- [x] Minimal-change fit identified: two files changed (`MapMarkersTab.tsx`, `leaflet.ts` mock);
  no new directories or top-level additions.
- [x] WordPress/theme boundary respected: N/A — desktop app only.

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-map-display/
├── plan.md          ← this file
├── spec.md
├── research.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/renderer/
├── __mocks__/
│   └── leaflet.ts                      EDIT — add flyToBounds, flyTo, getZoom to mapStub
└── components/MainPane/tabs/
    └── MapMarkersTab.tsx               EDIT — fitMapToBounds helper, sync-pins effect,
                                                 list row onClick, detail-panel onClick

tests/
└── src/renderer/components/MainPane/tabs/
    └── MapMarkersTab.test.tsx          EDIT — new tests for auto-fit and list→map pan
```

**Structure Decision**: All changes are within the existing renderer source tree. No new files
required.

## Complexity Tracking

> No Constitution Check violations.

---

## Implementation Detail

### `fitMapToBounds(map, markers)` helper

```typescript
function fitMapToBounds(map: L.Map, markers: MapMarker[]): void {
  if (markers.length === 0) {
    map.flyTo([44.0, -71.5] as L.LatLngExpression, 8);
    return;
  }
  if (markers.length === 1) {
    map.flyTo([markers[0].latitude, markers[0].longitude] as L.LatLngExpression, 15);
    return;
  }
  const bounds = markers.reduce<L.LatLngBounds>(
    (b, m) => b.extend([m.latitude, m.longitude] as L.LatLngExpression),
    new L.LatLngBounds(
      [markers[0].latitude, markers[0].longitude] as L.LatLngExpression,
      [markers[0].latitude, markers[0].longitude] as L.LatLngExpression,
    ),
  );
  map.flyToBounds(bounds, { maxZoom: 15, padding: [30, 30] as unknown as L.PointExpression });
}
```

Placed alongside the existing icon-factory helpers (before the component function).

### Sync-pins `useEffect` — add `fitMapToBounds` call

After the existing loop that adds pin markers to the map, append:

```typescript
fitMapToBounds(map, markers);
```

This fires on every change to `markers` (add/edit/delete) and on shelter switch (markers array is
replaced). Covers FR-002, FR-005, FR-006, FR-010, FR-011.

### List row `onClick` — add `map.flyTo`

In the marker row `onClick` and in the detail-panel "Edit" + header-click handlers, after
`setSelectedId(...)`, add:

```typescript
if (mapRef.current && m.id !== selectedId) {
  mapRef.current.flyTo(
    [m.latitude, m.longitude] as L.LatLngExpression,
    Math.max(mapRef.current.getZoom() ?? 15, 15),
  );
}
```

Covers FR-009 (list → map direction). Pin → list direction is already implemented.

### Leaflet mock update

Add to `mapStub` in `src/renderer/__mocks__/leaflet.ts`:

```typescript
flyToBounds: jest.fn().mockReturnThis(),
flyTo: jest.fn().mockReturnThis(),
getZoom: jest.fn(() => 13),
```

### TypeScript type notes

- `L.LatLngExpression` accepts `[number, number]` tuples — use `as L.LatLngExpression` casts.
- `LatLngBounds` constructor: `new L.LatLngBounds(sw, ne)` where sw/ne are `LatLngExpression`.
- `padding` for `flyToBounds` is typed as `L.PointExpression` in 1.9 types but actually accepts
  `[number, number]` at runtime — use `as unknown as L.PointExpression`.
- `map.getZoom()` returns `number` in 1.9 types (no null); safe to use directly.
