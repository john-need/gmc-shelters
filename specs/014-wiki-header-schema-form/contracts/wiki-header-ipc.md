# Contract: `WIKI_GET_HEADER` / `WIKI_SAVE_HEADER` (internal IPC)

Internal contract between `src/renderer/components/Settings/CollectionsManagementPage.tsx` and `src/main/ipc/wiki-search.ts`. No out-of-repo consumer.

## Before (current)

```ts
wiki.getHeader(resource: string): Promise<string | null>       // raw "---\n...\n---\n" block, or null if not added
wiki.saveHeader(resource: string, header: string): Promise<{ ok: boolean; error?: string }>
```

`saveHeader` only checks the block still starts/ends with `---` fences — no per-field validation.

## After (this feature)

```ts
interface WikiHeaderPreserved {
  type: string;        // legacy OKF label — read-only, round-tripped verbatim
  resource: string;    // read-only, system-derived
  timestamp: string;   // read-only, system-derived
  pages: string;       // read-only, system-derived (PDF page count)
}

interface WikiHeaderPayload {
  citationType: SourceType;
  fields: Record<string, string>;   // only properties applicable to citationType per the Header Schema
  preserved: WikiHeaderPreserved;
}

wiki.getHeader(resource: string): Promise<WikiHeaderPayload | null>   // null if file not added to wiki yet

wiki.saveHeader(
  resource: string,
  payload: { citationType: SourceType; fields: Record<string, string> },
): Promise<{ ok: true } | { ok: false; errors: string[] }>
```

## Behavior

- `getHeader`: reads the file's frontmatter, parses it into `fields` (keyed by property name) plus `citationType` (from the `citation_type` property) and `preserved` (from `type`/`resource`/`timestamp`/`pages`). Returns `null` if the wiki markdown file doesn't exist yet (unchanged from today).
- `saveHeader`: validates `{ citationType, fields }` against `wiki-header-schema.ts`'s table for `citationType` (required properties present, numeric properties numeric, `citationType` itself a known `SourceType`). On success, serializes `preserved` + the schema-applicable subset of `fields` into a `---\n...\n---\n` block, replaces the existing frontmatter in the markdown file, and leaves the document body untouched. On failure, returns the specific validation errors and does not touch the file.
- The renderer never constructs frontmatter text itself, in either direction — this is what makes a malformed header impossible to produce through the UI (spec FR-005/FR-006).

## Backward compatibility

None required — this is an internal-only contract with a single caller (`CollectionsManagementPage.tsx`), updated in the same change set. No persisted client depends on the old shape.
