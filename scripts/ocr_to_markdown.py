#!/usr/bin/env python3
"""
Convert collection PDFs to OKF-profile markdown in wiki/.

Pipeline per PDF (logic lives in scripts/lib/wiki_convert.py):
  1. Extract text with pdftotext -layout (ocrmypdf fallback for image-only scans)
  2. Split into pages on form-feeds; every page gets a <!-- page: N --> marker
  3. LLM cleanup pass (Claude) fixes reading order and OCR errors — never
     paraphrases, marks unreadable text [illegible]
  4. Extract illustrations (pdfimages) and caption them with a vision pass
  5. Write OKF profile header (publisher from metadata.yaml, volume/edition,
     printed_volume/printed_issue, author for books; no tags, no date)

Rerun-safe: output is cached by source-PDF sha256 in collections/.conversion_cache/;
unchanged PDFs are rewritten from cache with zero API calls. Each run prints an
audit summary (converted / cached / failed / flagged-for-escalation).

Usage:
  ANTHROPIC_API_KEY=... python3 scripts/ocr_to_markdown.py [--no-clean] [--no-images]

Requires:
  brew install ocrmypdf poppler
"""
from __future__ import annotations

import argparse
import base64
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib import wiki_convert as wc
from scripts.lib.llm_client import AnthropicClient, load_api_key

COLLECTIONS = REPO / 'collections'
WIKI = REPO / 'wiki'
CACHE_DIR = COLLECTIONS / '.conversion_cache'

CAPTION_PROMPT = (
    'This image was extracted from a scanned historical hiking-club publication. '
    'If it is a photograph or illustration with a visible caption, return the '
    'caption text exactly. If it has no caption, return a short factual '
    'description (under 15 words). If it is not a real illustration (page '
    'decoration, scan noise, letterhead), return exactly: SKIP'
)

# ponytail: images under this size are halftone fragments/decorations, not photos
MIN_IMAGE_BYTES = 20_000


def pdf_to_text(pdf: Path) -> str:
    r = subprocess.run(['pdftotext', '-layout', str(pdf), '-'], capture_output=True, text=True)
    if r.returncode == 0 and len(r.stdout.strip()) > 200:
        return r.stdout

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        result = subprocess.run(
            ['ocrmypdf', '--skip-text', '--rotate-pages', '--deskew', '--quiet',
             str(pdf), str(tmp_path)],
            capture_output=True,
        )
        if result.returncode != 0:
            print(f'    ocrmypdf error: {result.stderr.decode().strip()[:200]}')
            return ''
        r = subprocess.run(['pdftotext', '-layout', str(tmp_path), '-'], capture_output=True, text=True)
        return r.stdout if r.returncode == 0 else ''
    finally:
        tmp_path.unlink(missing_ok=True)


def run_pdfimages(pdf: Path, prefix: Path) -> None:
    subprocess.run(['pdfimages', '-png', '-p', str(pdf), str(prefix)], capture_output=True)
    # Drop fragments too small to be real illustrations
    for png in prefix.parent.glob(f'{prefix.name}-*.png'):
        if png.stat().st_size < MIN_IMAGE_BYTES:
            png.unlink()


def make_captioner(client: AnthropicClient | None):
    def captioner(png: Path) -> str:
        if client is None:
            return ''
        data = wc.encode_image_b64(png)
        caption = client.caption_image(data, CAPTION_PROMPT).strip()
        if caption == 'SKIP':
            png.unlink(missing_ok=True)
            return 'SKIP'
        return caption
    return captioner


def make_illustration_extractor(client: AnthropicClient | None, wiki_root: Path):
    captioner = make_captioner(client)

    def extract(pdf: Path):
        images_dir = wiki_root / pdf.parent.name / 'images'
        ills = wc.harvest_illustrations(
            pdf, images_dir, run_pdfimages=run_pdfimages, captioner=captioner)
        return [il for il in ills if il['caption'] != 'SKIP']

    return extract


def read_frontmatter(md: Path) -> dict[str, str]:
    try:
        text = md.read_text(encoding='utf-8')
    except OSError:
        return {}
    if not text.startswith('---'):
        return {}
    end = text.find('\n---', 3)
    if end == -1:
        return {}
    result = {}
    for line in text[3:end].splitlines():
        m = re.match(r'^(\w+):\s+"?(.+?)"?\s*$', line)
        if m:
            result[m.group(1)] = m.group(2)
    return result


