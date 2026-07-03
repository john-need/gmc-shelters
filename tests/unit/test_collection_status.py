"""Unit tests for scripts/lib/collection_status.py — add/clean status per PDF."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from scripts.lib import collection_status as cs
from scripts.lib.wiki_convert import PIPELINE_VERSION


def setup_repo(tmp_path: Path) -> Path:
    coll = tmp_path / 'collections' / 'long-trail-news'
    coll.mkdir(parents=True)
    (coll / 'metadata.yaml').write_text('organization: "Green Mountain Club"\n')
    (tmp_path / 'collections' / '.conversion_cache').mkdir()
    return tmp_path


def add_pdf(repo: Path, name: str, content: bytes, variant: str | None) -> Path:
    pdf = repo / 'collections' / 'long-trail-news' / name
    pdf.write_bytes(content)
    if variant:
        digest = hashlib.sha256(content).hexdigest()
        cache = repo / 'collections' / '.conversion_cache' / f'{digest}-v{PIPELINE_VERSION}-{variant}.md'
        cache.write_text('cached')
    return pdf


def test_statuses_derive_from_cache_variants(tmp_path: Path):
    repo = setup_repo(tmp_path)
    add_pdf(repo, 'a_clean.pdf', b'%PDF-a', 'clean')
    add_pdf(repo, 'b_raw.pdf', b'%PDF-b', 'raw')
    add_pdf(repo, 'c_new.pdf', b'%PDF-c', None)

    result = cs.scan(repo)
    ltn = next(c for c in result if c['name'] == 'long-trail-news')
    by_name = {f['name']: f['status'] for f in ltn['files']}
    assert by_name == {'a_clean.pdf': 'clean', 'b_raw.pdf': 'raw', 'c_new.pdf': 'missing'}


def test_changed_pdf_reverts_to_missing(tmp_path: Path):
    repo = setup_repo(tmp_path)
    pdf = add_pdf(repo, 'a.pdf', b'%PDF-a', 'clean')
    pdf.write_bytes(b'%PDF-a-changed')
    result = cs.scan(repo)
    assert result[0]['files'][0]['status'] == 'missing'


def test_collection_summary_counts(tmp_path: Path):
    repo = setup_repo(tmp_path)
    add_pdf(repo, 'a.pdf', b'%PDF-a', 'clean')
    add_pdf(repo, 'b.pdf', b'%PDF-b', 'raw')
    add_pdf(repo, 'c.pdf', b'%PDF-c', None)
    ltn = cs.scan(repo)[0]
    assert ltn['total'] == 3
    assert ltn['added'] == 2      # raw + clean both live in the wiki
    assert ltn['cleaned'] == 1


def test_hash_memo_reused_when_mtime_and_size_unchanged(tmp_path: Path):
    repo = setup_repo(tmp_path)
    add_pdf(repo, 'a.pdf', b'%PDF-a', 'clean')
    cs.scan(repo)
    memo_path = repo / 'collections' / '.conversion_cache' / 'hashes.json'
    memo = json.loads(memo_path.read_text())
    assert len(memo) == 1
    # poison the memo: if scan re-hashed, status would change; it must trust the memo
    key, entry = next(iter(memo.items()))
    entry['sha256'] = 'not-a-real-hash'
    memo_path.write_text(json.dumps(memo))
    result = cs.scan(repo)
    assert result[0]['files'][0]['status'] == 'missing'  # memo trusted → wrong hash → no cache match


def test_hidden_dirs_and_originals_excluded(tmp_path: Path):
    repo = setup_repo(tmp_path)
    add_pdf(repo, 'a.pdf', b'%PDF-a', None)
    originals = repo / 'collections' / 'smoke-and-blazes' / 'originals'
    originals.mkdir(parents=True)
    (originals / 'combined.pdf').write_bytes(b'%PDF-combined')
    result = cs.scan(repo)
    names = {c['name'] for c in result}
    assert 'long-trail-news' in names
    all_files = [f['name'] for c in result for f in c['files']]
    assert 'combined.pdf' not in all_files
