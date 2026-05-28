# GMC Shelters

A desktop application for managing and publishing the Green Mountain Club's Long Trail shelter archive — photos, records, histories, and metadata — to Google Drive.

---

## The Long Trail & the Green Mountain Club

The [Long Trail](https://www.greenmountainclub.org/the-long-trail/) is the oldest long-distance hiking trail in the United States. Running 273 miles from the Massachusetts border to the Canadian border along the spine of the Green Mountains of Vermont, it was completed in 1930 and served as the inspiration for the Appalachian Trail.

The **Green Mountain Club (GMC)**, founded in 1910, built the Long Trail and remains responsible for its maintenance, stewardship, and public access. The GMC is supported by thousands of members, volunteers, and trail crews who keep the path open and safe year-round.

### The Shelter System

Along the Long Trail, the GMC maintains a network of backcountry shelters — lean-tos, lodges, and cabins spaced roughly a day's hike apart. These shelters give hikers a place to rest, sleep, and take cover from Vermont's notoriously unpredictable weather. Each shelter has its own character and history: some date back to the trail's earliest decades, others have been rebuilt or relocated over the years.

This application manages the GMC's archive of those shelters: their names, locations, construction details, architectural notes, caretaker histories, and the photo collections that document how each shelter looks and changes over time.

---

## What This App Does

GMC Shelters is the data management tool behind the **[Green Mountain Club Shelter History](https://gmcburlington.org/long-trail-system-shelter-history/)** app on the GMC Burlington website. That public-facing app lets hikers and trail enthusiasts explore the history, photos, and details of every shelter on the Long Trail. This desktop app is how that data is maintained and published.

GMC Shelters is an [Electron](https://www.electronjs.org/) desktop application built for GMC staff to:

- **Browse and edit shelter records** — names, locations, notes, architecture, and associated metadata stored in a local SQLite database.
- **Manage shelter photos** — bulk upload, review, and organize images linked to individual shelters; EXIF data is extracted automatically.
- **Publish to Google Drive** — generate a `shelter-manifest.json` from the current database and deploy it alongside shelter photos to a configured Drive folder. Only changed photos (by `updated` timestamp) are re-uploaded; existing Drive file IDs and share links are preserved across publishes.
- **Track shelter histories** — maintain markdown history files per shelter alongside the database records.

The app stores all data locally. Google Drive is a publication target, not a source of truth.

**Stack:** Electron 32 · Vite · React 18 · Redux Toolkit · SQLite (better-sqlite3) · TypeScript · MUI

---

## Development

```bash
npm install
npm start        # dev server (Electron + Vite HMR)
npm test         # Jest (main + renderer test projects)
npm run lint     # ESLint
```

---

## Building a Release

The app uses [Electron Forge](https://www.electronforge.io/) to package and produce platform installers. **Builds must be run on the target platform** — cross-compilation is not supported.

### macOS

Produces a `.dmg` installer.

```bash
npm run make
# Output: out/make/*.dmg
```

Requires Xcode command-line tools. The app bundle ID is `tech.inulabs.gmc-shelters`.

### Windows

Produces a `.zip` archive containing the packaged app.

```bash
npm run make
# Output: out/make/zip/win32/x64/*.zip
```

Run from a Windows machine or a Windows CI environment. No additional signing configuration is included by default.

### Linux

Produces a `.zip` archive containing the packaged app.

```bash
npm run make
# Output: out/make/zip/linux/x64/*.zip
```

Run from a Linux machine. Requires standard build tools (`build-essential` or equivalent).

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

---

## Release Notes

### v1.0.0 — 2026-05-28

First production release. Powers the public [Green Mountain Club Shelter History](https://gmcburlington.org/long-trail-system-shelter-history/) app on the GMC Burlington website.

- Shelter record browser and editor with SQLite-backed storage.
- Architecture dropdown backed by a dedicated `architectures` database table; legacy values displayed as a selectable option until updated.
- Photo management: bulk upload, EXIF extraction, per-shelter photo gallery.
- Shelter histories: per-shelter markdown history files editable in-app.
- Settings screen (cog icon) with publishing configuration for Google Drive output.
- **Publish to web**: incremental publish to Google Drive — builds `shelter-manifest.json`, uploads new/changed photos, skips unchanged photos, preserves Drive file IDs and share links across runs.
- OAuth 2.0 authentication flow for Google Drive with token caching.
- Test connection button to verify Drive credentials before publishing.
- macOS `.dmg`, Windows `.zip`, and Linux `.zip` build targets via Electron Forge.
