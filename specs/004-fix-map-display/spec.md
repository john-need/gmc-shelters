# Feature Specification: Map Markers — Map Section Display

**Feature Branch**: `004-fix-map-display`
**Created**: 2026-05-20
**Status**: Draft
**Input**: Map markers should be displayed in the map section. Map is currently not working. The zoom should be just big enough to show all the shelter markers.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View all shelter markers on the map (Priority: P1)

A researcher opens the Map Markers tab for a shelter and sees all of that shelter's historical location pins automatically visible on the map at once — no manual panning or zooming required. The map zooms to fit exactly the set of pins for the currently selected shelter.

**Why this priority**: The whole point of the map section is to show where shelters have been located over time. If the map fails to render or shows the wrong region, the tab provides no geographic value.

**Independent Test**: Select a shelter that has at least two markers in different locations. Open the Map Markers tab. Without any user interaction, all marker pins must be visible simultaneously on the map. Change to a different shelter — the map must refit to the new shelter's markers automatically.

**Acceptance Scenarios**:

1. **Given** a shelter is selected with one or more markers, **When** the Map Markers tab is opened, **Then** an interactive map is displayed in the right-hand pane with all marker pins visible, and the viewport is zoomed to the minimum level that contains all pins.
2. **Given** a shelter has exactly one marker, **When** the tab is opened, **Then** the map centres on that single pin at a close but not overly zoomed level.
3. **Given** a shelter has no markers, **When** the tab is opened, **Then** the map displays a default regional view (no empty grey panel or error).
4. **Given** the user switches to a different shelter while the Map Markers tab is active, **When** the new shelter's markers are loaded, **Then** the map re-fits to show the new shelter's pins without requiring any user action.
5. **Given** the researcher clicks a numbered pin on the map, **When** the click registers, **Then** the corresponding row in the left-hand list is selected and highlighted.
6. **Given** the researcher clicks a row in the left-hand list, **When** the row is selected, **Then** the corresponding pin on the map is highlighted and the map viewport centres on that pin.

---

### User Story 2 — Map updates when markers change (Priority: P1)

An archivist adds a new marker. Without reloading the tab, the new pin appears on the map and the map re-fits its viewport to include the new pin alongside the existing ones.

**Why this priority**: Stale map state after a save undermines trust in the tool and forces the archivist to navigate away and back to see current data.

**Independent Test**: With two existing markers on the map, add a third marker in a location outside the current viewport. The map must refit to include the new pin without a tab reload.

**Acceptance Scenarios**:

1. **Given** a marker is saved (add or edit), **When** the save completes, **Then** the map immediately shows the updated or new pin and re-fits the viewport to contain all pins.
2. **Given** a marker is deleted, **When** the deletion completes, **Then** the deleted pin is removed from the map and the viewport re-fits to the remaining pins (or shows the default view if none remain).

---

### Edge Cases

- What if all markers share the exact same coordinates? The map centres on that point at zoom level 15 (the maximum auto-fit zoom) rather than producing a degenerate bounding box.
- What if coordinates are at the geographic extremes (e.g., near the poles)? The map renders without distortion artefacts and pins are still visible.
- What if the map container has zero height or is not yet mounted in the DOM? The map must not throw an error; it initialises as soon as the container is available and has non-zero dimensions.
- What if the internet connection is unavailable and tile images cannot be fetched? The map UI still renders (pins, controls, container) — missing tiles are expected degradation, not an application failure.

---

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: `map_markers` rows (latitude, longitude) already in the local SQLite database, surfaced via the existing `state.mapMarkers.byShelter[shelterId]` Redux state slice.
- **Derived Outputs**: No new file-system outputs. The map is a read-only visualisation layer over existing stored coordinates.
- **Out-of-Repo Consumers**: None for this feature.

### Contracts & Operations

