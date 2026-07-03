"""Integration tests for scripts/patch_citation_types.py — frontmatter-only
type/citation_type backfill, no re-OCR."""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts import patch_citation_types as pct

OLD_FORMAT_DOC = '''---
type: "Publication"
title: "Long Trail News"
description: "Long Trail News, April 1923."
resource: "collections/Long Trail News/1923_04_Apr.pdf"
timestamp: "2026-07-02T00:00:00Z"
publisher: "Green Mountain Club"
volume: "1923"
edition: "April"
pages: "4"
language: "en"
---

<!-- page: 1 -->
Body text that must not change.
'''


class TestPatchHeaderTypes:
    def test_inserts_citation_type_after_type_line_when_missing(self):
        result = pct.patch_header_types(OLD_FORMAT_DOC, 'Newsletter', 'magazine')
        lines = result.splitlines()
        type_idx = lines.index('type: "Newsletter"')
        assert lines[type_idx + 1] == 'citation_type: "magazine"'

    def test_body_and_other_frontmatter_fields_are_untouched(self):
        result = pct.patch_header_types(OLD_FORMAT_DOC, 'Newsletter', 'magazine')
        assert 'title: "Long Trail News"' in result
        assert 'resource: "collections/Long Trail News/1923_04_Apr.pdf"' in result
        assert result.endswith('Body text that must not change.\n')

    def test_rerun_updates_citation_type_in_place_instead_of_duplicating(self):
        once = pct.patch_header_types(OLD_FORMAT_DOC, 'Newsletter', 'magazine')
        twice = pct.patch_header_types(once, 'Book', 'book')
        assert twice.count('citation_type:') == 1
        assert 'citation_type: "book"' in twice
        assert 'type: "Book"' in twice


class TestRun:
    def make_repo(self, tmp_path: Path) -> Path:
        wiki = tmp_path / 'wiki' / 'Long Trail News'
        wiki.mkdir(parents=True)
        (wiki / '1923_04_Apr.md').write_text(OLD_FORMAT_DOC, encoding='utf-8')

        coll = tmp_path / 'collections' / 'Long Trail News'
        coll.mkdir(parents=True)
        pdf = coll / '1923_04_Apr.pdf'
        pdf.write_bytes(b'fake pdf bytes')

        cache_dir = tmp_path / 'collections' / '.conversion_cache'
        cache_dir.mkdir(parents=True)
        from scripts.lib.wiki_convert import PIPELINE_VERSION, _digest
        digest = _digest(pdf)
        (cache_dir / f'{digest}-v{PIPELINE_VERSION}-raw.md').write_text(OLD_FORMAT_DOC, encoding='utf-8')
        return tmp_path

    def test_patches_wiki_output_using_the_current_folder_type_mapping(self, tmp_path: Path):
        repo = self.make_repo(tmp_path)
        pct.run(repo)
        text = (repo / 'wiki' / 'Long Trail News' / '1923_04_Apr.md').read_text(encoding='utf-8')
        assert 'type: "Newsletter"' in text
        assert 'citation_type: "magazine"' in text

    def test_patches_the_matching_conversion_cache_entry_too(self, tmp_path: Path):
        repo = self.make_repo(tmp_path)
        pct.run(repo)
        cache_dir = repo / 'collections' / '.conversion_cache'
        cache_files = list(cache_dir.glob('*-raw.md'))
        assert len(cache_files) == 1
        assert 'citation_type: "magazine"' in cache_files[0].read_text(encoding='utf-8')

    def test_reports_how_many_files_were_patched(self, tmp_path: Path):
        repo = self.make_repo(tmp_path)
        result = pct.run(repo)
        assert result == {'patched_wiki': 1, 'patched_cache': 1}

    def test_is_idempotent_second_run_patches_nothing(self, tmp_path: Path):
        repo = self.make_repo(tmp_path)
        pct.run(repo)
        result = pct.run(repo)
        assert result == {'patched_wiki': 0, 'patched_cache': 0}
