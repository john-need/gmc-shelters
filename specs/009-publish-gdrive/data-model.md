# Data Model: Publish to Google Drive

**Feature**: 009-publish-gdrive  
**Date**: 2026-05-27

---

## Entities

### PublishingConfig

Persisted in renderer localStorage under key `gmc.publishing`. Passed to the main process via IPC on each publish or connection-test invocation.

| Field | Type | Description |
|-------|------|-------------|
| ROOT_FOLDER_ID | string | Google Drive folder ID of the publish target root |
| DIST_PATH | string | Local path annotation (operator reference; not used for temp build) |
| MANIFEST_NAME | string | Filename of the manifest at Drive root (default: `shelter-manifest.json`) |
| SCOPES | string[] | OAuth2 scopes to request (default: `['https://www.googleapis.com/auth/drive']`) |

**Validation rules**: ROOT_FOLDER_ID MUST be non-empty before publish. MANIFEST_NAME defaults to `shelter-manifest.json` if blank.

---

### OAuth2Credential

Stored by the operator at `app.getPath('userData')/credentials.json`. Never committed to the repo.

| Field | Type | Description |
|-------|------|-------------|
| installed.client_id | string | OAuth2 client ID from Google Cloud Console |
| installed.client_secret | string | OAuth2 client secret |
| installed.redirect_uris | string[] | Allowed redirect URIs (loopback added at runtime) |

---

### OAuth2Token (cached)

Written to `app.getPath('userData')/gmc-gdrive-token.json` after first consent. Refreshed automatically when expired.

| Field | Type | Description |
|-------|------|-------------|
| access_token | string | Short-lived access token |
| refresh_token | string | Long-lived refresh token (present after first `access_type: 'offline'` consent) |
| expiry_date | number | Unix ms timestamp of access_token expiry |
| token_type | string | `"Bearer"` |

---

### PhotoEntry (manifest, extended)

Existing `PhotoEntry` in `src/main/export/builder.ts` gains one new optional field:

| Field | Type | Description |
|-------|------|-------------|
| id | number | DB photo ID |
| fileName | string | `"${slug}/${bareFileName}"` — match key across manifests |
| updated | string | ISO timestamp from DB `photos.updated` column — upload decision key |
| driveFileId | string \| null | Drive file ID written after upload/update; carried forward from prior manifest if photo unchanged |
| photographer | string | |
| caption | string | |
| dateTaken | string | |
| notes | string | |
| created | string | |
| shelterId | number | |
| altText | string | |
| title | string | |
| description | string | |

**Key invariant**: `driveFileId` for an unchanged photo MUST equal the value from the prior Drive manifest. `driveFileId` for a re-uploaded photo MUST equal the Drive file ID returned by `files.update` (same as the prior `driveFileId`). `driveFileId` for a newly uploaded photo is the new ID from `files.create`.

---

### DriveFileIndex

In-memory only (not persisted). Built at the start of each shelter's processing.

```typescript
type DriveFileIndex = Map<string, string>; // filename → driveFileId
```

Built by calling `drive.files.list` on the slug subfolder. Used to resolve existing file IDs and detect files already on Drive.

---

### PublishResult

Returned to the renderer via IPC on completion.

| Field | Type | Description |
|-------|------|-------------|
| shelterCount | number | Total shelters in manifest |
| photosUploaded | number | New photos created on Drive |
| photosUpdated | number | Existing Drive files updated in-place (content replaced) |
| photosSkipped | number | Photos with unchanged `updated` timestamp — no Drive call made |
| photosFailed | number | Photos that encountered a Drive API error |
| photosMissing | number | Photos with no local file in build output |
| skippedBuildPhotos | number | Photos excluded by `buildManifest()` (not `include_in_post`) |
| manifestWritten | boolean | Whether the manifest was successfully written to Drive |

---

### ConnectionTestResult

Returned to the renderer after a "Test connection" IPC call.

| Field | Type | Description |
|-------|------|-------------|
| ok | boolean | `true` if Drive root folder is reachable with current credentials |
| message | string | Human-readable status: e.g. "Connected — folder: My Shelters" or error description |

---

## State Transitions

### Photo upload decision

```
photo (current manifest)
  │
  ├─ prior manifest unavailable (first publish / fetch failed)
  │   └─ UPLOAD (create new or update existing by filename match on Drive)
  │
  ├─ no prior entry for this photo.fileName
  │   └─ UPLOAD
  │
  ├─ prior entry has no `updated` field
  │   └─ UPLOAD
  │
  ├─ photo.updated > prior.updated
  │   ├─ prior.driveFileId exists → UPDATE in-place (files.update, same ID)
  │   └─ prior.driveFileId null  → CREATE new file (files.create, new ID)
  │
  └─ photo.updated ≤ prior.updated
      └─ SKIP — carry forward prior.driveFileId into new manifest
```

### Manifest write decision

```
manifest
  ├─ existing Drive manifest found (files.list hit)
  │   └─ UPDATE in-place (files.update with existing fileId)
  └─ no existing Drive manifest
      └─ CREATE new file (files.create with parents: [rootFolderId])
```
