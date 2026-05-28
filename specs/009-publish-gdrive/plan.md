# Implementation Plan: Publish to Google Drive

**Branch**: `009-publish-gdrive` | **Date**: 2026-05-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/009-publish-gdrive/spec.md`

## Summary

Wire the existing "Publish to web" button in the Electron app to: (1) build the dist package using the current `buildManifest()` pipeline, (2) authenticate with Google Drive via OAuth2, (3) fetch the prior Drive manifest as a baseline, (4) upload or in-place-update only photos whose `updated` timestamp is newer than the prior manifest entry (or has no prior entry), (5) carry forward `driveFileId` values for unchanged photos, and (6) write the updated manifest back to Drive in-place. All Drive configuration (ROOT_FOLDER_ID, MANIFEST_NAME, SCOPES) is read from the Publishing settings stored in the app. The "Test connection" button in Settings › Publishing is wired to a live Drive API call.

## Technical Context

**Language/Version**: TypeScript 5.6, Node.js (Electron 32 main process)  
**Primary Dependencies**: `googleapis` (npm) for Drive API + OAuth2; `google-auth-library` (npm, bundled with googleapis) for token management; existing `src/main/export/builder.ts` for manifest build; Node.js built-ins (`http`, `fs`, `path`)  
**Storage**: Drive manifest fetched from ROOT_FOLDER_ID at publish time; OAuth2 token cached at `app.getPath('userData')/gmc-gdrive-token.json`; credentials.json placed by operator at `app.getPath('userData')/credentials.json` (configurable via settings)  
**Testing**: Jest (existing two-project config); Drive client mocked with `jest.mock`; no live Drive calls in tests  
**Target Platform**: Electron 32 desktop app, macOS/Windows; main process only (no renderer-side Drive code)  
**Performance Goals**: Full publish of a 250-shelter archive (≈1000 photos) completes in operator-acceptable time; unchanged photos produce zero Drive API upload calls  
**Constraints**: Idempotent reruns via `updated` timestamp comparison; manifest updated in-place (same Drive file ID); photo files updated in-place when changed; no Google credentials committed to repo  
**Scale/Scope**: ~250 shelters, ~1000 photos, 1 manifest file; Drive subfolder per shelter slug; one OAuth2 credential pair per operator machine

## Constitution Check

- [X] **Source of truth identified**: SQLite (`photos`, `shelters`, `map_markers` tables) and local `shelters/` assets are the canonical inputs; Drive is the publish target, not a data source.
- [X] **Test-first scope identified**: Jest tests for `gdrive.ts` (mocked googleapis), `publish/index.ts` (mocked builder + gdrive), and `ipc/publish.ts` (mocked handlers) are planned before implementation tasks.
- [X] **External contract coverage identified**: The Drive-hosted `shelter-manifest.json` schema (with `driveFileId` per photo) is documented in `contracts/manifest-schema.json`; operator setup steps in `quickstart.md`.
- [X] **Idempotency and auditability identified**: Upload decision is per-photo `updated` timestamp comparison; unchanged photos skip Drive calls; result summary accounts for uploaded + skipped + failed + missing = total. No dry-run mode needed (comparison is already non-destructive; operator can see counts before the write).
- [X] **Minimal-change fit identified**: New code under `src/main/publish/` and `src/main/ipc/publish.ts`; new `googleapis` npm dependency justified (no TypeScript Drive SDK alternative exists); all other changes extend existing files (ipc-types, preload, AppHeader, PublishingPage).
- [X] **WordPress/theme boundary respected**: No WordPress assumptions; Drive is the only external system; manifest schema is the documented consumer contract.

> **Complexity note (Principle V)**: The constitution's `scripts/` and `tests/` paths refer to the Python automation layer of this repo. This feature is implemented in the Electron app (TypeScript, `src/main/`), which has its own established structure. New files under `src/main/publish/` follow the same pattern as `src/main/export/`. This is justified and not a violation.

## Project Structure

### Documentation (this feature)

```text
specs/009-publish-gdrive/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── manifest-schema.json   ← Drive-hosted manifest contract
└── tasks.md
```

### Source Code (Electron app)

```text
src/
├── main/
│   ├── publish/
│   │   ├── gdrive.ts           ← Drive client: auth, upload, update, list, fetch
│   │   ├── gdrive.test.ts
│   │   ├── index.ts            ← orchestrate build → diff → deploy
│   │   └── index.test.ts
│   └── ipc/
│       ├── publish.ts          ← IPC handlers: PUBLISH_TO_WEB, PUBLISH_TEST_CONNECTION
│       └── publish.test.ts
└── shared/
    └── ipc-types.ts            ← add PUBLISH_TO_WEB, PUBLISH_TEST_CONNECTION, PublishResult, PublishingConfig

