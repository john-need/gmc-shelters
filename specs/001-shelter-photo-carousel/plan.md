# Implementation Plan: Shelter Photo Carousel and Bulk Upload

**Branch**: `[001-shelter-photo-carousel]` | **Date**: 2026-05-05 | **Spec**: [`specs/001-shelter-photo-carousel/spec.md`](./spec.md)
**Input**: Feature specification from `/specs/001-shelter-photo-carousel/spec.md`

## Summary

Deliver a repository-owned Python workflow that reads shelter photo records from `database/gmc_shelters.sqlite`, uploads missing source images from `shelters/` into WordPress media, records idempotent managed-asset and photo-link state for safe reruns, and publishes a validated shelter post carousel contract for an external template consumer. The gallery service will read `specs/001-shelter-photo-carousel/site-placeholder.json` to resolve the site-wide fallback image when no displayable shelter photo or usable shelter default remains. The carousel payload will surface caption and photographer credit metadata when present, while archival-only fields stay out of the consumer contract.

## Technical Context

**Language/Version**: Python 3.11+ for the upload and gallery tooling; existing repository utility scripts also include Node.js/CommonJS for unrelated maintenance work  
**Primary Dependencies**: Python stdlib (`sqlite3`, `argparse`, `pathlib`, `hashlib`, `json`, `mimetypes`, `dataclasses`), `requests`, repository SQLite data, WordPress REST media endpoints  
**Storage**: `database/gmc_shelters.sqlite`, migration SQL under `database/migrations/`, local source assets under `shelters/`, the site placeholder manifest at `specs/001-shelter-photo-carousel/site-placeholder.json`, contracts and operator docs under `specs/001-shelter-photo-carousel/`, and WordPress media as the external publication target  
**Testing**: `pytest` for `tests/unit/`, `tests/integration/`, and `tests/contract/` with TDD required before implementation  
**Target Platform**: macOS/Linux CLI workstation for operators, with WordPress REST API as an external consumer and the shelter post template as an out-of-repo presentation consumer  
**Project Type**: Repository automation and content workflow  
**Performance Goals**: Support the current dataset of 265 shelters and 2,969 photo rows, handle shelter galleries up to the current observed maximum of 118 photos, and produce a complete uploaded/skipped/failed accounting for 100-image runs without aborting on item-level failures  
**Constraints**: Repository data and local assets remain the source of truth; reruns must be idempotent and auditable; broken slides must be omitted when valid slides remain; fallback precedence must be deterministic; no assumptions may be made about unavailable WordPress theme code living in this repository  
**Scale/Scope**: Touches `database/`, `scripts/`, `tests/`, and `specs/001-shelter-photo-carousel/`; integrates with one external WordPress site and one external shelter post template consumer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **PASS** Source of truth identified: shelter records, photo rows, and local source images come from repository-owned SQLite data and files; WordPress is treated strictly as a publication target and the shelter template as an external consumer.
- **PASS** Test-first scope identified: migrations, gallery derivation, consumer contracts, CLI behavior, fallback precedence, and duplicate-safe reruns all require failing tests before implementation.
- **PASS** External contract coverage identified: the shelter post consumer contract and bulk upload CLI contract are documented under `specs/001-shelter-photo-carousel/contracts/`, with validation guidance in `quickstart.md` and `scripts/README.md`.
- **PASS** Idempotency and auditability identified: the upload workflow includes dry-run inspection, managed-asset reuse by stable source-image identity, canonical photo-to-asset links, and per-run uploaded/skipped/failed reporting.
- **PASS** Minimal-change fit identified: all planned work stays within `scripts/`, `scripts/lib/`, `database/`, `tests/`, and `specs/001-shelter-photo-carousel/`.
- **PASS** WordPress/theme boundary respected: this repository owns payload derivation, contracts, fixtures, and validation guidance rather than claiming direct theme implementation.

## Project Structure

### Documentation (this feature)

```text
specs/001-shelter-photo-carousel/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── site-placeholder.json
├── contracts/
│   ├── bulk-photo-upload-cli.md
│   └── shelter-gallery-view-model.md
└── tasks.md
```

### Source Code (repository root)

```text
database/
├── gmc_shelters.sqlite
└── migrations/
    └── 001_photo_managed_assets.sql

scripts/
├── import_shelter_photos.py
├── export_shelter_gallery_view.py
├── README.md
└── lib/
    ├── photo_db.py
    ├── photo_models.py
    ├── photo_repository.py
    ├── shelter_gallery.py
    ├── shelter_gallery_consumer_validator.py
    ├── shelter_gallery_service.py
    ├── wordpress_media.py
    ├── photo_import_results.py
    ├── photo_importer.py
    └── managed_asset_registry.py

tests/
├── contract/
├── integration/
├── unit/
└── fixtures/

shelters/
specs/001-shelter-photo-carousel/
```

**Structure Decision**: Keep the feature inside the existing repository automation layout. Python scripts and helpers handle gallery derivation and WordPress sync; SQLite migrations persist managed assets, photo links, and run audits; tests live under the existing `tests/` hierarchy; the site-wide placeholder source is declared in the feature-local manifest `site-placeholder.json`; and contracts plus operator handoff guidance remain under the feature spec directory because the final shelter post template is not stored in this repository.

## Complexity Tracking

No constitutional violations or structure exceptions currently require justification.
