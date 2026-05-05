# Data Model: Shelter Photo Carousel and Bulk Upload

## Shelter
- Purpose: Canonical shelter record that owns gallery membership and fallback precedence.
- Source: `shelters` table in `database/gmc_shelters.sqlite`.
- Key fields:
  - `id` INTEGER PK
  - `slug` TEXT unique logical identifier for shelter folders and post matching
  - `name` TEXT
  - `default_photo_id` INTEGER nullable fallback photo reference
  - `show_on_web` INTEGER publication flag
- Relationships:
  - One shelter has many `PhotoRecord` rows.
  - One shelter resolves to one derived `ShelterGalleryView`.
- Validation rules:
  - `slug` must remain stable and match the shelter folder/post slug.
  - `default_photo_id` is usable only when it is a positive id that resolves to a valid displayable image; `0` and null are treated as unset.
  - `show_on_web = 0` shelters are excluded from bulk upload selection and gallery publication.

## PhotoRecord
- Purpose: Source-of-truth row describing a shelter-linked image reference.
- Source: `photos` table.
- Key fields:
  - `id` INTEGER PK
  - `shelter_id` INTEGER FK -> Shelter
  - `file_name` TEXT relative path to the local source image
  - `caption` TEXT optional
  - `photographer` TEXT optional
  - `date_taken` TEXT optional
  - `notes` TEXT optional
  - `created` / `updated`
- Relationships:
  - Many photo records belong to one shelter.
  - One photo record may resolve to one current `PhotoAssetLink`.
  - One photo record may produce many `BulkUploadRunItem` audit rows over time.
- Validation rules:
  - `file_name` must resolve inside the repository and point to a readable image file before upload.
  - `shelter_id` must reference an existing shelter.
  - Metadata fields may be blank but must be preserved when present.
- Ordering rule:
  - Gallery order defaults to existing photo row order (`photos.id` ascending) until a dedicated display-order field exists.

## ManagedImageAsset
- Purpose: De-duplicated representation of a source image that has been verified or uploaded into WordPress media.
- Planned storage: New SQLite table `photo_managed_assets`.
- Key fields:
  - `id` INTEGER PK
  - `source_sha256` TEXT unique stable content identity
  - `canonical_source_rel_path` TEXT first successful repository-relative source path observed for this asset identity
  - `mime_type` TEXT
  - `byte_size` INTEGER
  - `wp_attachment_id` INTEGER unique nullable until upload succeeds
  - `wp_media_url` TEXT nullable until upload succeeds
  - `title` TEXT nullable
  - `alt_text` TEXT nullable
  - `status` ENUM(`pending`,`uploaded`,`failed`,`missing`)
  - `uploaded_at` TEXT nullable
  - `last_verified_at` TEXT nullable
- Relationships:
  - One managed asset can back many `PhotoAssetLink` rows.
  - One managed asset can appear in many `BulkUploadRunItem` rows.
- Validation rules:
  - `source_sha256` must identify exactly one source-image identity.
  - `wp_attachment_id` and `wp_media_url` are required for a displayable uploaded asset.
  - Re-runs must reuse an existing managed asset row when the same `source_sha256` is encountered again.

## PhotoAssetLink
- Purpose: Canonical mapping from a shelter photo record to the managed asset used for rendering, making idempotency and shelter-photo association reuse explicit.
- Planned storage: New SQLite table `photo_asset_links`.
- Key fields:
  - `id` INTEGER PK
  - `photo_id` INTEGER unique FK -> PhotoRecord
  - `asset_id` INTEGER FK -> ManagedImageAsset
  - `observed_source_rel_path` TEXT repository-relative source path used when the link was last verified
  - `linked_at` TEXT
  - `last_verified_at` TEXT
- Relationships:
  - One photo link belongs to one photo record.
  - Many photo links may point to one managed asset when different photo rows share the same image identity.
- Validation rules:
  - `photo_id` uniqueness prevents duplicate shelter-photo associations from being created on rerun.
  - Apply-mode reruns upsert the existing `photo_id` link instead of inserting a second association row.
  - A failed or missing upload attempt must not create a new link row.

## BulkUploadRun
- Purpose: Audit record for one administrative import attempt.
- Planned storage: New SQLite table `photo_upload_runs`.
- Key fields:
  - `id` INTEGER PK
  - `started_at` TEXT
  - `finished_at` TEXT nullable
  - `mode` ENUM(`dry-run`,`apply`)
  - `target_base_url` TEXT
  - `requested_count` INTEGER
  - `uploaded_count` INTEGER
  - `skipped_count` INTEGER
  - `failed_count` INTEGER
  - `status` ENUM(`running`,`completed`,`completed_with_failures`,`failed`)
