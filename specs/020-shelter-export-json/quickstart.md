# Quickstart: Shelter Export as Normalized JSON

## For operators

Click **Export** in the app header, same as before. Choose a destination folder when prompted.
The app saves a dated `gmc-shelters-export-YYYYMMDD.zip` there containing:

- `shelters.json` — every shelter in the database (not just ones marked "show on web"), each with
  its architecture, builder, category, photos, sources, and map markers nested inline, plus
  top-level `architectures`, `shelterCategories`, and `builders` reference lists.
- One folder per shelter, named for its slug, containing that shelter's photo files and its
  history `.md` file (when it has one).

This replaces the old `shelter-manifest.json` — the archive no longer contains that file. If a
photo's file is missing from disk, the export still completes; the completion toast reports how
many photos were skipped.

## For the WordPress deployment script maintainer

See `contracts/shelters-json-schema.md` for the exact shape. The key changes from
`shelter-manifest.json`:

- File renamed: `shelter-manifest.json` → `shelters.json`.
- No more filtering: every shelter and every photo appears, regardless of the old
  `show_on_web`/`include_in_post` flags.
- Shape changed: `architecture`/`builder`/`category` are now nested objects (`null` when
  unassigned), not flat name strings. `photos`/`sources`/`mapMarkers` are nested inside each
  shelter rather than only `photos`/`mapMarkers` (no `sources` were in the old manifest at all).
- New top-level `architectures`, `shelterCategories`, `builders` arrays — the complete reference
  tables, independent of which shelters use them.

## For developers

The rewritten export logic lives in `src/main/export/builder.ts`, built on:

- `src/factories/shelter.ts`'s `makeShelter(row, relations)` — the shared normalization step
  (`FR-002`).
- `src/main/db/builders.ts`'s new `getAllBuilders()` (added by this feature — the only reference
  table that didn't already have one).

Run the export test suite: `npx jest src/main/export src/main/db/builders.test.ts`.
