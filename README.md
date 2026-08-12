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

## Release Notes

### v1.0.0 — 2026-05-28

First production release. Powers the public [Green Mountain Club Shelter History](https://gmcburlington.org/long-trail-system-shelter-history/) app on the GMC Burlington website.

- Shelter record browser and editor with SQLite-backed storage.
- Architecture dropdown backed by a dedicated `architectures` database table; legacy values displayed as a selectable option until updated.
- Photo management: bulk upload, EXIF extraction, per-shelter photo gallery.
- Shelter histories: per-shelter markdown history files editable in-app.
- macOS `.dmg`, Windows `.zip`, and Linux `.zip` build targets via Electron Forge.