- Relationships:
  - One run has many `BulkUploadRunItem` rows.
- Validation rules:
  - Final counts must sum to `requested_count`.
  - Runs are append-only for historical reporting.
  - Dry-runs must not mutate managed assets or photo links.

## BulkUploadRunItem
- Purpose: Per-photo outcome inside a bulk upload run.
- Planned storage: New SQLite table `photo_upload_run_items`.
- Key fields:
  - `id` INTEGER PK
  - `run_id` INTEGER FK -> BulkUploadRun
  - `photo_id` INTEGER FK -> PhotoRecord
  - `asset_id` INTEGER nullable FK -> ManagedImageAsset
  - `source_sha256` TEXT nullable when the file is unreadable
  - `outcome` ENUM(`uploaded`,`skipped`,`failed`)
  - `reason` TEXT nullable
  - `wp_attachment_id` INTEGER nullable
  - `processed_at` TEXT
- Relationships:
  - Many run items belong to one run.
  - Many run items can reference the same photo record across reruns.
- Validation rules:
  - Every processed photo row gets exactly one run item per run.
  - `reason` is required when `outcome = failed` and recommended when `outcome = skipped`.
  - `skipped` includes both prior-run reuse and same-run duplicate detection when a source image identity is already represented.

## ShelterGalleryView
- Purpose: Derived render payload consumed by the shelter post template or any other external consumer.
- Planned storage: Derived query/view, not a persisted authoring table.
- Key fields:
  - `shelter_slug`
  - `navigation_enabled` boolean
  - `fallback_mode` ENUM(`gallery`,`default-image`,`site-placeholder`)
  - `slides[]` with `photo_id`, `wp_attachment_id`, `image_url`, `caption`, `credit`, `alt_text`, `is_fallback`
- Derivation rules:
  - Load photo rows for one shelter only.
  - Join `PhotoRecord -> PhotoAssetLink -> ManagedImageAsset` and include only assets with `status = uploaded` and a valid media URL/attachment id.
  - If one or more displayable slides remain, return those slides only and set `fallback_mode = gallery`.
  - If zero displayable slides remain, resolve fallback from a usable `default_photo_id` first; otherwise use the approved site-wide placeholder.
  - When exactly one slide is returned, disable previous/next navigation.
  - Unavailable photo rows are omitted entirely; they do not produce broken or placeholder slides inside an otherwise valid gallery.

## Idempotency Rules
1. Source-image identity is established from normalized repository-relative path plus computed `source_sha256`; reusable content identity is keyed by `source_sha256`.
2. The first successful encounter with a new `source_sha256` may create one WordPress attachment and one `ManagedImageAsset` row.
3. Every successful or reused photo processing event upserts one `PhotoAssetLink` row for that `photo_id`; reruns update verification metadata instead of creating duplicate associations.
4. Multiple `PhotoRecord` rows may link to the same `ManagedImageAsset`, but reruns must never create a second attachment for an existing identity.
5. Missing or failed files produce `BulkUploadRunItem` failures only; they do not create managed-asset duplicates or placeholder gallery slides.

## State Transitions

### ManagedImageAsset
- `pending` -> `uploaded` when WordPress returns a valid attachment id and media URL.
- `pending` -> `missing` when the local file cannot be read.
- `pending` -> `failed` when upload or metadata update fails after file resolution.
- `failed` -> `uploaded` on a later successful rerun using the same source-image identity.

### PhotoAssetLink
- absent -> linked when a photo row is uploaded successfully or matched to an existing managed asset.
- linked -> linked when a rerun re-verifies the same association and updates timestamps only.
- linked is not duplicated; `photo_id` uniqueness forces in-place reuse.

### BulkUploadRunItem outcome semantics
- `uploaded` when the current run creates the managed asset or repairs a previously failed/missing asset successfully.
- `skipped` when the current run finds an already-uploaded asset for the same source-image identity, including later rows in the same run that resolve to an already-represented identity.
- `failed` when the current run cannot read the file or cannot complete the remote upload/metadata step.

### BulkUploadRun
- `running` -> `completed` when all items upload or skip successfully.
- `running` -> `completed_with_failures` when at least one item fails but processing reaches the end.
- `running` -> `failed` only for unrecoverable run-level issues such as authentication failure before item processing begins.
