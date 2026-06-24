# Feature Specification: Photo Thumbnail Caching

**Feature Branch**: `010-photo-thumbnail-cache`
**Created**: 2026-06-24
**Status**: Draft
**Input**: User description: "Generate and cache small real thumbnails (e.g. via Electron's nativeImage.createThumbnailFromPath, no new dependency) and point grid/list image tags at those instead of the originals; keep full-res loading only in the single-photo detail pane. Add explicit width/height on the thumb <img>s. If 50+ photo shelters are still choppy after that, add list virtualization (e.g. react-window) as a follow-up — don't build it preemptively."

## Clarifications

### Session 2026-06-24

- Q: What's the concrete performance target for "smooth" dragging and "no noticeable freeze" during preview loading? → A: Load-time based: grid/list with 50+ large photos finishes rendering previews within 2 seconds, and drag interactions show no input lag (>100ms) at any point.
- Q: What's the thumbnail cache eviction/growth policy? → A: Unbounded cache: thumbnails persist indefinitely alongside their source photos, no eviction logic.
- Q: The Shelters tab default photo (~300-400px+) and the Photos tab selected-photo preview (resizable, up to ~600px) need thumbnails too — should there be one thumbnail size for everything, or separate sizes per display context? → A: Two cached sizes per photo: a small "grid/list" thumbnail and a larger "preview" thumbnail (sized for the shelter tab default photo and the photos-tab selected preview).
- Q: Should the inline selected-photo preview ever show true full-resolution, given it now uses the "preview" thumbnail by default? → A: Preview thumbnail is the default in the inline selected-photo pane; opening the photo editor modal from the Photos tab still loads the true full-resolution image.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Smooth reordering of many shelter photos (Priority: P1)

A user managing a shelter with many large photos drags a photo to a new position in the grid or list view. The reorder follows the cursor smoothly with no stutter, and the new order is saved correctly.

**Why this priority**: This is the core complaint — drag-and-drop reordering is slow and janky once a shelter has many large photos, making the photo management screen feel broken.

**Independent Test**: Open a shelter with 30+ large (multi-megabyte) photos, drag a photo to a new position in grid view and in list view, and observe the drag tracks the cursor without visible lag or frame drops. Confirm the new order persists after the drag ends.

**Acceptance Scenarios**:

1. **Given** a shelter with many large photos displayed in grid view, **When** the user drags a photo card to a new position, **Then** the card and surrounding cards move smoothly with the cursor and the final order is saved.
2. **Given** a shelter with many large photos displayed in list view, **When** the user drags a row to a new position, **Then** the row moves smoothly with the cursor and the final order is saved.
3. **Given** a shelter with many large photos, **When** the photo grid or list first loads, **Then** photos appear without a long delay or visible freeze.

---

### User Story 2 - Full-quality photo still available when needed (Priority: P2)

A user browsing the Photos tab selects a photo and sees a fast-loading preview. When they need to inspect or edit the photo closely (e.g. to check focus, crop, or fine detail), opening the photo editor gives them the original, full-resolution image, not a degraded preview.

**Why this priority**: Thumbnails make browsing fast, but users still need access to full image quality when editing a specific photo — this preserves that capability while letting the default browsing experience stay fast.

**Independent Test**: Select a photo on the Photos tab and confirm the inline preview loads quickly using a cached preview-sized thumbnail. Then open the photo editor for that photo and confirm the original full-resolution file is loaded, not the thumbnail.

**Acceptance Scenarios**:

1. **Given** a photo with a cached preview thumbnail, **When** the user selects that photo on the Photos tab, **Then** the inline selected-photo preview displays the cached preview thumbnail.
2. **Given** a selected photo showing its preview thumbnail, **When** the user opens the photo editor for that photo, **Then** the editor loads and displays the original full-resolution image.

---

### User Story 3 - Fast-loading default photo on the Shelters tab (Priority: P2)

A user browsing the Shelters tab sees each shelter's default photo load quickly, without waiting on a full-resolution image decode.

**Why this priority**: The Shelters tab is a frequently visited overview screen; slow image loads there have the same user-facing cost as on the Photos tab.

**Independent Test**: Open the Shelters tab for a shelter whose default photo is a large source file and confirm the default photo appears quickly, using a cached preview-sized thumbnail rather than the full-resolution original.

**Acceptance Scenarios**:

1. **Given** a shelter whose default photo has a cached preview thumbnail, **When** the user views that shelter on the Shelters tab, **Then** the default photo display uses the cached preview thumbnail, sized to fill the default-photo display area without visible upscaling blur.

---

### User Story 4 - Thumbnails stay correct after photo changes (Priority: P3)

A user replaces or edits a photo's underlying image file. The grid and list views should reflect the updated image, not a stale cached preview.

**Why this priority**: Incorrect cached previews would erode trust in the tool even if performance improves — correctness must hold for the fix to be acceptable.

**Independent Test**: Replace or edit a photo's source file, return to the grid/list view, and confirm the displayed thumbnail reflects the new image content rather than the old one.

