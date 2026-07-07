#!/usr/bin/env python3
"""
One-time split of the combined Smoke & Blazes scans into per-issue PDFs.

Rerun-safe: re-splits from originals/ if the combined PDFs were already moved.
After this, smoke-and-blazes behaves like every other collection (one PDF per
issue) and the old markdown-splitting step is gone. Old wiki markdown for
smoke-and-blazes is removed because it references the archived combined PDFs;
re-add the collection from the app (or run ocr_to_markdown.py smoke-and-blazes).
"""
import shutil
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib import sb_pdf_split as sps

SB_DIR = REPO / 'collections' / 'smoke-and-blazes'
ORIGINALS = SB_DIR / 'originals'
# (filename, min_year, max_year) in priority order — later wins duplicates
SOURCES = [
    ('Smoke_and_Blazes_1948-2016.pdf', 1940, 2016),
    ('Smoke_and_Blazes_2013-2020.pdf', 2013, 2025),
]


def find_source(name: str) -> Path | None:
    for candidate in (ORIGINALS / name, SB_DIR / name):
        if candidate.exists():
            return candidate
    return None


def main() -> None:
    source_plans = []
    sources = []
    for name, lo, hi in SOURCES:
        src = find_source(name)
        if not src:
            print(f'not found: {name}')
            continue
        print(f'scanning {src.name} …')
        pages = sps.pdf_pages_text(src)
        plan = sps.plan_issues(pages, lo, hi)
        print(f'  {len(plan)} issues detected across {len(pages)} pages')
        source_plans.append((str(src), plan))
        sources.append(src)

    if not source_plans:
        print('nothing to split')
        return

    merged = sps.merge_plans(source_plans)
    # Clear previously split issue PDFs for idempotent reruns
    for old in SB_DIR.glob('Smoke_and_Blazes_*.pdf'):
        if old.name not in {n for n, _, _ in SOURCES}:
            old.unlink()

    for name, (src, start, end) in sorted(merged.items()):
        sps.cut_pdf(Path(src), start, end, SB_DIR / name)
    print(f'wrote {len(merged)} per-issue PDFs to {SB_DIR}')

    ORIGINALS.mkdir(exist_ok=True)
    for src in sources:
        if src.parent != ORIGINALS:
            shutil.move(str(src), ORIGINALS / src.name)
            print(f'archived {src.name} → originals/')

    # Old wiki markdown points at the archived combined PDFs — remove it
    wiki_sb = REPO / 'wiki' / 'smoke-and-blazes'
    stale = list(wiki_sb.glob('Smoke_and_Blazes_*.md')) if wiki_sb.exists() else []
    for md in stale:
        md.unlink()
    if stale:
        print(f'removed {len(stale)} stale wiki files — re-add smoke-and-blazes '
              f'from the app or run: python3 scripts/ocr_to_markdown.py smoke-and-blazes')


if __name__ == '__main__':
    main()
