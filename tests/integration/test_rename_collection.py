"""Integration tests for scripts/rename_collection.py — atomic collection rename."""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import rename_collection as rc

DOC = '''---
type: "Newsletter"
title: "Long Trail News"
resource: "collections/long-trail-news/1922_12_Dec.pdf"
---

<!-- page: 1 -->
The first Patrol Day was held in May.
'''


def make_repo(tmp_path: Path) -> Path:
    (tmp_path / 'collections' / 'long-trail-news').mkdir(parents=True)
    (tmp_path / 'collections' / 'long-trail-news' / '1922_12_Dec.pdf').write_bytes(b'fake pdf')
    (tmp_path / 'wiki' / 'long-trail-news').mkdir(parents=True)
    (tmp_path / 'wiki' / 'long-trail-news' / '1922_12_Dec.md').write_text(DOC, encoding='utf-8')
    return tmp_path


def test_renames_collections_and_wiki_folders_together(tmp_path: Path):
    repo = make_repo(tmp_path)
    rc.rename_collection(repo, 'long-trail-news', 'Long Trail News')
    assert (repo / 'collections' / 'Long Trail News' / '1922_12_Dec.pdf').exists()
    assert not (repo / 'collections' / 'long-trail-news').exists()
    assert (repo / 'wiki' / 'Long Trail News' / '1922_12_Dec.md').exists()
    assert not (repo / 'wiki' / 'long-trail-news').exists()


def test_rewrites_resource_frontmatter_to_the_new_path(tmp_path: Path):
    repo = make_repo(tmp_path)
    rc.rename_collection(repo, 'long-trail-news', 'Long Trail News')
    text = (repo / 'wiki' / 'Long Trail News' / '1922_12_Dec.md').read_text(encoding='utf-8')
    assert 'resource: "collections/Long Trail News/1922_12_Dec.pdf"' in text
    assert 'long-trail-news' not in text


def test_skips_wiki_migration_when_collection_not_yet_converted(tmp_path: Path):
    repo = tmp_path
    (repo / 'collections' / 'ridgelines').mkdir(parents=True)
    (repo / 'collections' / 'ridgelines' / 'issue1.pdf').write_bytes(b'fake pdf')
    result = rc.rename_collection(repo, 'ridgelines', 'Ridgelines (Burlington)')
    assert (repo / 'collections' / 'Ridgelines (Burlington)').exists()
    assert result['wiki_migrated'] is False


def test_raises_when_source_collection_missing(tmp_path: Path):
    try:
        rc.rename_collection(tmp_path, 'nope', 'Nope New')
        assert False, 'expected FileNotFoundError'
    except FileNotFoundError:
        pass


def test_raises_when_destination_already_exists(tmp_path: Path):
    repo = make_repo(tmp_path)
    (repo / 'collections' / 'Long Trail News').mkdir(parents=True)
    try:
        rc.rename_collection(repo, 'long-trail-news', 'Long Trail News')
        assert False, 'expected FileExistsError'
    except FileExistsError:
        pass
