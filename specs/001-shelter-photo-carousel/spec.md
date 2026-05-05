# Feature Specification: Shelter Photo Carousel and Bulk Upload

**Feature Branch**: `[001-shelter-photo-carousel]`  
**Created**: 2026-05-05  
**Status**: Draft  
**Input**: User description: "Add an image carousel to the shelter post template using the photos associated with each shelter from the SQLite photos table. Add a bulk image upload workflow for images referenced in the photos table, ensuring already uploaded images are detected and skipped. Use the repository's Speckit conventions, create the feature directory/spec/checklist, and report the output paths and readiness."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View shelter photos in a gallery (Priority: P1)

As a site visitor reading a shelter post, I want to browse all photos associated with that shelter in one gallery area so I can better understand the shelter's appearance and condition without leaving the page.

**Why this priority**: The shelter post experience is the primary user-facing value. Showing associated photos directly on the post makes the shelter content more useful and complete.

**Independent Test**: Open a shelter post that has multiple associated photo records and verify the published post page renders an on-page gallery with usable previous/next controls, displays only eligible photos for that shelter, and never mixes in photos from other shelters.

**Acceptance Scenarios**:

1. **Given** a shelter has multiple associated photos available for display, **When** a visitor opens that shelter post, **Then** the published page shows an on-page gallery with previous/next controls that let the visitor move through each associated photo without leaving the post.
2. **Given** a shelter has only one associated photo available for display, **When** a visitor opens that shelter post, **Then** the page shows that photo in the gallery area without empty or misleading navigation controls.
3. **Given** a shelter has no associated photos available for display, **When** a visitor opens that shelter post, **Then** the page shows the shelter's default image when one is configured for display, or otherwise shows the approved site-wide fallback image instead of a broken gallery.
4. **Given** a shelter has a mix of displayable and unavailable associated photos, **When** a visitor opens that shelter post, **Then** the page still displays the remaining valid photos and does not show broken slides for the unavailable ones.

---

### User Story 2 - Bulk upload referenced shelter images (Priority: P2)

As an administrator, I want a bulk workflow that uploads the images referenced by shelter photo records so the shelter posts can reliably display the images already described in the shelter data.

**Why this priority**: The carousel depends on images being available in the site's managed media inventory. Bulk upload reduces manual effort and makes the photo data usable at scale.

**Independent Test**: Run the bulk upload workflow against photo records that reference source images not yet available in the site media inventory and confirm the missing images become available for shelter posts.

**Acceptance Scenarios**:

1. **Given** photo records reference valid source images that have not yet been uploaded, **When** an administrator runs the bulk upload workflow, **Then** the system uploads those images and makes them available to the related shelter posts.
2. **Given** some photo records reference unreadable or missing source images, **When** an administrator runs the bulk upload workflow, **Then** the system continues processing the remaining records and reports which records failed.

---

### User Story 3 - Re-run imports without duplicates (Priority: P3)

As an administrator, I want the bulk upload workflow to detect images that were already uploaded so I can safely re-run imports without creating duplicate media entries or wasting time.

**Why this priority**: Re-runnable imports reduce operational risk and make the workflow dependable as new shelter photos are added over time.

**Independent Test**: Run the same bulk upload twice against an overlapping set of photo records and verify the second run skips already uploaded images while still importing any remaining missing ones.

**Acceptance Scenarios**:

1. **Given** a bulk upload run includes photo records whose images are already available in the managed media inventory, **When** an administrator runs the workflow, **Then** those records are skipped and counted as already uploaded.
2. **Given** a second bulk upload run includes both previously uploaded and still-missing images, **When** the administrator runs the workflow again, **Then** the system uploads only the still-missing images and skips the rest.

---

### Edge Cases