**Acceptance Scenarios**:

1. **Given** a photo whose source file has been replaced, **When** the grid or list view is shown again, **Then** the displayed thumbnail reflects the updated image.

### Edge Cases

- What happens when a thumbnail cannot be generated (e.g. corrupted or unreadable image file)? The grid/list should show a clear fallback (e.g. existing broken-image indicator) rather than blocking the rest of the list.
- How does the system handle a shelter with zero photos, or exactly one photo? Thumbnail generation and caching must not error or block the view in these minimal cases.
- How is rerun behavior handled when the same photo is viewed repeatedly without changing? The cached thumbnail must be reused rather than regenerated each time.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: Original photo image files referenced by the `photos` table (`file_name`/file path) in the SQLite database; these remain the single source of truth for image content.
- **Derived Outputs**: Generated thumbnail image files, cached on local disk, derived from and kept in sync with their source photo files.
- **Out-of-Repo Consumers**: None. Thumbnails are an internal rendering optimization for this desktop application only and are not published, exported, or exposed to any external system.

### Contracts & Operations

- **Contract Artifacts**: N/A — this is an internal rendering/caching optimization with no external or cross-repo contract.
- **Operator Documentation**: N/A — no operator-facing workflow changes; this is transparent to end users beyond improved responsiveness.
- **Theme/External Code Boundary**: N/A — no theme or external code is involved.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a reduced-size preview image (a "grid/list thumbnail") for each photo in grid view and list view, instead of rendering the original full-resolution file at preview size.
- **FR-002**: System MUST generate a thumbnail for a photo automatically the first time that photo needs to be displayed at a given size class, without requiring manual user action.
- **FR-003**: System MUST cache generated thumbnails so that subsequent views of the same, unchanged photo at the same size class reuse the cached thumbnail rather than regenerating it.
- **FR-004**: System MUST regenerate a photo's cached thumbnails when the underlying source image file changes (e.g. is replaced or edited), so previews never display stale content.
- **FR-005**: System MUST display a larger cached preview thumbnail (a "preview thumbnail") for: the Shelters tab default photo, and the inline selected-photo preview on the Photos tab. The original full-resolution image is loaded only when the user opens the photo editor for that photo.
- **FR-006**: System MUST reserve correct layout space for each thumbnail (grid/list or preview) before the image finishes loading, so that images appearing do not shift surrounding content.
- **FR-007**: System MUST allow drag-and-drop reordering of photos in both grid and list views to remain responsive (no perceptible lag) for shelters with many (50+) large photos.
- **FR-008**: System MUST gracefully fall back to an existing placeholder/error indicator when a thumbnail cannot be generated for a given photo, without preventing the rest of the photo list or the Shelters tab from displaying.
- **FR-009**: System MUST size the preview thumbnail to match the display area it's used in (Shelters tab default photo frame, Photos tab selected-photo preview frame) without visible upscaling blur.

### Key Entities *(include if feature involves data)*

- **Photo**: An existing entity representing a shelter's image (source file, metadata); unchanged by this feature except for its associated cached thumbnails.
- **Thumbnail Cache Entry**: A generated, reduced-size preview image derived from a Photo's source file. Two size classes are cached per photo: a small "grid/list" thumbnail (for grid cards and list rows) and a larger "preview" thumbnail (for the Shelters tab default photo and the Photos tab selected-photo preview). Stored locally, invalidated/regenerated when the source file changes, and persisted indefinitely alongside the source photo with no size-based eviction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Dragging a photo to reorder it in a shelter with 50+ large photos shows no input lag greater than 100ms at any point during the drag, in both grid and list views. This holds whether or not the Shelters tab and Photos tab preview pane are also drawing preview thumbnails elsewhere in the app.
- **SC-002**: Opening the photo grid or list for a shelter with 50+ large photos finishes rendering previews within 2 seconds.
- **SC-003**: Opening the photo editor for any photo always shows the full, original image quality, with no loss of fidelity introduced by this feature.
- **SC-004**: Replacing a photo's source image and returning to the grid/list view, the Shelters tab, or the Photos tab preview always shows the updated image content, never a stale preview.
- **SC-005**: The Shelters tab default photo and the Photos tab selected-photo preview load using a cached preview thumbnail with no visible upscaling blur at their respective display sizes.

## Assumptions

- "Many large photos" refers to shelters with roughly 50 or more photos, where individual source files can be several megabytes (e.g. modern camera/phone photos).
- Thumbnail generation happens on-demand and is cached locally; no upfront batch-processing step is required for existing photo libraries.
- List virtualization (rendering only on-screen rows) is explicitly out of scope for this feature and should only be considered later if thumbnailing alone does not resolve performance for very large photo counts.
- No new third-party dependency is required or desired; thumbnail generation should use capabilities already available in the application's runtime.
- This feature is internal to the desktop application; it has no effect on exported, published, or Google Drive-synced output (covered by feature 009).
