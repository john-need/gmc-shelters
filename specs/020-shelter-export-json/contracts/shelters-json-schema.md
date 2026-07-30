# Contract: `shelters.json`

**Consumer**: out-of-repo WordPress deployment script (per `spec.md`'s Out-of-Repo Consumers).
This document is the contract that consumer must be updated against — no WordPress-side code is
implemented in this repo.

**Location in package**: archive root, alongside one photo folder per shelter (see
`data-model.md`'s `ShelterExportPackage` layout).

**Replaces**: `shelter-manifest.json` (produced by the pre-existing `008-export-dist-zip`
feature). This is a breaking shape change for the WordPress consumer, not an additive one.

## Shape

```json
{
  "shelters": [ /* Shelter[] — see below */ ],
  "architectures": [ /* Architecture[] */ ],
  "shelterCategories": [ /* ShelterCategory[] */ ],
  "builders": [ /* Builder[] */ ]
}
```

## `Shelter`

```json
{
  "id": 7,
  "name": "Birch Glen Lodge",
  "startYear": 1932,
  "endYear": null,
  "description": "...",
  "slug": "birch-glen-lodge",
  "defaultPhotoId": 3,
  "isGMC": true,
  "architecture": { "id": 1, "name": "Log Cabin", "description": null, "created": "...", "updated": "..." },
  "builder": null,
  "category": { "id": 2, "categoryName": "Lodge", "description": null, "created": "...", "updated": "..." },
  "notes": "",
  "created": "2020-01-01",
  "updated": "2020-01-02",
  "showOnWeb": true,
  "history": "birch-glen-lodge/birch-glen-lodge.md",
  "photos": [ /* Photo[] */ ],
  "sources": [ /* Source[] */ ],
  "mapMarkers": [ /* MapMarker[] */ ]
}
```

- `architecture`, `builder`, `category`: **`null` when unassigned** — never omitted, never a
  placeholder object with empty strings. A consumer MUST null-check these three fields.
- `photos`, `sources`, `mapMarkers`: always arrays, `[]` when a shelter has none — never omitted,
  never `null`.
- `history`: a relative path string pointing at the `.md` file copied into this shelter's export
  folder (`{slug}/{filename}.md`), or `null` if the shelter has no history file. The file itself,
  not just this path, is present in the archive when non-null.
- Every shelter and every photo is included regardless of `showOnWeb`/`includeInPost` — this
  export is not filtered to web-published content.

## `Photo`

```json
{
  "id": 3, "photographer": null, "fileName": "birch-glen-lodge/photos/view.jpg",
  "caption": null, "dateTaken": null, "notes": null, "created": "...", "updated": "...",
  "shelterId": 7, "altText": null, "title": null, "description": null,
  "includeInPost": true, "sortOrder": 1
}
```

`fileName` is the path used to locate the copied file inside this shelter's export folder.

## `Source`

```json
{
  "id": 1, "type": "book", "author": "Smith, J.", "title": "...", "containerTitle": "",
  "containerAuthor": "", "editor": "", "edition": "", "volume": "", "issue": "", "pages": "",
  "publisher": "", "place": "", "year": 1963, "date": "", "url": "", "accessDate": "",
  "archive": "", "archiveLocation": "", "created": "...", "updated": "..."
}
```

Bibliographic fields only — no per-shelter annotation/quote fields (see `data-model.md`'s
Relationships note; this is a pre-existing, documented gap, not introduced by this feature).

## `MapMarker`

```json
{
  "id": 1, "shelterId": 7, "latitude": 44.1, "longitude": -72.9, "name": "",
  "startYear": 1930, "endYear": null, "changeType": "Original", "notes": "",
  "isExtant": true, "photoId": null, "created": "...", "updated": "..."
}
```

## `Architecture` / `ShelterCategory` / `Builder`

```json
{ "id": 1, "name": "Log Cabin", "description": null, "created": "...", "updated": "..." }
{ "id": 2, "categoryName": "Lodge", "description": null, "created": "...", "updated": "..." }
{ "id": 3, "name": "GMC", "type": "organization", "notes": "", "created": "...", "updated": "..." }
```

## Compatibility

There is no version field and no dual-write of the old `shelter-manifest.json` shape (Clarification
Q1 — this replaces it outright). The WordPress deployment script must be updated to read this
shape before the next export is published; that update is out of scope for this repo.
