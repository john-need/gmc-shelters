# Contract: wiki/search.db

Producer: `scripts/build_wiki_index.py` (always rebuilds from scratch).
Consumer: `src/main/ipc/wiki-search.ts` (opens read-only at app start).

## Schema

One FTS5 virtual table:

```sql
CREATE VIRTUAL TABLE wiki_fts USING fts5(
    path           UNINDEXED,  -- wiki-relative markdown path
    okf_type       UNINDEXED,  -- Newsletter | Book | Guidebook | ...
    title,                     -- searchable
    publisher      UNINDEXED,  -- per-collection organization
    volume         UNINDEXED,  -- publication year (profile: volume = year)
    edition        UNINDEXED,  -- month or season name ("December", "Spring/Summer")
    printed_volume UNINDEXED,  -- as printed on the issue, may be ''
    printed_issue  UNINDEXED,  -- as printed on the issue, may be ''
    resource       UNINDEXED,  -- repo-relative source PDF path (under collections/)
    kind           UNINDEXED,  -- 'page' | 'illustration'
    page           UNINDEXED,  -- PDF page number (1-based)
    image          UNINDEXED,  -- wiki-relative PNG path for illustrations, else ''
    body,                      -- searchable: page text, or illustration caption
    tokenize = "porter unicode61"
);
```

## Granularity

- One row per PDF page (`kind='page'`) — search hits carry their page number.
- One row per captioned illustration (`kind='illustration'`); `body` is the caption.
- Documents without `<!-- page: N -->` markers index as a single page-1 row.

## Query shape used by the app

```sql
SELECT ..., CAST(page AS INTEGER) AS page,
       snippet(wiki_fts, -1, '<mark>', '</mark>', '…', 40) AS snippet
FROM wiki_fts WHERE wiki_fts MATCH ? ORDER BY rank LIMIT 50
```

Any schema change requires updating both the builder and
`WikiSearchResult` in `src/shared/ipc-types.ts`, plus the fixture in
`src/main/ipc/wiki-search.test.ts` and `tests/integration/test_build_wiki_index.py`.
