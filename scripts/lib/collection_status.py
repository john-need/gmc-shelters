"""Per-PDF add/clean status for the Collections Management screen.

Status is derived from the conversion cache (the single source of truth the
pipeline itself uses): a PDF whose sha256 has a `-clean` cache entry was
LLM-cleaned, `-raw` means added without cleanup, no entry means not added
(including when the PDF changed since conversion).

PDF hashes are memoized in .conversion_cache/hashes.json keyed by
path+size+mtime so repeat scans don't re-read gigabytes.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from scripts.lib.wiki_convert import PIPELINE_VERSION

MEMO_NAME = 'hashes.json'
EXCLUDED_DIRS = {'originals', '__pycache__'}


def _load_memo(cache_dir: Path) -> dict:
    try:
        return json.loads((cache_dir / MEMO_NAME).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def _sha256(pdf: Path, memo: dict) -> str:
    stat = pdf.stat()
    key = str(pdf)
    entry = memo.get(key)
    if entry and entry['size'] == stat.st_size and entry['mtime'] == stat.st_mtime:
        return entry['sha256']
    digest = hashlib.sha256(pdf.read_bytes()).hexdigest()
    memo[key] = {'size': stat.st_size, 'mtime': stat.st_mtime, 'sha256': digest}
    return digest


def scan(repo_root: Path) -> list[dict]:
    """[{name, total, added, cleaned, files: [{name, status}]}] per collection."""
    collections_dir = repo_root / 'collections'
    cache_dir = collections_dir / '.conversion_cache'
    memo = _load_memo(cache_dir)

    cached_variants: dict[str, set[str]] = {}
    for f in cache_dir.glob(f'*-v{PIPELINE_VERSION}-*.md'):
        digest, _, variant = f.stem.rpartition('-')
        digest = digest[: digest.rfind('-v')]
        cached_variants.setdefault(digest, set()).add(variant)

    result = []
    for folder in sorted(p for p in collections_dir.iterdir() if p.is_dir()):
        if folder.name.startswith('.') or folder.name in EXCLUDED_DIRS:
            continue
        pdfs = sorted(p for p in folder.glob('*.pdf'))
        if not pdfs:
            continue
        files = []
        for pdf in pdfs:
            variants = cached_variants.get(_sha256(pdf, memo), set())
            if 'clean' in variants:
                status = 'clean'
            elif 'raw' in variants:
                status = 'raw'
            else:
                status = 'missing'
            files.append({'name': pdf.name, 'status': status})
        result.append({
            'name': folder.name,
            'total': len(files),
            'added': sum(f['status'] != 'missing' for f in files),
            'cleaned': sum(f['status'] == 'clean' for f in files),
            'files': files,
        })

    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / MEMO_NAME).write_text(json.dumps(memo), encoding='utf-8')
    return result
