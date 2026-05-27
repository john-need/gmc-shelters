# Contract: Export Zip Archive Layout

**Version**: 1.0.0
**Feature**: 008-export-dist-zip
**Consumer**: WordPress deployment (`scripts/deploy_to_drive.py`), offline operators

---

## Archive Structure

```
gmc-shelters-export-YYYYMMDD.zip
├── shelter-manifest.json
└── {slug}/
    ├── {slug}.md              (present if history file exists on disk)
    └── {photo-filename}       (one entry per include_in_post photo that exists on disk)
```

- The date portion `YYYYMMDD` in the filename uses UTC.
- `shelter-manifest.json` is always at the archive root.
- Per-shelter directories are created only when the shelter has at least one photo or a history file.
- Shelters with `show_on_web = false` are excluded entirely.

---

## `shelter-manifest.json` Shape

```json
{
  "created": "<ISO 8601 UTC timestamp>",
  "shelters": [
    {
      "id": 1,
      "name": "Shelter Name",
      "slug": "shelter-name",
      "startYear": 1965,
      "endYear": null,
      "description": "Plain text description.",
      "longitude": -72.960156,
      "latitude": 43.203333,
      "defaultPhotoId": 42,
      "isGmc": true,
      "architecture": "Lean-to",
      "builtBy": "USFS",
      "notes": "",
      "created": "2024-01-01",
      "updated": "2026-05-19",
      "isExtant": true,
      "category": "Backcountry",
      "historyFile": "shelter-name/shelter-name.md",
      "historyUpdated": "2026-04-15T14:32:00.000Z",
      "content": "Full plain-text history content.",
      "mapMarkers": [
        {
          "id": 1,
          "name": "Shelter Name",
          "latitude": 43.203333,
          "longitude": -72.960156,
          "notes": null,
          "shelterId": 1,
          "startYear": 1965,
          "endYear": null,
          "changeType": "Original",
          "isExtant": true,
          "slug": "shelter-name",
          "defaultPhotoId": 42
        }
      ],
      "photos": [
        {
          "id": 42,
          "photographer": "",
          "fileName": "shelter-name/photo.jpg",
          "caption": "Photo caption",
          "dateTaken": "",
          "notes": "",
          "created": "2024-01-01",
          "updated": "2026-05-19",
          "shelterId": 1,
          "altText": "Alt text",
          "title": "Photo Title",
          "description": "Description"
        }
      ]
    }
  ]
}
```

---

## Null / Absent Field Rules

| Field | Absent condition | Value |
|---|---|---|
| `historyFile` | `{slug}.md` not on disk | `null` |
| `historyUpdated` | `{slug}.md` not on disk | `null` |
| `endYear` (shelter) | Extant shelter | `null` |
| `endYear` (mapMarker) | Final / current location | `null` |
| `longitude` / `latitude` (shelter) | No map markers | `null` |

---

## Consumer Validation Steps

Before deploying an export zip, run:

```bash
# 1. Verify manifest is present at root
unzip -l gmc-shelters-export-*.zip | grep shelter-manifest.json

# 2. Verify all historyFile paths resolve inside the zip
python3 -c "
import json, zipfile, sys
zf = zipfile.ZipFile(sys.argv[1])
names = set(zf.namelist())
m = json.loads(zf.read('shelter-manifest.json'))
missing = [s['historyFile'] for s in m['shelters']
           if s['historyFile'] and s['historyFile'] not in names]
print('Missing history files:', missing or 'none')
" gmc-shelters-export-*.zip

# 3. Spot-check a shelter directory
unzip -l gmc-shelters-export-*.zip | grep "^.*aeolus-view-camp/"
```
