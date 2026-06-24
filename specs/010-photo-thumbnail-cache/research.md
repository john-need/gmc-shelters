# Research: Photo Thumbnail Caching

## Decision: Thumbnail generation via `nativeImage.createThumbnailFromPath`

**Rationale**: Electron 32 (this project's version, `package.json`) bundles `nativeImage.createThumbnailFromPath(path, size)`, which decodes and downsamples an image off the renderer's main thread without adding any npm dependency. The codebase has zero existing image-processing dependencies (confirmed via grep) — adding `sharp` or similar would pull in a native-compiled package for a need this built-in already covers.

**Alternatives considered**:
- `sharp` (npm): more control (format, quality), but native-compile step adds CI/build complexity for a feature this app's scale doesn't need.
- Generating thumbnails via an off-screen `<canvas>` in the renderer: works, but does decoding/resizing on the renderer thread (the exact problem we're trying to avoid) instead of the main process.

## Decision: Cache key = `<photoId>-<sourceFileMtimeMs>`, one file per size class

**Rationale**: The spec's "regenerate when source file changes" requirement (FR-004) needs a cheap staleness check. Using the source file's mtime (already available from `fs.statSync` in `src/main/fs/photos.ts`) as part of the cache filename makes staleness detection free: a changed file produces a different mtime, hence a different filename, hence an automatic cache miss and regeneration — no separate invalidation bookkeeping or DB column needed. This is simpler than tracking a content hash and avoids any DB schema change (Constitution Principle I: no new canonical data for what is a disposable derived cache).

**Alternatives considered**:
- Content hash (e.g. SHA-1 of file bytes): correct but requires reading the whole file to hash it — defeats the purpose of avoiding full-file reads for cheap cache checks.
- DB column tracking thumbnail generation state: adds canonical-data surface area for a purely derived, regenerable artifact: rejected as unnecessary persistence per spec's "no operator-facing changes" and Constitution Principle V (minimal additions).

## Decision: Cache location = `app.getPath('userData')/photo-thumbnails/<size>/`

**Rationale**: Matches the existing established convention in this codebase for local, non-repo, regenerable state — see `src/main/publish/index.ts` storing the Drive OAuth token and credentials under `app.getPath('userData')`. Two subdirectories (`grid`, `preview`) keep the two size classes namespaced without filename collisions.

**Alternatives considered**:
- Alongside the source photo file (e.g. `<shelter>/photos/.thumbs/`): would put generated, machine-specific cache files inside the same directory tree as repository-owned shelter photo assets, blurring the source-of-truth boundary (Constitution Principle I).

## Decision: Serve thumbnails through the existing `shelter://` protocol via a query parameter

**Rationale**: The renderer already loads all photos through `buildPhotoUrl()` → `shelter://...` URLs handled by the protocol handler in `src/main/index.ts`. Adding an optional `?size=thumb` / `?size=preview` query parameter lets the protocol handler transparently serve a cached thumbnail (generating it on first request) while falling back to the full-resolution original if generation fails — satisfying the spec's graceful-fallback edge case (FR-008) without renderer-side branching logic beyond which URL it requests.

**Alternatives considered**:
- A dedicated `thumbnail://` protocol: adds a second protocol registration and duplicate path-resolution logic for no behavioral benefit over a query param on the existing protocol.
- A new IPC channel (`PHOTOS_GET_THUMBNAIL`) returning a data URL: works, but `<img src>` over the existing protocol is simpler than wiring base64 data URLs through IPC for every thumbnail, and loses the browser's native HTTP-like caching/streaming behavior that the `shelter://` protocol already provides.

## Decision: Preview thumbnail target size — generate at a fixed upper-bound size, scaled by CSS `object-fit: contain` in each consumer

**Rationale**: The Shelters tab default photo frame and the Photos tab selected-photo preview pane are both resizable/responsive (existing CSS uses percentage widths and `aspect-ratio`, not fixed pixel dimensions — confirmed in `index.css`). Rather than generating a different thumbnail size per exact container pixel width (adds caching complexity the app's scale doesn't need, per `/speckit-clarify` Option C rejection), generate the "preview" size class at a single fixed upper bound (e.g. 800×600, matching typical max rendered width found in research) — large enough to avoid visible upscaling blur at current UI sizes, decoded once and reused via `object-fit: contain` exactly as full-resolution images are today.

**Alternatives considered**: Per-container exact-size generation (rejected in clarification as unnecessary complexity); a single thumbnail size for everything (rejected in clarification — would blur in the larger preview contexts).

## Outstanding NEEDS CLARIFICATION

None — spec clarification session resolved all open questions (performance targets, cache eviction policy, size-class strategy, full-res fallback for the editor modal).
