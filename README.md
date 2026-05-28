# GMC Shelters

Electron desktop app for managing GMC shelter records, photos, and publishing the archive to Google Drive.

## Development

```bash
npm install
npm start        # dev server (Electron + Vite HMR)
npm test         # Jest (main + renderer projects)
npm run make     # package for distribution
```

---

## Publish to Web

The **Publish to web** button in the app header builds a shelter manifest from the current database and deploys it — along with shelter photos — to a Google Drive folder. Only photos whose `updated` timestamp is newer than the previous publish are re-uploaded; everything else is skipped and existing Drive file IDs (share links) are preserved.

### One-time Google Cloud setup

#### 1. Create a Google Cloud project

Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (or use an existing one).

#### 2. Enable the Google Drive API

**APIs & Services → Library** → search for **Google Drive API** → Enable.

#### 3. Configure the OAuth consent screen

**APIs & Services → OAuth consent screen**

- User type: **External**
- Fill in the app name, support email, and developer contact
- Add the scope `https://www.googleapis.com/auth/drive` under **Scopes**
- Under **Test users**, add the Google account you will use to authenticate

> Until the app is published to Production status, only accounts listed as Test users can sign in. Attempting to authenticate with an unlisted account results in "No auth code received" — the sign-in is silently blocked.

#### 4. Create OAuth 2.0 credentials

**APIs & Services → Credentials → Create Credentials → OAuth client ID**

- Application type: **Desktop app**
- Download the JSON file, rename it `credentials.json`

#### 5. Place credentials.json in the app data directory

| Platform | Path |
|----------|------|
| macOS    | `~/Library/Application Support/gmc-shelters/credentials.json` |
| Windows  | `%APPDATA%\gmc-shelters\credentials.json` |

Do **not** place it inside the project repo — it must never be committed.

---

### Configure publishing in the app

1. Open the app → click the **cog icon** → **Publishing · web output**
2. Fill in the fields:

   | Field | Value |
   |-------|-------|
   | ROOT_FOLDER_ID | The ID at the end of your Drive folder URL: `drive.google.com/drive/folders/<ID>` |
   | MANIFEST_NAME | `shelter-manifest.json` (default — leave unchanged unless you have a reason) |
   | SCOPES | `https://www.googleapis.com/auth/drive` (default) |

3. Click **Save config**

---

### Test the connection

Click **Test connection** on the Publishing settings page.

- **First run**: a browser window opens for Google's OAuth consent screen. Sign in with a Test user account and click Allow. The app caches the token automatically — future runs are silent.
- **Subsequent runs**: the app verifies Drive access using the cached token and shows `✓ Connected — folder: <name>`.
- **If credentials.json is missing**: an error appears showing the expected file path.

---

### Publishing

Click **Publish to web** in the app header. The app will:

1. Build the manifest from the current database.
2. Fetch the existing Drive manifest (if any) as a baseline for diffing.
3. Upload new photos and update changed photos (by `updated` timestamp). Unchanged photos are skipped; their Drive file IDs and share links are preserved.
4. Write the updated manifest back to Drive in-place.
5. Show a result summary in a toast notification.

---

### Re-authentication

If the cached token is revoked or scopes change:

1. Delete `gmc-gdrive-token.json` from the app data directory (same folder as `credentials.json`).
2. Click **Test connection** or **Publish to web** — the browser consent flow reopens.

---

### Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `credentials.json not found` | File missing or wrong location | Place `credentials.json` in the app data directory (see step 5 above) |
| `No auth code received` | Google blocked sign-in — account is not a Test user | Add the account to **Test users** in the OAuth consent screen (step 3 above) |
| `Drive root folder not accessible` | ROOT_FOLDER_ID is wrong or the folder was deleted | Re-check the folder ID in Publishing settings |
| `Publish already in progress` | Publish button clicked twice | Wait for the current publish to finish |
| Photos not re-uploading | `updated` timestamp unchanged in the database | Edit and re-save the photo record to bump its `updated` value |

---

## Scripts

See [`scripts/README.md`](scripts/README.md) for maintenance scripts (photo bulk upload, file size audit, export).
