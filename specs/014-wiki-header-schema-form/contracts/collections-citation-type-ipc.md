# Contract: `COLLECTIONS_SET_CITATION_TYPE` (internal IPC, new)

Internal contract between `CollectionsManagementPage.tsx` and `src/main/ipc/collections.ts`. No out-of-repo consumer. `COLLECTIONS_STATUS` (existing, unchanged shape aside from one new field) is the read side.

## Read side — `COLLECTIONS_STATUS` (extended)

```ts
interface CollectionStatus {
  name: string;
  total: number;
  added: number;
  cleaned: number;
  files: CollectionFileStatus[];
  citationType: string | null;   // NEW — the collection's current metadata.yaml citation_type, or null if unset
}
```

`scripts/collection_status.py` → `scan()` reads this via the already-existing `load_collection_meta(folder).get('citation_type')` — no new file I/O, just one more field surfaced in the existing JSON payload the Electron app already polls.

## Write side — `COLLECTIONS_SET_CITATION_TYPE` (new)

```ts
collections.setCitationType(
  collectionName: string,
  citationType: SourceType,
): Promise<{ ok: boolean; error?: string }>
```

- Main-process handler shells out (same `spawn('python3', …)` pattern already used for `COLLECTIONS_RUN`) to `scripts/set_collection_citation_type.py <collectionName> <citationType>`.
- The script calls `set_collection_citation_type(collection_dir, citation_type)` (new, in `scripts/lib/wiki_convert.py`), which patches (or inserts) the top-level `citation_type: "..."` line in that collection's `metadata.yaml`, leaving every other line untouched.
- Per spec FR-009: this call only affects the collection's default for *future* conversions. It never touches already-converted files under `wiki/`.
- Returns `{ ok: false, error }` if the collection folder doesn't exist or the script exits non-zero; the metadata.yaml file is left unmodified in that case.

## Backward compatibility

`CollectionStatus.citationType` is additive — existing consumers of `COLLECTIONS_STATUS` ignore fields they don't read. `COLLECTIONS_SET_CITATION_TYPE` is a new channel with a single caller introduced in this same change set.
