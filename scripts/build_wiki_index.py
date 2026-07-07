#!/usr/bin/env python3
"""
Build a SQLite FTS5 search index from the wiki/ OKF markdown files.

Page-granular: one row per PDF page (kind='page') so search results carry
their page number natively, plus one row per captioned illustration
(kind='illustration') so photos are findable by caption text.

Output: wiki/search.db — opened read-only by the Electron app's wiki-search IPC.

Usage:
  python3 scripts/build_wiki_index.py

Run after ocr_to_markdown.py and (for Smoke & Blazes) split_smoke_and_blazes.py.
Always rebuilds from scratch.
"""
import json
import re
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WIKI = REPO / 'wiki'
DB_PATH = WIKI / 'search.db'

SKIP_NAMES = {'index.md', 'log.md'}


class StaleResource(Exception):
    """Raised when a doc's resource: frontmatter points at a file that no longer exists."""

FRONTMATTER_RE = re.compile(r'^---\n(.+?)\n---\n', re.DOTALL)
FIELD_RE = re.compile(r'^(\w+):\s+"?(.+?)"?\s*$', re.MULTILINE)
PAGE_MARKER_RE = re.compile(r'<!-- page: (\d+) -->')
ILLUSTRATIONS_HEADING = '## List of Illustrations'
ILLUSTRATION_RE = re.compile(
    r'^\*\s+(?P<caption>.+?)\s+\(p\.\s*(?P<page>\d+)\)'   # "* Caption (p. N)"
    r'(?:\s+—\s+!\[[^\]]*\]\((?P<image>[^)]+)\))?\s*$'    # optional " — ![..](image)"
)
UNTITLED_RE = re.compile(
    r'^\*\s+(?P<caption>Untitled illustration, p\.\s*(?P<page>\d+))'
    r'(?:\s+—\s+!\[[^\]]*\]\((?P<image>[^)]+)\))?\s*$'
)


def split_illustrations(body: str) -> tuple[str, list[dict]]:
    """Separate the List of Illustrations section from the page text."""
    idx = body.find(ILLUSTRATIONS_HEADING)
    if idx == -1:
        return body, []
    text, section = body[:idx], body[idx:]
    illustrations = []
    for line in section.splitlines():
        m = UNTITLED_RE.match(line) or ILLUSTRATION_RE.match(line)
        if m:
            illustrations.append({
                'caption': m.group('caption'),
                'page': int(m.group('page')),
                'image': m.group('image') or '',
            })
    return text, illustrations


def split_pages(body: str) -> list[tuple[int, str]]:
    """[(page_number, text)] from <!-- page: N --> markers; unmarked → page 1."""
    parts = PAGE_MARKER_RE.split(body)
    if len(parts) == 1:
        return [(1, body.strip())] if body.strip() else []
    pages = []
    # parts = [preamble, n1, text1, n2, text2, ...]
    for i in range(1, len(parts), 2):
        text = parts[i + 1].strip()
        if text:
            pages.append((int(parts[i]), text))
    return pages


def parse_md(path: Path, wiki: Path) -> list[tuple] | None:
    text = path.read_text(encoding='utf-8', errors='replace')
    m = FRONTMATTER_RE.match(text)
    if not m:
        return None

    fm: dict[str, str] = {}
    for km in FIELD_RE.finditer(m.group(1)):
        fm[km.group(1)] = km.group(2)

    body = text[m.end():].strip()
    if not body:
        return None

    resource = fm.get('resource', '')
    # a renamed/moved/deleted collections/ file leaves a dead search result — skip it
    if resource and not (wiki.parent / resource).exists():
        print(f'  skipping {path.relative_to(wiki)}: resource not found: {resource}')
        raise StaleResource(resource)

    rel = path.relative_to(wiki).as_posix()
    common = (
        rel,
        fm.get('type', ''),
        fm.get('title', path.stem),
        fm.get('publisher', fm.get('organization', '')),
        fm.get('volume', ''),
        fm.get('edition', ''),
        fm.get('printed_volume', ''),
        fm.get('printed_issue', ''),
        fm.get('author', ''),
        fm.get('publication_date', ''),
        resource,
        fm.get('citation_type', ''),
    )

    page_text, illustrations = split_illustrations(body)
    rows = []
    for page, ptext in split_pages(page_text):
        rows.append(common + ('page', page, '', ptext))
    folder = path.parent.relative_to(wiki).as_posix()
    for il in illustrations:
        image = f'{folder}/{il["image"]}' if il['image'] else ''
        rows.append(common + ('illustration', il['page'], image, il['caption']))
    return rows


def build(db_path: Path, wiki: Path) -> int:
    db_path.unlink(missing_ok=True)
    con = sqlite3.connect(db_path)
    con.execute('PRAGMA journal_mode=WAL')
    con.execute('''
        CREATE VIRTUAL TABLE wiki_fts USING fts5(
            path           UNINDEXED,
            okf_type       UNINDEXED,
            title,
            publisher      UNINDEXED,
            volume         UNINDEXED,
            edition        UNINDEXED,
            printed_volume UNINDEXED,
            printed_issue  UNINDEXED,
            author         UNINDEXED,
            publication_date UNINDEXED,
            resource       UNINDEXED,
            citation_type  UNINDEXED,
            kind           UNINDEXED,
            page           UNINDEXED,
            image          UNINDEXED,
            body,
            tokenize  = "porter unicode61"
        )
    ''')

    rows: list[tuple] = []
    skipped = 0
    for md in sorted(wiki.rglob('*.md')):
        if md.name in SKIP_NAMES:
            continue
        try:
            doc_rows = parse_md(md, wiki)
        except StaleResource:
            skipped += 1
            continue
        if doc_rows:
            rows.extend(doc_rows)

    con.executemany(
        'INSERT INTO wiki_fts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        rows,
    )
    con.commit()
    con.close()

    (db_path.parent / 'index-report.json').write_text(json.dumps({
        'indexed': len(rows),
        'skipped': skipped,
        'builtAt': datetime.now(timezone.utc).isoformat(),
    }), encoding='utf-8')

    return len(rows), skipped


def main() -> None:
    if not WIKI.exists():
        print(f'wiki/ not found at {WIKI}')
        print('Run scripts/ocr_to_markdown.py first.')
        sys.exit(1)

    print(f'Indexing {WIKI} → {DB_PATH}')
    n, skipped = build(DB_PATH, WIKI)
    print(f'Indexed {n} rows (pages + illustrations).')
    if skipped:
        print(f'Skipped {skipped} stale document(s) with missing resources.')


if __name__ == '__main__':
    main()
