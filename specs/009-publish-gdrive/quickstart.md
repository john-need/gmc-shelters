# Operator Quickstart: Publish to Google Drive

**Feature**: 009-publish-gdrive  
**Audience**: Archive maintainer setting up Google Drive publishing for the first time.

---

## One-time Setup

### Step 1 — Create Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials.
2. Create a new **OAuth 2.0 Client ID** of type **Desktop app**.
3. Download the credentials JSON file.
4. Rename it to `credentials.json`.
5. Place it at:
   - **macOS**: `~/Library/Application Support/gmc-shelters/credentials.json`
   - **Windows**: `%APPDATA%\gmc-shelters\credentials.json`

> The app looks for credentials at `app.getPath('userData')/credentials.json`. Do **not** place it in the project repo directory.

### Step 2 — Enable the Google Drive API

In Google Cloud Console → APIs & Services → Library, search for **Google Drive API** and enable it for your project.

### Step 3 — Configure Publishing settings in the app

Open the app → Settings (cog icon) → Publishing.

| Field | Value |
|-------|-------|
| ROOT_FOLDER_ID | The folder ID from your Drive folder URL: `drive.google.com/drive/folders/<ID>` |
| MANIFEST_NAME | `shelter-manifest.json` (default — change only if needed) |
| SCOPES | `https://www.googleapis.com/auth/drive` (default) |

Click **Save config**.

### Step 4 — Test the connection

Click **Test connection** in the Publishing settings page.

- If credentials.json is found and no token is cached: a browser window opens for Google consent. Approve it. The app caches the token automatically.
- If a cached token exists: the app verifies Drive access and shows "Connected — folder: &lt;name&gt;".
- If credentials.json is missing: the app shows an error with the expected file path.

---

## Publishing

Click **Publish to web** in the app header.

The app will:
1. Build the dist package from the current database.
2. Fetch the existing Drive manifest (if any) as a baseline.
3. Upload or update only photos whose `updated` timestamp is newer than the prior manifest (or have never been published). Existing Drive file IDs and share links are preserved.
4. Write the updated manifest to Drive (in-place if it already exists).
5. Show a result summary: shelters processed, photos uploaded, photos updated, photos skipped, any failures.

---

## Re-authentication

If the cached token is invalidated (e.g. credentials revoked, scopes changed):

1. Delete `gmc-gdrive-token.json` from the userData directory.
2. Click **Test connection** or **Publish to web** — the browser consent flow will reopen.

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| "credentials.json not found" | File missing or wrong path | Place `credentials.json` in userData directory (see Step 1) |
| "Drive root folder not accessible" | ROOT_FOLDER_ID wrong or folder deleted | Verify folder ID in Publishing settings |
| "Publish already in progress" | Button clicked twice | Wait for the current publish to complete |
| Photos not updating on Drive | `updated` timestamp not changed in DB | Edit and re-save the photo record to bump its `updated` value |

---

## File locations

| File | Location | Committed? |
|------|----------|-----------|
| credentials.json | `app.getPath('userData')/credentials.json` | NO — never commit |
| gmc-gdrive-token.json | `app.getPath('userData')/gmc-gdrive-token.json` | NO — never commit |
| Publishing config | App localStorage (`gmc.publishing`) | NO — per-machine |
| shelter-manifest.json (Drive) | ROOT_FOLDER_ID on Google Drive | Drive-hosted |
