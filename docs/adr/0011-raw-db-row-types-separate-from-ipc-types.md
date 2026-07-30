# Raw DB row types live in `src/types`, separate from `src/shared/ipc-types.ts`

`src/shared/ipc-types.ts` holds the app's denormalized, renderer-facing shapes
(`Shelter.architecture` is a resolved name string, booleans are `boolean`).
`src/types/{shelter,photo,map-marker,source}.ts` holds the literal column-for-column
row shapes SQLite returns (`architecture_id: number | null`, booleans as `0`/`1`) —
consolidating what used to be private, duplicated `*Row` interfaces scattered across
`src/main/db/*.ts`.

Same names (`Shelter`, `Photo`, `MapMarker`, `Source`) exist in both places on purpose:
they're the same domain concept at two different layers, not two competing definitions.
Files needing both (e.g. `db/shelters.ts`) import the raw one under an aliased name
(`Shelter as ShelterRow`) to disambiguate at the call site rather than inventing a
different name for one of them.

`shelters` is the one exception: its query joins in resolved lookup names and an
aggregate photo count, so `db/shelters.ts` extends the raw `Shelter` type locally with
those join-only fields rather than folding them into the shared type — they aren't
`shelters` table columns.

## Update (2026-07-30): `src/types/*` shifted from raw mirrors to normalized output shapes

The description above no longer matches `shelter.ts`/`photo.ts`/`map-marker.ts`/`source.ts`/
`shelter-category.ts`: these now hold camelCase, JSON-normalized shapes (`fileName`, `shelterId`,
`includeInPost: boolean`), not raw snake_case column mirrors — `architecture.ts`/`builder.ts`
still happen to match both descriptions, since neither table has a multi-word column. A new
`src/factories/` layer (`makeShelter`, `makePhoto`, etc.) now does the raw-row-to-normalized-type
conversion the private `db/*.ts` hydrate functions used to do inline. `db/{shelters,photos,
map-markers,categories}.ts` still reference the old snake_case shape internally and are
currently out of sync with `src/types`— a known, separately-tracked gap, not addressed by this
ADR or by feature `020-shelter-export-json`.

That feature (`020-shelter-export-json`) added one more wrinkle: `Shelter.architecture`/`builder`/
`category` are now `T | null` (previously required, non-null objects), since a shelter can have no
architecture/builder/category assigned. `src/factories/shelter.ts`'s `ShelterRelations` interface
was updated to match, and its `Architecture` import was corrected from `@shared/ipc-types` to the
sibling `../types/architecture` (it had been importing the wrong same-named type — matching how
`builder`/`category` already imported their own siblings).
