# Quickstart: Map Markers Tab

**Branch**: `003-map-markers-tab` | **Date**: 2026-05-16

This guide covers the key behaviors an implementer must understand before writing code. Read `research.md` and `data-model.md` first.

---

## Implementation Sequence

1. **Migration** — `database/migrations/003-add-map-markers-table.sql`
2. **Shared types** — extend `src/shared/ipc-types.ts` (MapMarker, MapMarkerInput, CHANGE_TYPES, new CHANNELS, mapMarkers in ElectronAPI)
3. **DB layer** — `src/main/db/map-markers.ts`
4. **IPC handlers** — `src/main/ipc/map-markers.ts` (coverage validation lives here)
5. **Shelter handler update** — `src/main/ipc/shelters.ts`: add denormalized sync after shelter UPDATE
6. **Main process wiring** — `src/main/index.ts`: register map-markers handlers
7. **Redux slice** — `src/renderer/store/mapMarkersSlice.ts`
8. **Store** — `src/renderer/store/index.ts`: add mapMarkers reducer
9. **UI slice** — `src/renderer/store/uiSlice.ts`: add `'markers'` to `activeTab` union
10. **MainPane** — add Map Markers tab entry to `tabs` array, add `loadMapMarkers` to the `useEffect`, render `<MapMarkersTab />` in `tab-body`
11. **Tab component** — `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx`
12. **Preload** — `src/main/preload.ts`: expose `window.api.mapMarkers`

---

## Year Coverage Validation (FR-011)

This is the most complex piece of the feature. The handler must:

1. Load all markers for the shelter (excluding the marker being saved, when editing).
2. Add the proposed marker to the in-memory list.
3. Sort by `start_year` ascending.
4. Check for duplicate `start_year` values — reject if any two markers share the same `start_year`.
5. Check `markers[0].start_year === shelter.start_year`.
6. For each consecutive pair, require **exact adjacency**: `markers[i].end_year === markers[i+1].start_year`. Strict equality — greater than is an overlap, less than is a gap.
7. Last marker: `end_year === shelter.end_year` (or `null` if `shelter.is_extant`).

**Gap example**:
```
shelter: start_year=1960, end_year=1990, is_extant=false
markers:
  1960–1970  ← OK
  1975–1990  ← GAP: 1971–1974 uncovered
```
Return error: `"Year range 1971–1974 is not covered by any map marker."`

**Overlap example**:
```
shelter: start_year=1960, end_year=1990, is_extant=false
markers:
  1960–1975  ← OK
  1970–1990  ← OVERLAP: 1970–1974 covered by both markers
```
Return error: `"Markers 1960–1975 and 1970–1990 overlap between 1970 and 1974."`

**Delete gap warning** (FR-006): On `MAP_MARKERS_DELETE`, run the same coverage check after removing the marker. If a gap would result, return a structured response with `{ gapWarning: true, uncoveredRange: string }` — the renderer shows a confirm dialog and must re-call delete with `{ confirmed: true }` to proceed.

---

## change_type "Other" Encoding

Storage: `"Other: <custom text>"` (e.g., `"Other: Seasonal relocation"`)

UI logic:
```ts
function splitChangeType(raw: string): { base: string; custom: string } {
  if (raw.startsWith('Other: ')) {
    return { base: 'Other', custom: raw.slice(7) };
  }
  return { base: raw, custom: '' };
}
```

On save, combine: `changeType === 'Other' ? \`Other: \${customText}\` : changeType`

---

## Denormalized Sync in SHELTERS_UPDATE

After the shelter row is updated, immediately run (same synchronous chain):

```ts
db.prepare(`
  UPDATE map_markers SET slug = ?, is_extant = ?, photo_id = ?
  WHERE shelter_id = ?
`).run(shelter.slug, shelter.is_extant ? 1 : 0, shelter.default_photo_id, shelter.id);
```

This is safe when the shelter has zero markers — `run()` affects 0 rows.

---

## Redux Slice Shape

```ts
interface MapMarkersState {
  byShelter: Record<number, MapMarker[]>; // keyed by shelter_id
  loading: boolean;
  error: string | null;
}
```

Mirrors the `sourcesSlice` and `photosSlice` pattern.

---

## Preload Bridge

```ts
// src/main/preload.ts — add inside exposeInMainWorld
mapMarkers: {
  getByShelter: (id: number) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_GET_BY_SHELTER, id),
  create:       (input) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_CREATE, input),
  update:       (id, input) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_UPDATE, id, input),
  delete:       (id, opts) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_DELETE, id, opts),
},
```

---

## Tab Count Badge

The tab label must read `Map Markers (N)` — matching the Sources and Photos pattern:

```tsx
{
  id: 'markers' as const,
  label: 'Map Markers',
  count: markers.length,
}
```

Fetch `markers` from `state.mapMarkers.byShelter[s.id] ?? []` in `MainPane`.

---

## Empty State

When `markers.length === 0`, the tab body renders:

```
No map markers recorded.
[Add First Marker] button
```

---

## Displaying "present"

```tsx
{marker.end_year ?? 'present'}
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `database/migrations/003-add-map-markers-table.sql` | Schema |
| `src/shared/ipc-types.ts` | Types + CHANNELS (edit existing) |
| `src/main/db/map-markers.ts` | DB CRUD |
| `src/main/ipc/map-markers.ts` | IPC handlers + coverage validation |
| `src/main/ipc/shelters.ts` | Add denormalized sync (edit existing) |
| `src/main/index.ts` | Register handlers (edit existing) |
| `src/main/preload.ts` | Expose bridge (edit existing) |
| `src/renderer/store/mapMarkersSlice.ts` | Redux slice |
| `src/renderer/store/index.ts` | Add reducer (edit existing) |
| `src/renderer/store/uiSlice.ts` | Add 'markers' to activeTab (edit existing) |
| `src/renderer/components/MainPane/MainPane.tsx` | Add tab (edit existing) |
| `src/renderer/components/MainPane/tabs/MapMarkersTab.tsx` | Tab component |
| `src/main/db/map-markers.test.ts` | DB unit tests |
| `src/main/ipc/map-markers.test.ts` | Handler unit tests |
| `src/renderer/store/mapMarkersSlice.test.ts` | Slice unit tests |
| `src/renderer/components/MainPane/tabs/MapMarkersTab.test.tsx` | Component tests |
