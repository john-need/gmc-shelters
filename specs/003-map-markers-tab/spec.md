# Feature Specification: Map Markers Tab

**Feature Branch**: `003-map-markers-tab`
**Created**: 2026-05-16
**Status**: Draft
**Input**: Add a "Map Markers" tab to the main pane for viewing and managing the historical location records of each shelter.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — View all map markers for a shelter (Priority: P1)

A researcher selects a shelter record in the sidebar. They click the "Map Markers" tab in the main pane to see all historical location entries associated with that shelter — where it was built, whether it moved, and when it was removed or replaced.

**Why this priority**: Location history is core archival data. Researchers need to know not just where a shelter is today but where it has been over time.

**Independent Test**: Select any shelter with at least one map marker. Navigate to the Map Markers tab and verify all associated markers appear with their name, coordinates, year range, and change type — ordered chronologically.

**Acceptance Scenarios**:

1. **Given** a shelter is selected and has one or more map markers, **When** the user opens the Map Markers tab, **Then** all markers are listed with name, latitude, longitude, start year, end year (or "present" when null), and change type.
2. **Given** a shelter has no map markers, **When** the user opens the Map Markers tab, **Then** an empty-state message is shown with a prompt to add the first marker.
3. **Given** multiple markers exist, **When** they are displayed, **Then** they are ordered chronologically by start year ascending.

---

### User Story 2 — Add a new map marker (Priority: P1)

An archivist discovers a historical map showing the original location of a shelter that has since been relocated. They open the Map Markers tab and add a new marker recording the original coordinates, the years it was active, and the change type (e.g., "Relocated").

**Why this priority**: Recording location history is the primary purpose of this feature.

**Independent Test**: On a shelter with a known year range, add a marker whose year range fills a gap in the coverage. Confirm the system accepts it and the coverage is now complete.

**Acceptance Scenarios**:

1. **Given** the user clicks "Add Marker", **When** they fill in name, latitude, longitude, start year, end year, and change type and save, **Then** the new marker appears in the list and is stored persistently.
2. **Given** the user leaves latitude or longitude empty, **When** they attempt to save, **Then** saving is blocked with a clear validation message.
3. **Given** the new marker would create a gap in year coverage, **When** the user attempts to save, **Then** saving is blocked and the gap is described (e.g., "Year range 1972–1979 is not covered").
4. **Given** the shelter's `is_extant` is true and this is the last marker, **When** the user leaves end year empty, **Then** the save is accepted and the marker displays "present".

---

### User Story 3 — Edit an existing map marker (Priority: P2)

An archivist realizes the recorded coordinates for a marker are slightly off after consulting a new historical source. They select the marker, update the latitude and longitude, and save.

**Why this priority**: Historical data requires correction over time as new sources surface.

**Independent Test**: Edit the latitude of an existing marker, save, and confirm the updated value is reflected in the list and persists across navigation.

**Acceptance Scenarios**:

1. **Given** a marker exists, **When** the user edits name, latitude, longitude, start year, end year, change type, or notes and saves, **Then** the updated values are shown and persisted.
2. **Given** the user starts editing and clicks Cancel, **When** returning to the list view, **Then** no changes are applied.
3. **Given** the user edits a year range such that a gap would be created in the shelter's coverage, **When** they attempt to save, **Then** saving is blocked and the gap is described.

---

### User Story 4 — Delete a map marker (Priority: P2)

A duplicate entry was accidentally created for the same location event. The archivist deletes the duplicate.

**Why this priority**: Data hygiene — accidental duplicates must be removable.

**Independent Test**: Delete a marker and confirm it no longer appears in the list for that shelter.

**Acceptance Scenarios**:

1. **Given** a marker exists, **When** the user chooses to delete it and confirms, **Then** it is removed from the list and from the database.
2. **Given** deleting a marker would create a gap in the shelter's year coverage, **When** the user attempts to delete, **Then** they are warned that a gap will result and must confirm before the deletion proceeds.
3. **Given** the user initiates a delete, **When** they cancel the confirmation prompt, **Then** the marker is not removed.

---

### Edge Cases

