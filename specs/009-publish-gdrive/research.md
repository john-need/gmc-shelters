# Research: Publish to Google Drive

**Feature**: 009-publish-gdrive  
**Date**: 2026-05-27

---

## Decision 1: googleapis npm package

**Decision**: Use the official `googleapis` npm package (pure-JS Node.js client for all Google APIs including Drive v3 and OAuth2).

**Rationale**: Typed TypeScript support, built-in OAuth2 token refresh, resumable upload support, drive.files.create / update / list / get all available. No native binaries — no `electron-rebuild` needed. The Python `google-api-python-client` cannot be used from the Electron main process.

**Alternatives considered**:
- Raw `fetch`/`https` calls: rejected — would require reimplementing token refresh, retry logic, and multipart upload encoding.
- `electron-google-oauth2`: rejected — adds a dependency wrapper around the same googleapis library with no additional value.

**Package to add**: `npm install googleapis` (includes `google-auth-library` as a dependency).

---

## Decision 2: OAuth2 loopback server pattern

**Decision**: Start a local Node.js `http.createServer` on a random available port (`http://localhost:PORT`), use it as the redirect URI when generating the auth URL, open the browser via Electron's `shell.openExternal()`, capture the `code` query parameter when the browser redirects back, exchange for tokens, close the server.

**Rationale**: Standard Desktop App OAuth2 pattern documented by Google. Works in Electron without custom URI schemes or electron-specific packages. Tokens stored in `app.getPath('userData')/gmc-gdrive-token.json`.

**Key code pattern**:
```typescript
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, `http://localhost:${port}`);
const authUrl = oauth2Client.generateAuthUrl({ access_type: 'offline', scope: scopes });
shell.openExternal(authUrl);
// local http server waits for GET /?code=...
const { tokens } = await oauth2Client.getToken(code);
oauth2Client.setCredentials(tokens);
fs.writeFileSync(tokenPath, JSON.stringify(tokens));
```

**Alternatives considered**:
- `urn:ietf:wg:oauth:2.0:oob` (out-of-band): deprecated by Google as of 2022.
- Custom URI scheme (`myapp://callback`): requires OS registration, more complex setup, inconsistent on all platforms.

---

## Decision 3: Token and credentials file locations

**Decision**: Credentials at `app.getPath('userData')/credentials.json` (operator places file there once). Token cache at `app.getPath('userData')/gmc-gdrive-token.json` (written by app after first consent, refreshed automatically).

**Rationale**: `userData` is the standard Electron per-user storage location; files there survive app updates and are not committed to the repo. Adding a configurable `CREDENTIALS_PATH` setting is deferred — operator documentation covers the default location.

**Alternatives considered**:
- `app.getAppPath()` (repo root): rejected — would risk accidental git commit of credentials.
- Configurable path via Publishing settings: deferred to a future iteration; default convention is sufficient for initial rollout.

---

## Decision 4: Drive file operations

**Decision**: Use the following googleapis Drive v3 calls:

| Operation | API call |
|-----------|----------|
| List files in folder | `drive.files.list({ q: "'folderId' in parents and trashed=false", fields: 'files(id,name)', pageSize: 1000 })` |
| Create new file | `drive.files.create({ requestBody: { name, mimeType, parents: [folderId] }, media: { mimeType, body: fs.createReadStream(localPath) } })` |
| Update existing file in-place | `drive.files.update({ fileId, requestBody: {}, media: { mimeType, body: fs.createReadStream(localPath) } })` — preserves fileId and all share links |
| Download JSON file | `drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' })` then `JSON.parse(Buffer.from(data).toString())` |
| Create subfolder | `drive.files.create({ requestBody: { name: slug, mimeType: 'application/vnd.google-apps.folder', parents: [rootFolderId] } })` |
| Verify root folder | `drive.files.get({ fileId: rootFolderId, fields: 'id,name' })` — throws if inaccessible |

**Rationale**: `files.update` with only `media` (no metadata changes) replaces file content while keeping the same Drive file ID, preserving share links. This satisfies FR-005c and FR-006.

**Alternatives considered**:
- Delete + re-create: rejected — generates a new file ID, breaking all share links (spec explicitly forbids this).
- Resumable uploads: deferred — adds complexity; standard multipart upload is sufficient for photo files up to ~5 MB typical size.

---

## Decision 5: Photo match key between manifests

**Decision**: Match photos between the current (newly built) manifest and the prior Drive manifest using `photo.fileName`, which is stored as `"${slug}/${bareFileName}"` (e.g., `"aeolus-view-camp/photo.jpg"`).

**Rationale**: `fileName` is globally unique per shelter slug + file, stable across publishes, and already the key used by the Python deploy script's per-slug Drive folder structure. Photo `id` (DB integer) is not used as the key because the Drive folder structure is organised by slug/filename.

---

## Decision 6: Temp build directory

**Decision**: Build to `.publish-tmp/` at `app.getAppPath()`, cleaned up on both success and failure. The existing `DIST_PATH` Publishing setting is not used for the temp path (reserved for operator reference in a future iteration).

**Rationale**: Mirrors the existing `.export-tmp/` pattern in `src/main/export/index.ts`. Keeps the publish pipeline self-contained without requiring the operator to pre-configure a DIST_PATH.

---

## Decision 7: Concurrency guard

**Decision**: Single `isPublishing` boolean in the IPC handler module scope. A second `PUBLISH_TO_WEB` invocation while one is running returns `{ error: 'ALREADY_RUNNING' }` immediately without starting a new build or Drive session.

**Rationale**: Drive OAuth state and temp directory are not safe to share across concurrent publish runs. Simple flag is sufficient for a single-user desktop app.
