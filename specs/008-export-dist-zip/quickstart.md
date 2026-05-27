# Quickstart: Export Dist Zip

## What this does

The **Export** button in the app header builds a complete distributable package from the
local database and shelter files, zips it, and saves it to a folder you choose. The zip
contains `shelter-manifest.json` and per-shelter photo + history files.

The in-app Export supersedes running `build_dist_package.py` + manual zip by hand.

---

## How to export

1. Open **GMC Shelters** desktop app.
2. Click **Export** in the header bar.
3. The button shows a loading state while the package is built (up to ~60 s for a full dataset).
4. A folder-picker dialog appears. Select the destination folder and confirm.
5. A success toast shows the filename (e.g. `gmc-shelters-export-20260527.zip`) and path.

The export button re-enables automatically after success or failure.

---

## Output

A zip file named `gmc-shelters-export-YYYYMMDD.zip` is written to the selected folder.
The date is UTC. Running Export again on the same day overwrites the file in the chosen
folder if a file with the same name already exists there.

---

## Verifying the export

Use the validation steps in
[`specs/008-export-dist-zip/contracts/zip-layout.md`](contracts/zip-layout.md) to verify
that the archive is structurally sound before deploying.

---

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Error toast: "Failed to open database" | Database not at expected path | Check Paths settings in the app |
| Export completes but some photos missing | Photos marked `include_in_post` but file absent | Run Photos → Reconcile to fix orphaned records |
| Error toast: "Failed to write zip" | Destination folder is read-only | Choose a writable folder |
| No history file in zip for a shelter | `{slug}.md` absent from `shelters/{slug}/` | Write history via the History tab, then export again |

---

## Notes for developers

- Temporary build files are written to `{repoRoot}/.export-tmp/` and cleaned up after each run.
- The Python script `scripts/build_dist_package.py` remains in place for reference and offline use,
  but queries the deprecated `timelines` table. Prefer the in-app Export for current exports.
- The `archiver` npm package must be present (`npm install archiver @types/archiver`).