- What if latitude or longitude values are outside the valid geographic range (±90 / ±180)? The form validates and rejects out-of-range values before saving.
- What if a save or delete would leave a gap in year coverage? The system blocks the operation and displays which years are uncovered.
- What if the selected shelter changes while the Map Markers tab is active? The tab reloads with the markers for the newly selected shelter.
- What if the parent shelter's `slug`, `is_extant`, or `default_photo_id` changes? All map markers for that shelter have their corresponding denormalized fields updated automatically — no manual action required.
- What if a shelter has `is_extant = true` and all markers have a non-null end year? The coverage validation treats the shelter's end year as open (no upper bound required), so this is valid.

---

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: `map_markers` table in the local SQLite database. Fields: `id`, `shelter_id`, `latitude`, `longitude`, `name`, `start_year`, `end_year`, `is_extant`, `change_type`, `notes`, `photo_id`, `slug`.
- **Derived Outputs**: No file-system outputs. All data is stored in the database.
- **Out-of-Repo Consumers**: The future web publishing pipeline may consume marker coordinates to embed shelter locations on public-facing map pages, but that integration is out of scope for this feature.

### Contracts & Operations

- **Contract Artifacts**: N/A — data flows through the existing IPC / SQLite pattern established by shelters, photos, and sources.
- **Operator Documentation**: No new operator steps required; all data entry occurs in the desktop app UI.
- **Theme/External Code Boundary**: N/A

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The main pane MUST include a "Map Markers" tab alongside the existing Shelter, History, Photos, and Sources tabs.
- **FR-002**: The Map Markers tab MUST display all markers for the currently selected shelter, showing: name, coordinates (latitude/longitude), start year, end year (or "present" when null), and change type.
- **FR-003**: The tab label MUST display the count of markers for the selected shelter (e.g., "Map Markers (3)"), consistent with the Photos and Sources tab pattern.
- **FR-004**: Users MUST be able to add a new map marker. User-editable fields: name, latitude (required), longitude (required), start year (required; must be ≥ parent shelter's `start_year` and, when the shelter has a non-null `end_year`, ≤ that `end_year`; must be unique among markers for this shelter — no two markers may share the same `start_year`), end year, change type (picklist: Original / Relocated / Rebuilt / Destroyed / Removed / Other — selecting "Other" reveals a short free-text input), notes. The fields `slug`, `is_extant`, and `photo_id` are NOT user-editable on a marker; they are populated automatically from the parent shelter record.
- **FR-005**: Users MUST be able to edit the user-editable fields of an existing marker (name, latitude, longitude, start year, end year, change type, notes) and save changes.
- **FR-006**: Users MUST be able to delete a marker. If deletion would create a gap in the shelter's year coverage, the user MUST be warned and must explicitly confirm before the deletion proceeds.
- **FR-007**: The system MUST reject saves when latitude is outside −90 to 90 or longitude is outside −180 to 180, displaying a clear validation message.
- **FR-008**: Markers MUST be listed in ascending chronological order by `start_year`.
- **FR-009**: `end_year` is required unless the parent shelter's `is_extant` is true AND this is the last marker in the set (i.e., no marker with a higher `start_year` exists — ties in `start_year` are prohibited by FR-004). In that case, `end_year` may be null and the marker is displayed as "present".
- **FR-010**: All marker changes MUST be persisted to the SQLite database immediately on save, with no manual sync step required.
- **FR-011**: When saving a marker (add or edit), the system MUST validate that the full set of markers for the shelter covers the shelter's `start_year`–`end_year` range with no gaps and no overlaps. A gap is a year within the shelter's range not covered by any marker's span. An overlap is a year covered by more than one marker's span (i.e., marker _i_'s `end_year` > marker _i+1_'s `start_year` when sorted by `start_year`). If the shelter's `is_extant` is true, the upper bound is open and the last marker's null `end_year` satisfies the upper end. The save MUST be blocked and the specific problem described (gap or overlap) if either is detected.
- **FR-012**: When the parent shelter record's `slug`, `is_extant`, or `default_photo_id` is updated, the system MUST propagate those changes to all map markers for that shelter automatically, keeping the denormalized copies in sync.

### Key Entities

- **Map Marker**: A single historical location record for a shelter. Represents the shelter's position at a specific place during a specific period. User-owned fields (editable per marker): `name`, `latitude`, `longitude`, `start_year`, `end_year`, `change_type`, `notes`. Denormalized fields (copied from the parent shelter, read-only on the marker): `slug` (the shelter's slug), `is_extant` (the shelter's extant flag — also indicates this marker's end_year may be null), `photo_id` (the shelter's default photo). Belongs to one Shelter.
- **Change Type**: A categorical descriptor for the kind of location event the marker represents. Standard picklist values: Original, Relocated, Rebuilt, Destroyed, Removed. An "Other" option opens a short free-text field for events not covered by the standard set.
- **Year Coverage**: The collective span of all map markers for a shelter, sorted by `start_year`, must form a contiguous, non-overlapping range equal to the shelter's `start_year`–`end_year` with no gaps. No two markers may share the same `start_year`. When `shelter.is_extant` is true, the last marker's `end_year` may be null (upper bound is open).
- **Shelter**: The parent record. One shelter may have zero or more map markers. Cascade-deleting a shelter removes its associated markers.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Archivists can add, view, edit, and delete map markers for any shelter entirely within the desktop app — no external tool required.
- **SC-002**: All marker changes are visible immediately after saving, with no app restart or manual refresh needed.
- **SC-003**: The form prevents saving invalid coordinates 100% of the time — no out-of-range latitude or longitude value can reach the database.
- **SC-004**: The tab count badge reflects the correct marker count at all times, including immediately after an add or delete operation.
- **SC-005**: The complete location history of any shelter — multiple markers across different time periods — is readable at a glance with names, year ranges, and change types clearly differentiated.
- **SC-006**: No marker set for any shelter can be saved in a state that contains a year gap within the shelter's active period — the coverage validation prevents it 100% of the time.
- **SC-007**: Denormalized fields (`slug`, `is_extant`, `photo_id`) on all markers are always consistent with the parent shelter record — no manual sync step is ever required from the archivist.

---

## Clarifications

### Session 2026-05-16

- Q: Should `change_type` be a constrained picklist or a free-text field? → A: Picklist (Original / Relocated / Rebuilt / Destroyed / Removed) with "Other (specify)" option that opens a short free-text input.
- Q: What does `is_extant` mean on a map marker specifically? → A: **Corrected** — `is_extant` on a marker is a denormalized copy of the parent shelter's `is_extant` flag. It is not independently set per marker. Its effect is that when true, the last marker's `end_year` may be null (the shelter is still active).
- Q: What scope should `slug` uniqueness be enforced at? → A: **Superseded** — `slug` on a marker is a denormalized copy of the parent shelter's slug, not a per-marker identifier. All markers for the same shelter share the same slug value. No per-marker uniqueness applies.
- Q: (Archivist-provided) What fields are user-editable vs. auto-populated? → A: User-editable: name, latitude, longitude, start_year, end_year, change_type, notes. Auto-populated from shelter (read-only on marker): slug, is_extant, photo_id.
- Q: (Archivist-provided) What year coverage rule applies? → A: Markers sorted by start_year must cover the shelter's full start_year–end_year range with no gaps. Exception: if shelter.is_extant = true, the last marker's end_year may be null.

---

## Assumptions

- The `map_markers` table does not yet exist and will require a new SQL migration.
- The IPC channel pattern (main process ↔ renderer via `contextBridge`) used for shelters, photos, and sources will be extended identically for map markers.
- `slug`, `is_extant`, and `photo_id` on a marker are populated at insert time by copying from the parent shelter record, and are updated automatically whenever the shelter record changes (via the shelter save flow).
- No visual map rendering (e.g., an interactive map with pins) is in scope for this feature — the tab is a structured data management interface only. A visual map view is a future enhancement.
- Year coverage validation is enforced at save time on the client. The database itself does not enforce the coverage constraint — correctness is maintained through the application layer.
- The design file referenced in the feature request was inaccessible (HTTP 404). The spec is based on the provided schema and existing app patterns. Design details should be validated against the actual design file once it is accessible.
