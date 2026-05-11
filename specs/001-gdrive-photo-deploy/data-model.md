# Data Model: Google Drive Photo Deploy

**Date**: 2026-05-10

---

## Entities

### ManifestPhoto (photo entry in `shelter-manifest.json`)

Represents a single photo belonging to a shelter. The deploy script reads these entries, resolves `driveFileId` from Drive, normalises `fileName`, and writes them back.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `id` | int | Upstream DB | Unique photo ID — read-only, never modified |
| `driveFileId` | string \| null | Deploy script writes | Google Drive file ID after upload/resolution; `null` until first deploy |
| `fileName` | string | Deploy script normalises | Bare filename only (e.g. `gmc-shelters_aeolus-view-camp_img.jpg`); path prefix stripped |
| `caption` | string \| null | Upstream DB | Read-only |
| `photographer` | string \| null | Upstream DB | Read-only |
| `dateTaken` | string \| null | Upstream DB | Read-only |
| `notes` | string \| null | Upstream DB | Read-only |
| `altText` | string \| null | Upstream DB | Read-only |
| `title` | string \| null | Upstream DB | Read-only |
| `description` | string \| null | Upstream DB | Read-only |
| `shelterId` | int | Upstream DB | Foreign key to parent shelter — read-only |
| `created` | string \| null | Upstream DB | Read-only |
| `updated` | string \| null | Upstream DB | Read-only |

**Invariants**:
- `fileName` MUST contain no `/` characters after deploy.
- `driveFileId` MUST be non-null for every photo after a successful full deploy.
- `id` is the identity key; `fileName` is the Drive match key (name-based lookup within shelter subfolder).

---

### ShelterManifest (top-level `shelter-manifest.json` structure)

```
{
  "created": "<ISO timestamp>",
  "shelters": [ <Shelter>, ... ]
}
```

### Shelter

```
{
  "id": int,
  "name": string,
  "slug": string,           ← used as Drive subfolder name
  "photos": [ <ManifestPhoto>, ... ],
  ... (other fields read-only)
}
```

**Key relationship**: `shelter.slug` → Drive subfolder name → photo file location on disk (`dist/{slug}/{fileName}`) and on Drive (`{ROOT_FOLDER}/{slug}/{fileName}`).

---

### DriveFileIndex (runtime, in-memory)

Transient structure built per shelter subfolder during deploy. Not persisted.

```
DriveFileIndex = {
  "slug": string,
  "folder_id": string,          ← Drive ID of the slug subfolder
  "files": { filename: drive_id, ... }   ← name → id mapping
}
```

**Usage**: Before processing each shelter, `files.list` is called once to populate `files`. Each photo lookup is an O(1) dict check.

---

### DeployState (runtime, in-memory)

Tracks overall run statistics. Printed as summary at end of run.

| Field | Type | Description |
|-------|------|-------------|
| `uploaded` | int | Photos successfully uploaded this run |
| `skipped` | int | Photos already on Drive, skipped |
| `failed` | int | Photos that failed after all retries |
| `missing_local` | int | Manifest entries with no local file in `dist/` |
| `unmatched_local` | int | Local files with no matching manifest entry |

---

## State Transitions: Photo Deployment Lifecycle

```
[Undeployed]
     │  photo exists in dist/, no Drive file
     │
     ▼
  UPLOAD ──────── HttpError (all retries) ──► [Failed] (logged, skip)
     │
     ▼
[Uploaded]  ◄──── file already on Drive ──── [Skip / Resolve ID]
     │
     ▼
driveFileId written to manifest entry
     │
     ▼
[Manifest Updated locally]
     │
     ▼
[Manifest Updated on Drive]  (after all shelters processed)
```

---

## File Locations

| Artifact | Path |
|----------|------|
| Deploy script | `scripts/deploy_to_drive.py` |
| Drive dependencies | `scripts/requirements-drive-deploy.txt` |
| Manifest (local) | `dist/shelter-manifest.json` |
| OAuth credentials | `credentials.json` (gitignored) |
| OAuth token cache | `token.json` (gitignored) |
| Photo files | `dist/{slug}/*.{jpg,webp,png}` |