src/renderer/
├── components/AppShell/AppHeader.tsx   ← wire Publish button to IPC
├── components/Settings/PublishingPage.tsx  ← wire "Test connection" button
├── hooks/useIpc.ts             ← add publish stubs to noopApi
└── setupTests.ts               ← add publish mocks
```

## Phase 0: Research

See [research.md](./research.md) for all decisions. Summary:

- **googleapis npm package** chosen over a custom HTTP client: provides typed Drive v3 API, built-in OAuth2 token refresh, and is the de-facto Node.js standard for Google API access.
- **OAuth2 loopback server pattern**: `OAuth2Client` with redirect URI `http://localhost:PORT`; local Node.js `http.createServer` captures the auth code; `shell.openExternal()` opens the browser. Token written to `app.getPath('userData')/gmc-gdrive-token.json`.
- **Credentials file convention**: `app.getPath('userData')/credentials.json` by default; a `CREDENTIALS_PATH` field may be added to Publishing settings in a future iteration (deferred — path is a planning detail per spec assumptions).
- **Drive file update**: `drive.files.update({ fileId, media: { body: readStream } })` replaces content while preserving the file ID and any shared links.
- **Prior manifest fetch**: `drive.files.list` to find manifest by name in ROOT_FOLDER_ID, then `drive.files.get({ fileId, alt: 'media' })` to download JSON content.
- **Photo match key**: `photo.fileName` as stored in the manifest (`${slug}/${bare}`); used as the lookup key into the prior manifest's photo index.
- **DIST_PATH setting**: not used for temp build output (which goes to `.publish-tmp/`); reserved for operator reference or future use.

## Phase 1: Design & Contracts

See [data-model.md](./data-model.md) for entity definitions and [contracts/manifest-schema.json](./contracts/manifest-schema.json) for the Drive manifest schema.

### IPC Interface

**New channels** (added to `CHANNELS` in `ipc-types.ts`):

```
PUBLISH_TO_WEB        = 'publish:toWeb'
PUBLISH_TEST_CONNECTION = 'publish:testConnection'
```

**`PUBLISH_TO_WEB` payload** (renderer → main):

```typescript
interface PublishToWebInput {
  rootFolderId: string;
  manifestName: string;
  scopes: string[];
}
```

**`PublishResult`** (main → renderer):

```typescript
interface PublishResult {
  shelterCount: number;
  photosUploaded: number;
  photosUpdated: number;   // in-place content replacement
  photosSkipped: number;   // unchanged (updated timestamp not newer)
  photosFailed: number;
  photosMissing: number;
  skippedBuildPhotos: number;
  manifestWritten: boolean;
}
```

**`ConnectionTestResult`** (main → renderer):

```typescript
interface ConnectionTestResult {
  ok: boolean;
  message: string;
}
```

### Key design decisions

**Upload decision per photo**:
```
prior = priorManifest?.shelters
         .flatMap(s => s.photos)
         .find(p => p.fileName === photo.fileName)

if (!prior || !prior.updated || photo.updated > prior.updated):
  if prior?.driveFileId:  drive.files.update(prior.driveFileId, content)  → same ID
  else:                   drive.files.create(content, folderId)            → new ID
else:
  carry forward prior.driveFileId into new manifest (no Drive call)
```

**Manifest update strategy**: `drive.files.update(manifestFileId, newContent)` — file ID from prior `files.list` result; if not found, `files.create`.

**Concurrency guard**: `isPublishing` boolean in the IPC handler; second invocation returns early with a specific error code.

**Temp directory**: `.publish-tmp/` at `app.getAppPath()` — cleaned up after deploy (success or error).

## Complexity Tracking

| Item | Why Needed | Alternative Rejected Because |
|------|-----------|------------------------------|
| `googleapis` npm dependency | Only typed TypeScript SDK for Google Drive v3 + OAuth2 | Raw `fetch`/`http` calls would require reimplementing token refresh, resumable upload, and retry logic — high risk |
| `src/main/publish/` new directory | Publish has distinct build→diff→deploy lifecycle separate from export | Merging into `src/main/export/` would entangle unrelated save-to-file vs. deploy-to-Drive flows |
