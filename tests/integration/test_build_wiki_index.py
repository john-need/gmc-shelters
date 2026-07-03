"""Integration tests for scripts/build_wiki_index.py — page-granular FTS5 index."""
from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import build_wiki_index as bwi

DOC = '''---
type: "Newsletter"
citation_type: "magazine"
title: "Long Trail News"
description: "Long Trail News, December 1922."
resource: "collections/long-trail-news/1922_12_Dec.pdf"
timestamp: "2026-07-02T00:00:00Z"
publisher: "Green Mountain Club"
volume: "1922"
edition: "December"
printed_volume: "5"
printed_issue: "2"
pages: "3"
language: "en"
---

<!-- page: 1 -->
The first Patrol Day was held in May.

<!-- page: 2 -->
Monroe Lodge will be built on Camel's Hump next year.

<!-- page: 3 -->
Extracts from letters received by the club.

## List of Illustrations

* Monroe Lodge under construction (p. 2) — ![Monroe Lodge under construction](images/1922_12_Dec_p2_0.png)
* Untitled illustration, p. 3 — ![Untitled illustration, p. 3](images/1922_12_Dec_p3_0.png)
'''


def build_db(tmp_path: Path) -> sqlite3.Connection:
    wiki = tmp_path / 'wiki' / 'long-trail-news'
    wiki.mkdir(parents=True)
    (wiki / '1922_12_Dec.md').write_text(DOC, encoding='utf-8')
    resource = tmp_path / 'collections' / 'long-trail-news' / '1922_12_Dec.pdf'
    resource.parent.mkdir(parents=True)
    resource.write_bytes(b'fake pdf bytes')
    db_path = tmp_path / 'search.db'
    bwi.build(db_path, tmp_path / 'wiki')
    return sqlite3.connect(db_path)

def query(con: sqlite3.Connection, match: str) -> list[dict]:
    cur = con.execute(
        'SELECT path, kind, title, publisher, volume, edition, printed_volume,'
        ' printed_issue, resource, citation_type, page, image, body FROM wiki_fts'
        ' WHERE wiki_fts MATCH ? ORDER BY rank', (match,))
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def test_search_hit_carries_its_page_number(tmp_path: Path):
    con = build_db(tmp_path)
    rows = query(con, 'Monroe Lodge')
    pages = {r['page'] for r in rows if r['kind'] == 'page'}
    assert pages == {2}
    r = next(r for r in rows if r['kind'] == 'page')
    assert r['publisher'] == 'Green Mountain Club'
    assert r['volume'] == '1922'
    assert r['edition'] == 'December'
    assert r['printed_volume'] == '5'
    assert r['citation_type'] == 'magazine'
    assert r['printed_issue'] == '2'
    assert r['resource'] == 'collections/long-trail-news/1922_12_Dec.pdf'


def test_each_page_is_its_own_row(tmp_path: Path):
    con = build_db(tmp_path)
    assert query(con, 'Patrol')[0]['page'] == 1
    assert query(con, 'Extracts')[0]['page'] == 3


def test_illustration_captions_are_searchable(tmp_path: Path):
    con = build_db(tmp_path)
    rows = [r for r in query(con, 'construction') if r['kind'] == 'illustration']
    assert len(rows) == 1
    assert rows[0]['page'] == 2
    assert rows[0]['image'] == 'long-trail-news/images/1922_12_Dec_p2_0.png'
    assert 'Monroe Lodge under construction' in rows[0]['body']


def test_illustration_list_not_double_indexed_in_page_rows(tmp_path: Path):
    con = build_db(tmp_path)
    page_rows = [r for r in query(con, 'construction') if r['kind'] == 'page']
    assert page_rows == []


def test_document_with_a_missing_resource_is_skipped(tmp_path: Path):
    """A renamed/moved/deleted collections/ file must not produce a dead search result."""
    wiki = tmp_path / 'wiki' / 'long-trail-news'
    wiki.mkdir(parents=True)
    (wiki / '1922_12_Dec.md').write_text(DOC, encoding='utf-8')
    # note: no matching file under tmp_path/collections/ this time
    db_path = tmp_path / 'search.db'
    bwi.build(db_path, tmp_path / 'wiki')
    con = sqlite3.connect(db_path)
    assert query(con, 'Monroe Lodge') == []


def test_build_writes_an_index_report_with_skip_count(tmp_path: Path):
    wiki = tmp_path / 'wiki' / 'long-trail-news'
    wiki.mkdir(parents=True)
    (wiki / '1922_12_Dec.md').write_text(DOC, encoding='utf-8')
    # no matching collections/ file -> this doc gets skipped as stale
    db_path = tmp_path / 'search.db'
    bwi.build(db_path, tmp_path / 'wiki')
    report = json.loads((tmp_path / 'index-report.json').read_text())
    assert report['skipped'] == 1
    assert report['indexed'] == 0
    assert 'builtAt' in report


def test_index_report_counts_indexed_rows_when_resource_present(tmp_path: Path):
    con = build_db(tmp_path)  # creates the matching collections/ pdf fixture
    report = json.loads((tmp_path / 'index-report.json').read_text())
    assert report['skipped'] == 0
    assert report['indexed'] == con.execute('SELECT COUNT(*) FROM wiki_fts').fetchone()[0]


def test_document_without_page_markers_indexes_as_page_one(tmp_path: Path):
    wiki = tmp_path / 'wiki' / 'articles'
    wiki.mkdir(parents=True)
    (wiki / 'legacy.md').write_text(
        '---\ntype: "Article"\ntitle: "Legacy"\n---\n\nunmarked legacy body text\n',
        encoding='utf-8')
    db_path = tmp_path / 'search.db'
    bwi.build(db_path, tmp_path / 'wiki')
    con = sqlite3.connect(db_path)
    rows = query(con, 'legacy')
    assert rows[0]['page'] == 1
    assert rows[0]['kind'] == 'page'