def write_folder_index(folder: Path) -> None:
    """OKF §6 index.md — bullet list of concepts in this folder."""
    mds = sorted(p for p in folder.glob('*.md') if p.name not in ('index.md', 'log.md'))
    lines = [f'# {wc.to_title(folder.name)}', '']
    for md in mds:
        fm = read_frontmatter(md)
        label = fm.get('title', md.stem)
        desc = fm.get('description', '').rstrip('.')
        lines.append(f'* [{label}]({md.name}) - {desc}')
    (folder / 'index.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def write_root_index() -> None:
    """OKF §6 + §11 root index.md with okf_version frontmatter."""
    skip = {'__pycache__', '.git'}
    dirs = sorted(d for d in WIKI.iterdir() if d.is_dir() and d.name not in skip and not d.name.startswith('.'))
    lines = ['---', 'okf_version: "0.1"', '---', '', '# GMC Collections', '']
    for d in dirs:
        has_index = (d / 'index.md').exists()
        target = f'{d.name}/index.md' if has_index else f'{d.name}/'
        count = len([p for p in d.glob('*.md') if p.name not in ('index.md', 'log.md')])
        lines.append(f'* [{wc.to_title(d.name)}]({target}) - {count} document{"s" if count != 1 else ""}')
    WIKI.mkdir(exist_ok=True)
    (WIKI / 'index.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def append_log(log_path: Path, entries: list[str], heading: str) -> None:
    """OKF §7 log.md — prepend today's entries, newest section first."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    existing = log_path.read_text(encoding='utf-8') if log_path.exists() else ''
    body = re.sub(rf'^# {re.escape(heading)}\n+', '', existing)
    new_section = f'## {today}\n' + '\n'.join(f'* {e}' for e in entries)
    log_path.write_text(f'# {heading}\n\n{new_section}\n\n{body}'.rstrip() + '\n', encoding='utf-8')


def check_deps() -> None:
    missing = [t for t in ('ocrmypdf', 'pdftotext', 'pdfimages')
               if subprocess.run(['which', t], capture_output=True).returncode != 0]
    if missing:
        print(f'Missing tools: {", ".join(missing)}')
        print('Install with:  brew install ocrmypdf poppler')
        sys.exit(1)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--no-clean', action='store_true',
                    help='skip the LLM cleanup pass (offline dry run; text keeps OCR artifacts)')
    ap.add_argument('--no-images', action='store_true',
                    help='skip illustration extraction and captioning')
    ap.add_argument('--files', nargs='*', default=[],
                    help='only process these PDFs (repo-relative paths, e.g. '
                         'collections/long-trail-news/1922_12_Dec.pdf)')
    ap.add_argument('--force', action='store_true',
                    help='purge cached conversions for the targeted PDFs first')
    ap.add_argument('collections', nargs='*',
                    help='only process these collection folders (default: all)')
    args = ap.parse_args()

    check_deps()

    client: AnthropicClient | None = None
    if args.no_clean:
        llm = lambda prompt: prompt.rsplit('OCR text:\n', 1)[-1]  # noqa: E731 identity pass
    else:
        client = AnthropicClient(api_key=load_api_key(REPO))
        llm = client.complete

    extract_ills = None if args.no_images else make_illustration_extractor(client, WIKI)

    wanted_files = {str((REPO / f).resolve()) for f in args.files}
    folders: dict[Path, list[Path]] = {}
    for pdf in sorted(COLLECTIONS.rglob('*.pdf')):
        if pdf.parent.name == 'originals':  # archived combined scans, not sources
            continue
        if args.collections and pdf.parent.name not in args.collections:
            continue
        if wanted_files and str(pdf.resolve()) not in wanted_files:
            continue
        folders.setdefault(pdf.parent, []).append(pdf)
    print(f'Found {sum(len(v) for v in folders.values())} PDFs in {len(folders)} folders\n')

    totals = {'converted': 0, 'cached': 0, 'failed': 0}
    flagged: list[str] = []
    root_log_entries: list[str] = []

    for folder, pdfs in sorted(folders.items()):
        print(f'\n{folder.name}/')
        coll_meta = wc.load_collection_meta(folder)
        folder_log_entries: list[str] = []

        for pdf in pdfs:
            print(f'  proc  {pdf.name}', flush=True)
            if args.force:
                wc.purge_cache(CACHE_DIR, pdf)
            audit = wc.convert_document(
                pdf=pdf, repo_root=REPO, wiki_root=WIKI, cache_dir=CACHE_DIR,
                coll_meta=coll_meta, extract_text=pdf_to_text, llm=llm,
                extract_illustrations=extract_ills,
                cache_variant='raw' if args.no_clean else 'clean',
            )
            totals[audit['status']] += 1
            if audit['flagged']:
                flagged.append(pdf.name)
            mark = {'converted': 'ok   ', 'cached': 'cache', 'failed': 'FAIL '}[audit['status']]
            print(f'  {mark} {pdf.name}' + (f'  ({audit["error"]})' if audit['error'] else ''))
            if audit['status'] == 'converted':
                folder_log_entries.append(f'**Update**: Processed [{pdf.stem}]({pdf.stem}.md)')

        if folder_log_entries:
            wiki_folder = WIKI / folder.name
            write_folder_index(wiki_folder)
            append_log(wiki_folder / 'log.md', folder_log_entries, 'Directory Update Log')
            root_log_entries.append(
                f'**Update**: Re-indexed [{wc.to_title(folder.name)}]({folder.name}/index.md)'
                f' — {len(folder_log_entries)} document(s)')

    if root_log_entries:
        write_root_index()
        append_log(WIKI / 'log.md', root_log_entries, 'Collections Update Log')

    print(f"\nAudit: {totals['converted']} converted, {totals['cached']} cached, "
          f"{totals['failed']} failed.")
    if flagged:
        print(f'Flagged for escalation (garbled after cleanup): {len(flagged)}')
        for name in flagged:
            print(f'  - {name}')
    print('Next: python3 scripts/build_wiki_index.py')


if __name__ == '__main__':
    main()