- **Contract Artifacts**: N/A — the map reads from the same `window.api.mapMarkers` IPC contract defined in spec 003.
- **Operator Documentation**: No new operator steps required; the map displays automatically as part of the Map Markers tab.
- **Theme/External Code Boundary**: N/A — desktop app only. Tile imagery is fetched from a public tile provider at runtime; no tile server is owned by this repository.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The right-hand pane of the Map Markers tab MUST render an interactive map that displays pins for all current shelter markers.
- **FR-002**: On initial load of the Map Markers tab for a shelter with one or more markers, the map MUST automatically fit its viewport to the minimum bounding area that contains all pins — no manual pan or zoom required.
- **FR-003**: When a shelter has exactly one marker, the map MUST centre on that pin at zoom level 15 (neighbourhood level — the same maximum used for auto-fit).
- **FR-004**: When a shelter has no markers, the map MUST display a sensible default regional view rather than a blank or error state.
- **FR-005**: When the selected shelter changes, the map MUST discard the previous shelter's pins and re-fit to the incoming shelter's markers without a tab reload.
- **FR-006**: When a marker is added, edited, or deleted, the map MUST update its pins and re-fit its viewport to reflect the current marker set immediately, with no manual refresh required.
- **FR-007**: Each marker pin on the map MUST be numbered to correspond with the chronological ordering of markers displayed in the left-hand list pane, so a researcher can cross-reference pin and list entry.
- **FR-008**: The map MUST remain interactive — users MUST be able to click the map to set coordinates when adding or editing a marker.
- **FR-009**: Pin and list selection MUST be two-way synchronised: clicking a map pin MUST select and highlight the corresponding row in the left-hand list; clicking a list row MUST highlight its pin on the map and centre the map viewport on that pin.
- **FR-010**: All viewport re-fit transitions (on tab open, shelter switch, marker add/edit/delete) MUST be animated — the map MUST smoothly fly or pan to the new bounds rather than snapping instantly.
- **FR-011**: The auto-fit zoom MUST be capped at a maximum of zoom level 15 (neighbourhood level). The map MUST NOT zoom closer than this even when all pins share very similar or identical coordinates.

### Key Entities

- **Map Pin**: A visual representation of a `MapMarker` record placed at the marker's (latitude, longitude) coordinates. Numbered according to the marker's chronological position in the shelter's marker set.
- **Viewport Fit**: The map state where all current shelter pins are simultaneously visible within the map container without manual interaction. Achieved by computing the bounding box of all pins and applying the minimum zoom that contains that box.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any shelter with two or more markers in distinct locations, all pins are simultaneously visible in the map viewport upon opening the tab — no pan or zoom is needed.
- **SC-002**: The map renders and shows a valid geographic view within the normal tab-open latency; no blank map panel or tile-loading error blocks use.
- **SC-003**: After adding, editing, or deleting a marker, the map reflects the change immediately (same interaction session, no tab reload required).
- **SC-004**: Switching between shelters updates the map to the correct shelter's pins every time, with 0% stale-pins incidents.
- **SC-005**: A shelter with no markers never causes the map to display an error state or empty grey panel — the default regional view is always shown instead.

---

## Clarifications

### Session 2026-05-20

- Q: When a researcher clicks a numbered pin on the map, should that action select and highlight the corresponding row in the left-hand marker list (and vice versa)? → A: Two-way sync — clicking a pin selects the list row; clicking a list row highlights its pin and centres the map on it.
- Q: When the map re-fits its viewport (on shelter switch, marker add/edit/delete), should the transition be animated or instant? → A: Animated — the map smoothly flies/pans to the new bounds (~0.5–1 s transition) in all re-fit cases.
- Q: Should the auto-fit be capped at a maximum zoom level to prevent zooming to street level when pins are very close together? → A: Yes — cap at zoom level 15 (neighbourhood level); the map never zooms closer than this even when all pins are nearly co-located.

---

## Assumptions

- The map container is already present in `MapMarkersTab.tsx` (as established by spec 003); this feature corrects the initialisation and viewport-fitting behaviour, it does not add a new container.
- Map tile imagery is served by a public tile provider accessible at runtime; offline tile caching is out of scope.
- The map library version constraint (`2.0.0-alpha.1`) is an implementation concern tracked in the plan, not a spec-level requirement. The spec is technology-agnostic.
- The bounding-fit logic must handle the degenerate single-pin case gracefully; the library used must support this without manual padding calculations.
- No server-side or external integration is involved; the map renders entirely in the renderer process using locally-held coordinate data.