- A shelter has photo records linked to it, but one or more referenced images cannot be found at import time.
- Multiple photo records reference the same source image and should not create duplicate uploaded assets.
- A shelter has a designated default image but no successfully uploaded gallery images.
- A shelter has some valid uploaded photos and some missing or failed photos, and the valid photos must still render without broken slides.
- Some associated photos contain captions or credits while others do not.
- A shelter has a large number of associated photos and the gallery must still let visitors reach the first and last image.
- The shelter has no usable default image configured, so the system must fall back to the approved site-wide placeholder image.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST render a gallery area within each published shelter post using only the photo records associated with that shelter.
- **FR-002**: When a shelter has more than one displayable associated photo, the gallery MUST let visitors move forward and backward through every displayable shelter photo on the same page without leaving the shelter post.
- **FR-003**: The system MUST ensure that a shelter post only displays photos associated with that specific shelter.
- **FR-004**: When gallery-facing photo metadata such as caption or photographer credit exists, the system MUST make that information available with the displayed image.
- **FR-005**: When only one associated photo is available, the system MUST present that photo in the gallery area without empty or misleading navigation controls.
- **FR-006**: When no associated photo is available for display, the system MUST first show the shelter's designated default image when one is configured for display; otherwise it MUST show the approved site-wide fallback image identified by the repository-owned fallback manifest for this feature.
- **FR-007**: The system MUST provide an administrative bulk upload workflow for source images referenced by shelter photo records.
- **FR-008**: The bulk upload workflow MUST upload images that are referenced by photo records and are not yet available in the site's managed media inventory.
- **FR-009**: The bulk upload workflow MUST treat a previously managed image as already uploaded when a selected photo record resolves to the same source image identity, including reused source files that represent the same image content, and MUST skip creating a duplicate media entry.
- **FR-010**: The bulk upload workflow MUST continue processing remaining records when an individual image fails and MUST record the failed item separately.
- **FR-011**: After each bulk upload run, the system MUST provide a summary of uploaded, skipped, and failed records.
- **FR-012**: Re-running the bulk upload workflow against the same photo records MUST be idempotent, MUST reuse previously managed images when the same source image identity is encountered again, and MUST not create additional duplicate media entries or duplicate shelter-photo associations.
- **FR-013**: The shelter post MUST remain usable when one or more associated photos are unavailable by displaying any remaining valid images, omitting broken slides for unavailable photos, and using the fallback image sequence only when no displayable image remains.
- **FR-014**: The feature MUST provide a clear integration contract and validation guidance so the shelter post template can render the gallery behavior consistently even when the template code is maintained outside this repository.

### Key Entities *(include if feature involves data)*

- **Shelter**: A published shelter entry with a post page, a unique identity, and an optional designated default image.
- **Photo Record**: A shelter-linked image reference that may include gallery-facing caption and photographer credit metadata, archival date or notes metadata that remain outside the carousel payload, and a source file reference.
- **Managed Image Asset**: An uploaded image available for display on shelter posts and traceable back to a photo record.
- **Bulk Upload Run**: A single administrative import attempt that processes multiple photo records and records uploaded, skipped, and failed outcomes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In acceptance testing, 95% or more of shelter posts with at least one eligible associated photo display at least one shelter image on first view.
- **SC-002**: In usability testing, 90% or more of participants can view all photos for a shelter with five associated images in under 30 seconds without leaving the shelter post.
- **SC-003**: When the same import set is run twice, the second run creates zero duplicate media entries for images that were already available after the first run.
- **SC-004**: For a bulk upload run of 100 referenced images, the workflow produces a complete uploaded/skipped/failed summary for 100% of processed records.
- **SC-005**: In acceptance testing, 100% of shelters with a mix of valid and unavailable associated photos still display every valid photo without showing a broken slide.

## Assumptions

- Existing shelter photo records already identify which shelter each image belongs to and are the authoritative source for gallery membership.
- A source image exists or can be resolved for each photo record intended for bulk upload.
- Shelter posts already have a place where a gallery or fallback image can be shown without changing the overall publishing workflow, even if the final template code is maintained outside this repository.
- Administrators running the bulk upload workflow have permission to add images to the site's managed media inventory.
- If no shelter-specific display order is defined, associated photos will appear in a consistent existing record order.
- A single approved site-wide placeholder image exists for shelters that do not have a usable shelter-specific default image, and its repository-owned source is recorded in `specs/001-shelter-photo-carousel/site-placeholder.json`.
