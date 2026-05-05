# Research: Shelter Photo Carousel and Bulk Upload

## Decision 1: Implement the feature as repository-fit Python automation over SQLite
- Decision: Deliver the bulk upload and gallery-query logic as Python 3.11+ automation under `scripts/` with shared helpers under `scripts/lib/`, using `database/gmc_shelters.sqlite` as the authoritative local store.
- Rationale: The repository already contains Python scripts that use `requests` and `sqlite3`, and the constitution requires extending existing repo structure before inventing new services or frameworks.
- Alternatives considered: A separate web service was rejected as unnecessary structural expansion; a WordPress-only implementation was rejected because it would move source-of-truth behavior out of the repository.

## Decision 2: Treat WordPress as an external publication target and the shelter template as an external consumer
- Decision: This repository will own the data contracts, duplicate-safe upload workflow, and validation guidance, but it will not claim direct ownership of the final shelter post template unless that code is later checked in here.
- Rationale: The constitution explicitly requires repo-owned contracts for out-of-repo consumers and forbids assuming missing theme code exists locally. The gallery contract therefore becomes the handoff boundary.
- Alternatives considered: Documenting only an implied template behavior was rejected because it leaves the consumer ambiguous; implementing theme markup in planning artifacts was rejected because that code is not in this repo.

## Decision 3: Use stable source-image identity plus explicit photo-to-asset links for idempotency
- Decision: Detect duplicates by normalized local source path plus computed SHA-256 content identity, persist one managed asset per resolved source-image identity, and upsert a canonical `photo_id -> asset_id` link so reruns never create duplicate WordPress media entries or duplicate shelter-photo associations.
- Rationale: The spec requires safe reruns even when the same file is referenced more than once or the same content is encountered again later. Separate managed-asset and photo-link records make both de-duplication and gallery derivation explicit.
- Alternatives considered: A single boolean uploaded flag on `photos` was rejected because it cannot safely represent reused files or auditable reruns; comparing only WordPress filenames was rejected because filenames are not a stable identity.

## Decision 4: Resolve gallery content from valid uploaded assets only, with explicit fallback precedence
- Decision: Build the gallery from shelter-specific photo rows joined to displayable managed assets. If none remain, resolve fallback in this order: usable shelter default image first, otherwise the approved site-wide placeholder.
- Rationale: This matches FR-006 and keeps broken or unavailable assets out of the rendered gallery while still guaranteeing a usable image state.
- Alternatives considered: Rendering a broken or empty gallery was rejected because the spec requires an explicit fallback path; preferring the site-wide placeholder before a shelter default was rejected because the shelter-specific default is the closer match.

## Decision 5: Mixed valid and unavailable photos should preserve every valid slide and omit the rest
- Decision: Unavailable, unreadable, failed, or not-yet-uploaded photo rows are omitted from `slides[]`; if at least one valid slide remains, the gallery stays in `fallback_mode = "gallery"` and renders only those valid slides.
- Rationale: The user-facing requirement is to keep the page usable without broken slides. Omission is clearer and safer than placeholder slides interleaved with valid shelter photos.
- Alternatives considered: Rendering placeholder slides among valid photos was rejected because it creates misleading navigation; failing the entire gallery when one photo is unavailable was rejected because it violates FR-013.

## Decision 6: Define audits and validation around dry-run, apply, and rerun scenarios
- Decision: The workflow will support dry-run inspection, append per-run audit rows, and publish validation guidance for first-run upload, same-run duplicate detection, rerun skip behavior, fallback precedence, and mixed valid/unavailable galleries.
- Rationale: The constitution requires rerunnable, auditable workflows and explicit operator docs for external consumers. These validations belong in repo-owned planning artifacts even if the final template code lives elsewhere.
- Alternatives considered: Relying on manual visual checks only was rejected because it is not auditable; aggregate-only run summaries were rejected because operators need per-item evidence for retries and duplicate verification.
