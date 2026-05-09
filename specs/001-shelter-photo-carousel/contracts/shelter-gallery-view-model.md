# Contract: Shelter Gallery View Model

## Purpose
Define the repository-owned data contract and validation rules that the shelter post template needs in order to render a carousel from SQLite-linked shelter photos without mixing photos across shelters.

## Ownership boundary
- This repository owns the gallery payload shape, derivation rules, and validation guidance.
- The final shelter post template or theme implementation may live outside this repository.
- External consumers must validate their implementation against this contract rather than assuming additional repo-local theme code exists.
- The approved site-wide placeholder source and published fallback URL are declared in `specs/001-shelter-photo-carousel/site-placeholder.json`, which the gallery service reads when `fallback_mode = "site-placeholder"`.

## Repository validation command
```zsh
cd /Users/johnneed/Projects/gmc-shelters
python3 scripts/export_shelter_gallery_view.py \
  --db /Users/johnneed/Projects/gmc-shelters/database/gmc_shelters.sqlite \
  --shelter aeolus-view-camp \
  --validate
```

## Input lookup
- Match the current shelter post to a `shelters.slug` value.
- Load `PhotoRecord` rows for that shelter only.
- Join only to displayable `ManagedImageAsset` rows through the canonical `PhotoAssetLink` mapping.
- Preserve existing photo row order unless a future explicit sort field is introduced.
- Reserve `default_photo_id` for zero-slide fallback resolution rather than mixing it into the normal gallery set.

## Response shape
```json
{
  "shelter_slug": "aeolus-view-camp",
  "navigation_enabled": true,
  "fallback_mode": "gallery",
  "slides": [
    {
      "photo_id": 6007,
      "wp_attachment_id": 12345,
      "image_url": "https://gmcburlington.org/wp-content/uploads/2026/05/aeolus-view-camp.png",
      "alt_text": "Aeolus View Camp",
      "caption": null,
      "credit": null,
      "is_fallback": false
    }
  ]
}
```

### Metadata-rich slide example
```json
{
  "photo_id": 6012,
  "wp_attachment_id": 12388,
  "image_url": "https://gmcburlington.org/wp-content/uploads/2026/05/aeolus-view-camp-interior.jpg",
  "alt_text": "Aeolus View Camp interior",
  "caption": "Interior looking east",
  "credit": "Green Mountain Club Archives",
  "is_fallback": false
}
```

## Rendering rules
1. `slides` must contain only photos associated with the current shelter.
2. `slides` must omit unavailable, failed, unreadable, or otherwise non-displayable photo rows.
3. When `slides.length > 1`, enable previous/next navigation.
4. When `slides.length === 1`, render the image without empty navigation controls.
5. When at least one valid gallery slide exists, keep `fallback_mode = "gallery"` and do not inject fallback slides.
6. When `slides.length === 0`, resolve fallback in this order:
   - `fallback_mode = "default-image"` when a shelter default image is configured with a valid, resolvable positive `default_photo_id`
   - `fallback_mode = "site-placeholder"` when no usable shelter default is available, using the `published_image_url` declared in `site-placeholder.json`
7. When gallery-facing metadata exists, surface `caption` and `credit` alongside the image; archival-only fields such as date or notes are outside this payload contract.

## Mixed valid/unavailable behavior
- A shelter with both valid and unavailable associated photos still returns only the valid slides.
- The presence of unavailable photos does not force `fallback_mode` away from `gallery` if one or more valid slides remain.
- Broken, null, or missing images are never represented as placeholder slides within an otherwise valid shelter gallery.

## Fallback payload rules
### Default-image fallback
```json
{
  "shelter_slug": "example-shelter",
  "navigation_enabled": false,
  "fallback_mode": "default-image",
  "slides": [
    {
      "photo_id": null,
      "wp_attachment_id": 9876,
      "image_url": "https://gmcburlington.org/wp-content/uploads/defaults/example-shelter.jpg",
      "alt_text": "Example Shelter default image",
      "caption": null,
      "credit": null,
      "is_fallback": true
    }
  ]
}
```

### Site-placeholder fallback
```json
{
  "shelter_slug": "example-shelter",
  "navigation_enabled": false,
  "fallback_mode": "site-placeholder",
  "slides": [
    {
      "photo_id": null,
      "wp_attachment_id": null,
      "image_url": "https://gmcburlington.org/path/to/approved-placeholder.jpg",
      "alt_text": "Shelter image unavailable",
      "caption": null,
      "credit": null,
      "is_fallback": true
    }
  ]
}
```

## Validation guidance
1. Confirm the payload contains only slides for the current `shelter_slug`.
2. Confirm a multi-photo shelter enables navigation and preserves record order.
3. Confirm a one-photo shelter returns exactly one slide and disables navigation.
4. Confirm a mixed valid/unavailable shelter returns only the valid uploaded slides and no broken placeholders.
5. Confirm a zero-slide shelter uses a usable shelter default image before the site-wide placeholder.
6. Confirm the external template consumes this payload shape without requiring repo-local theme code.
7. Confirm `scripts/export_shelter_gallery_view.py --validate` succeeds for the shelter slug being handed off.
8. Confirm `site-placeholder.json` points to the approved repository-owned source image and final published fallback URL.

## Compatibility notes
- Current repository data has zero shelters with a usable positive `default_photo_id`, so `site-placeholder` is expected to be the common zero-slide fallback until valid shelter defaults are introduced.
- Any consumer that can resolve the shape above may implement the actual carousel UI.
