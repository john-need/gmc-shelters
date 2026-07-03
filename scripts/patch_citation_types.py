#!/usr/bin/env python3
"""
Backfill the type: / citation_type: frontmatter lines on already-converted
wiki/ markdown (and their .conversion_cache counterparts) to match the
current FOLDER_TYPES / OKF_TYPE_TO_CITATION mapping in wiki_convert.py.

Needed once whenever FOLDER_TYPES gains new entries or changes values (e.g.
after a collections/ rename) — otherwise already-converted docs stay
mis-typed until they're naturally reconverted. Frontmatter-only rewrite: no
re-OCR, no LLM calls, body text untouched. Idempotent — safe to rerun.

Usage: python3 scripts/patch_citation_types.py
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib.wiki_convert import FOLDER_TYPES, OKF_TYPE_TO_CITATION, PIPELINE_VERSION, _digest

SKIP_NAMES = {'index.md', 'log.md'}
_TYPE_RE = re.compile(r'^type: ".*"$', re.MULTILINE)
_CITATION_RE = re.compile(r'^citation_type: ".*"$', re.MULTILINE)


def patch_header_types(text: str, okf_type: str, citation_type: str) -> str:
    """Rewrite the type:/citation_type: frontmatter lines only; body untouched."""
    text = _TYPE_RE.sub(f'type: "{okf_type}"', text, count=1)
    if _CITATION_RE.search(text):
        return _CITATION_RE.sub(f'citation_type: "{citation_type}"', text, count=1)
    return _TYPE_RE.sub(
        lambda m: f'{m.group(0)}\ncitation_type: "{citation_type}"',
        text, count=1,
    )


def run(repo_root: Path) -> dict:
    wiki_root = repo_root / 'wiki'
    cache_dir = repo_root / 'collections' / '.conversion_cache'
    patched_wiki = 0
    patched_cache = 0

    for md in sorted(wiki_root.rglob('*.md')):
        if md.name in SKIP_NAMES:
            continue
        collection = md.relative_to(wiki_root).parts[0]
        okf_type = FOLDER_TYPES.get(collection, 'Publication')
        citation_type = OKF_TYPE_TO_CITATION.get(okf_type, 'other')

        text = md.read_text(encoding='utf-8')
        new_text = patch_header_types(text, okf_type, citation_type)
        if new_text != text:
            md.write_text(new_text, encoding='utf-8')
            patched_wiki += 1

        pdf = repo_root / 'collections' / collection / f'{md.stem}.pdf'
        if not pdf.exists():
            continue
        digest = _digest(pdf)
        for variant in ('raw', 'clean'):
            cache_file = cache_dir / f'{digest}-v{PIPELINE_VERSION}-{variant}.md'
            if not cache_file.exists():
                continue
            ctext = cache_file.read_text(encoding='utf-8')
            cnew = patch_header_types(ctext, okf_type, citation_type)
            if cnew != ctext:
                cache_file.write_text(cnew, encoding='utf-8')
                patched_cache += 1

    return {'patched_wiki': patched_wiki, 'patched_cache': patched_cache}


def main() -> None:
    result = run(REPO)
    print(f'Patched {result["patched_wiki"]} wiki/ file(s), '
          f'{result["patched_cache"]} cache entry(ies).')
    print('Run scripts/build_wiki_index.py to refresh the search index.')


if __name__ == '__main__':
    main()
