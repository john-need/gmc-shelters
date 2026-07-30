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
