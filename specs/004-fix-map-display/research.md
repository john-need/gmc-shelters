# Research: Map Markers — Map Section Display

**Feature**: 004-fix-map-display | **Date**: 2026-05-20

---

## 1. Root Cause: Why the Map Does Not Auto-Fit

**Decision**: The map renders correctly but the viewport never moves from its hard-coded initial
centre (`[44.0, -71.5], zoom 13`). No `fitBounds` or `flyToBounds` call exists after markers load.

**Rationale**: The "sync marker pins" `useEffect` adds Leaflet `Marker` objects to the map
correctly, but stops there. On first mount `markers` is `[]` (the IPC load is async), so when
markers arrive the effect re-runs and pins are placed — but the viewport has already been fixed by
the initialisation effect and is never updated.

**Alternatives considered**:
- Calling `fitBounds` inside the init effect — rejected, because markers may not have loaded yet.
- Re-initialising the map each time markers change — rejected, heavyweight; would destroy and
  recreate the whole DOM element on every shelter switch.

---

## 2. Leaflet 2.0.0-alpha.1 API Assessment

**Decision**: The `new L.Map()`, `new L.TileLayer()`, `new L.Marker()`, `new L.DivIcon()`
constructor API used in the current component is correct for Leaflet 2.0. The library no longer
exposes lowercase factory aliases (`L.map()`, `L.marker()`, etc.) but the existing code already
uses the uppercase constructor form.

**Rationale**: Inspected `node_modules/leaflet/dist/leaflet-src.js`. The `L` default export
contains `Map`, `TileLayer`, `Marker`, `DivIcon`, `LatLngBounds`, etc. as direct class references.
The component's import `import L from 'leaflet'` is valid.

**Key APIs confirmed available in 2.0**:

| Method | Signature | Notes |
|--------|-----------|-------|
| `map.flyToBounds` | `(bounds, { maxZoom?, padding?, animate? })` | Animated fit — use for multi-pin case |
| `map.flyTo` | `(latlng, zoom?)` | Animated centre — use for single-pin and default view |
| `map.fitBounds` | `(bounds, { maxZoom? })` | Instant fit — not used (FR-010 requires animation) |
| `map.invalidateSize` | `()` | Re-measures container after layout change |
| `LatLngBounds.extend` | `(latlng)` | Extend bounds point by point |
| `fitBounds.maxZoom` | option | Caps zoom — FR-011 requires `maxZoom: 15` |
| `fitBounds.padding` | `[px, px]` | Visual breathing room around pins |

**Alternatives considered**:
- Switching to named imports `import { Map, TileLayer } from 'leaflet'` — unnecessary complexity;
  default `L` namespace works identically.

---

## 3. Leaflet 2.0 Types Gap

**Decision**: Keep `@types/leaflet@^1.9.21` (1.x types). Add targeted `as unknown as` casts only
where Leaflet 2.0 exports diverge from 1.x types — specifically `L.LatLngBounds` constructor call
for building bounds from an array of `[lat, lng]` tuples.

**Rationale**: The 1.9.x types cover the stable API surface used here. TypeScript errors in the
component are confined to the `new L.LatLngBounds()` constructor signature. A narrow cast is
preferable to upgrading or patching `@types/leaflet`, which is a test-infrastructure concern rather
than a product concern.

**Alternatives considered**:
- Install `@types/leaflet@^2.0.0` — no such package exists yet (Leaflet 2.0 is alpha).
- Write a local `leaflet.d.ts` augmentation — overkill for a two-line type gap.

---

## 4. Auto-Fit Strategy

**Decision**: Three distinct fit strategies keyed on marker count:

| Markers | Method | Zoom |
|---------|--------|------|
| 0 | `map.flyTo([44.0, -71.5], 8)` | 8 — NH/VT region overview |
| 1 | `map.flyTo([lat, lng], 15)` | 15 — neighbourhood close-up |
| ≥ 2 | `map.flyToBounds(bounds, { maxZoom: 15, padding: [30, 30] })` | capped at 15 |

**Rationale**: `flyToBounds` on a single-point `LatLngBounds` produces a degenerate bounding box
(width = 0, height = 0) that causes Leaflet to default to its maximum tile zoom (~19), violating
FR-011. Using `flyTo` directly for the single-marker case is explicit and correct. Default zoom 8
shows the shelter region without committing to a specific town.

**Alternatives considered**:
- Always use `flyToBounds` and manually pad a tiny bounding box for single pins — fragile; depends
  on undocumented internal clamping behaviour.
- Cap via `map.setMaxZoom(15)` globally — too broad; prevents user from manually zooming in past 15
  after the auto-fit runs.

---

## 5. Two-Way Pin ↔ List Selection (FR-009)

**Decision**: 
- **Pin → list**: already implemented (`setSelectedId` on pin `click` event). No change needed.
- **List → map**: call `map.flyTo([m.latitude, m.longitude], Math.max(map.getZoom(), 15))` directly
  in the list row `onClick` handler (and in the detail-panel action handlers). This is explicit and
  avoids the need for a ref-based source-tracking flag.

**Rationale**: The two directions have different desired side-effects. A pin click does not need to
pan the map (the pin is already visible). A list row click should centre on the selected pin because
the user may be looking at a different part of the map. Adding the `flyTo` call directly to the list
handlers makes the intent unambiguous without re-creating `selectedId` watch logic.

**Alternatives considered**:
- `useEffect` watching `selectedId` with a `lastClickSourceRef` flag — works but the hidden ref
  makes the code harder to trace. Direct handler call is simpler.
- Always pan on `selectedId` change (both pin and list) — a pin click would cause the map to
  "jump" even though the user just clicked something they could see, which is disorienting.

---

## 6. Leaflet Mock Update

**Decision**: Extend `src/renderer/__mocks__/leaflet.ts` to add `flyToBounds`, `flyTo`, `getZoom`
stubs to `mapStub`. These are `jest.fn()` so tests can assert they were called with the right args.

**Rationale**: Tests for the new auto-fit behaviour need to spy on `flyToBounds`/`flyTo`. The
existing mock lacks these methods, so calling them would throw `TypeError: map.flyToBounds is not a
function` in jsdom tests.

---

## 7. No Data Model, IPC, or Operator Changes

**Decision**: This feature requires no SQLite migration, no new IPC channels, and no new operator
steps.

**Rationale**: All coordinates are already persisted in `map_markers` and surfaced via
`state.mapMarkers.byShelter[shelterId]`. The fix is entirely in the renderer layer.
