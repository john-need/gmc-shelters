"""PDF-collection → OKF-profile markdown conversion logic.

Pure, testable core used by scripts/ocr_to_markdown.py. Subprocess and
LLM interactions are injected by the CLI so everything here runs in tests.

OKF profile (project-defined; OKF itself only mandates `type`):
  type, title, description, resource, timestamp, language,
  publisher (per-collection org), volume (year), edition (month/season),
  printed_volume / printed_issue (optional, as printed on the issue),
  author (books, from metadata.yaml), pages (PDF page count).
No `tags`. No `date`.
"""
from __future__ import annotations

import base64
import hashlib
import io
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from PIL import Image

# Bump when the cleanup prompt or output format changes, to invalidate caches
PIPELINE_VERSION = '1'

CLEANUP_PROMPT = """You are restoring OCR text from a scanned historical publication.
Rules — follow them exactly:
- Reconstruct the correct reading order (multi-column layouts are often \
interleaved line by line; untangle them).
- Fix obvious OCR character errors and rejoin words hyphenated across lines.
- NEVER paraphrase, summarize, or add text. Preserve the original wording.
- Preserve proper nouns exactly unless the correction is unambiguous from \
the surrounding context.
- Mark text you cannot confidently read as [illegible] instead of guessing.
Return only the restored text, no commentary.

OCR text:
{page}"""

# OKF `type` per collection folder — producer-defined values per OKF §4.1.
# Keyed by the current collections/<name>/ folder name (post 2026-07-02 rename
# to human-readable names — see scripts/rename_collection.py).
FOLDER_TYPES: dict[str, str] = {
    'GMC Annual Reports':                                'Annual Report',
    'Rutland Historcal Society Quarterly':               'Periodical',
    'Articles':                                          'Article',
    'Stepping Stone (Bennington)':                        'Newsletter',
    'Books':                                              'Book',
    'books':                                              'Book',  # wiki/ output predates the Books rename
    'The Trail Talk (Connecticut)':                       'Newsletter',
    'Long Trail Guide Books':                             'Guidebook',
    'Long Trail News':                                    'Newsletter',
    'maps':                                               'Map',
    'Trail Talk (Montpelier)':                            'Newsletter',
    'Ramblings (Northeast Kingdom)':                       'Newsletter',
    'Northern Frontier Newsletter (Northern Frontier)':   'Newsletter',
    'Ridgelines (Burlington)':                            'Newsletter',
    'Smoke and Blazes (Killington)':                       'Newsletter',
    'Sterling Stomper (Sterlington)':                      'Newsletter',
    'The Crumb':                                          'Newsletter',
    'Footnotes (Upper Valley Ottauquechee)':              'Newsletter',
    'Worcester Newsletter (Worcester)':                    'Newsletter',
}

# Mirrors src/shared/wiki-cite.ts OKF_TO_SOURCE — one citation type per OKF
# type, so every document in a collection gets the same citation type (it's a
# collection-wide rule, not a per-document one). Keep the two in sync.
OKF_TYPE_TO_CITATION: dict[str, str] = {
    'Newsletter':    'magazine',
    'Book':          'book',
    'Guidebook':     'book',
    'Annual Report': 'report',
    'Map':           'map',
    'Article':       'magazine',
    'Periodical':    'magazine',
}

SEASONS = {'spring', 'summer', 'fall', 'winter', 'autumn'}
MONTH_NAMES = {
    'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
    'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
    'sep': 'September', 'oct': 'October', 'nov': 'November', 'dec': 'December',
}


def to_title(name: str) -> str:
    if ' ' in name:
        return name
    return name.replace('-', ' ').replace('_', ' ').title()


def parse_stem_meta(stem: str) -> dict[str, str]:
    """Derive year/edition and printed volume/issue from a PDF filename stem."""
    meta = {'year': '', 'edition': '', 'printed_volume': '', 'printed_issue': ''}

    # "Vol.19No.21989" → printed vol 19, printed issue 2, year 1989
    m = re.search(r'[Vv]ol\.?(\d+)[Nn]o\.?(\d+?)(\d{4})?(?:\D|$)', stem)
    if m:
        meta['printed_volume'], meta['printed_issue'] = m.group(1), m.group(2)
        if m.group(3):
            meta['year'] = m.group(3)

    # "SpringSummer" / "FallWinter" → split so both season tokens survive
    stem = re.sub(r'(Spring)(Summer)|(Fall)(Winter)', r'\1\3/\2\4', stem, flags=re.IGNORECASE)

    seasons: list[str] = []
    month = ''
    for p in re.split(r'[-_\s\./]+', stem):
        pl = p.lower()
        if re.match(r'^\d{4}$', p) and not meta['year']:
            meta['year'] = p
        elif (pl in MONTH_NAMES or pl[:3] in MONTH_NAMES and pl in {
                'january', 'february', 'march', 'april', 'june', 'july',
                'august', 'september', 'october', 'november', 'december'}) and not month:
            month = MONTH_NAMES[pl[:3]]
        elif pl in SEASONS:
            seasons.append(p.title())
        elif re.match(r'^vol(\d+)$', pl) and not meta['printed_volume']:
            meta['printed_volume'] = pl[3:]
        elif re.match(r'^no(\d+)$', pl) and not meta['printed_issue']:
            meta['printed_issue'] = pl[2:]
        elif re.match(r'^v(\d+)$', pl) and not meta['printed_volume']:
            meta['printed_volume'] = pl[1:]

    meta['edition'] = month or '/'.join(seasons)
    return meta


PAGE_MARKER = '<!-- page: {n} -->'
ILLEGIBLE = '[illegible]'


def split_pages(raw: str) -> list[str]:
    """pdftotext separates pages with form-feeds; a trailing \\f is not a page."""
    pages = raw.split('\f')
    if pages and not pages[-1].strip():
        pages.pop()
    return pages


def render_pages(pages: list[str]) -> str:
    """Body markdown: every PDF page gets a marker; blank pages stay aligned."""
    out = []
    for n, page in enumerate(pages, start=1):
        text = page.strip() or ILLEGIBLE
        out.append(f'{PAGE_MARKER.format(n=n)}\n{text}')
    return '\n\n'.join(out)


def clean_pages(pages: list[str], llm: Callable[[str], str]) -> list[str]:
    """One LLM call per page under the fidelity contract; blank pages skipped."""
    cleaned = []
    for page in pages:
        if not page.strip():
            cleaned.append(page)
            continue
        cleaned.append(llm(CLEANUP_PROMPT.format(page=page)))
    return cleaned


QUOTE_CLEANUP_PROMPT = """You are restoring OCR text from a short quoted excerpt.
Rules — follow them exactly:
- Fix obvious OCR character errors and rejoin words hyphenated across lines.
- NEVER paraphrase, summarize, or add text. Preserve the original wording.
- Preserve proper nouns exactly unless the correction is unambiguous from \
the surrounding context.
- Mark text you cannot confidently read as [illegible] instead of guessing.
Return only the restored text, no commentary.

Quote:
{quote}"""


def clean_quote(text: str, llm: Callable[[str], str]) -> str:
    """One LLM call to clean up a single citation-source quote."""
    return llm(QUOTE_CLEANUP_PROMPT.format(quote=text))


def garbled_ratio(text: str) -> float:
    """Fraction of tokens that look like OCR noise — flags docs for escalation."""
    tokens = re.findall(r'\S+', text)
    if not tokens:
        return 0.0
    vowels = set('aeiouyAEIOUY')

    def is_garbled(t: str) -> bool:
        alpha = sum(c.isalpha() for c in t)
        other = sum(not c.isalnum() for c in t.strip('.,;:!?()"\''))
        if alpha >= 3 and not (set(t) & vowels):
            return True
        return other > alpha

    return sum(is_garbled(t) for t in tokens) / len(tokens)


def _digest(pdf: Path) -> str:
    return hashlib.sha256(pdf.read_bytes()).hexdigest()


def _cache_file(cache_dir: Path, pdf: Path, variant: str) -> Path:
    return cache_dir / f'{_digest(pdf)}-v{PIPELINE_VERSION}-{variant}.md'


def purge_cache(cache_dir: Path, pdf: Path) -> None:
    """Drop every cached variant for this PDF so the next run reconverts it."""
    for f in cache_dir.glob(f'{_digest(pdf)}-v{PIPELINE_VERSION}-*.md'):
        f.unlink()


def convert_document(*, pdf: Path, repo_root: Path, wiki_root: Path, cache_dir: Path,
                     coll_meta: dict, extract_text: Callable[[Path], str],
                     llm: Callable[[str], str],
                     extract_illustrations: Callable | None = None,
                     timestamp: str | None = None,
                     cache_variant: str = 'clean') -> dict:
    """Convert one PDF to OKF markdown. Rerun-safe: keyed by source PDF hash.

    Returns an audit record: {'pdf', 'status': converted|cached|failed, 'flagged', 'error'}.
    """
    collection = pdf.parent.name
    out_md = wiki_root / collection / (pdf.stem + '.md')
    audit = {'pdf': str(pdf), 'status': '', 'flagged': False, 'error': ''}

    cache = _cache_file(cache_dir, pdf, cache_variant)
    if cache_variant == 'raw':
        # clean output always supersedes raw — never downgrade a cleaned doc
        clean = _cache_file(cache_dir, pdf, 'clean')
        if clean.exists():
            cache = clean
    if cache.exists():
        out_md.parent.mkdir(parents=True, exist_ok=True)
        out_md.write_text(cache.read_text(encoding='utf-8'), encoding='utf-8')
        audit['status'] = 'cached'
        return audit

    try:
        raw = extract_text(pdf)
        if not raw.strip():
            raise ValueError('no text extracted')
        pages = split_pages(raw)
        cleaned = clean_pages(pages, llm)
        illustrations = extract_illustrations(pdf) if extract_illustrations else []
        header = okf_header(
            collection=collection,
            stem=pdf.stem,
            pdf_relpath=pdf.relative_to(repo_root).as_posix(),
            page_count=len(pages),
            coll_meta=coll_meta,
            timestamp=timestamp,
        )
        body = render_pages(cleaned)
        content = f'{header}\n\n{body}\n'
        if illustrations:
            content += '\n' + render_illustrations(illustrations) + '\n'
    except Exception as e:  # failed docs must retry next run: write nothing
        audit['status'] = 'failed'
        audit['error'] = str(e)
        return audit

    out_md.parent.mkdir(parents=True, exist_ok=True)
    out_md.write_text(content, encoding='utf-8')
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(content, encoding='utf-8')
    audit['status'] = 'converted'
    audit['flagged'] = garbled_ratio(body) > 0.15
    return audit


# Anthropic rejects base64 image payloads over 10_485_760 bytes; full-page
# scans from pdfimages routinely blow past that, so shrink until it fits.
MAX_IMAGE_B64_BYTES = 10_000_000


def encode_image_b64(png: Path) -> str:
    """Base64-encode an image, downscaling it if it exceeds the API's size cap."""
    b64 = base64.standard_b64encode(png.read_bytes()).decode('ascii')
    if len(b64) <= MAX_IMAGE_B64_BYTES:
        return b64
    img = Image.open(png)
    while len(b64) > MAX_IMAGE_B64_BYTES and max(img.size) > 200:
        img = img.resize((img.width * 3 // 4, img.height * 3 // 4))
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        b64 = base64.standard_b64encode(buf.getvalue()).decode('ascii')
    return b64


def harvest_illustrations(pdf: Path, images_dir: Path, *,
                          run_pdfimages: Callable[[Path, Path], None],
                          captioner: Callable[[Path], str]) -> list[dict]:
    """Extract images from a PDF into images_dir and caption each one.

    run_pdfimages must produce files named {prefix}-{page:03d}-{num:03d}.png
    (pdfimages -png -p). Returns [{'page', 'image', 'caption'}] sorted by page,
    with 'image' relative to the markdown file's folder (images/<name>).
    """
    images_dir.mkdir(parents=True, exist_ok=True)
    prefix = images_dir / pdf.stem
    run_pdfimages(pdf, prefix)

    illustrations = []
    for png in sorted(images_dir.glob(f'{pdf.stem}-*.png')):
        m = re.match(rf'{re.escape(pdf.stem)}-(\d+)-(\d+)$', png.stem)
        if not m:
            continue
        page, num = int(m.group(1)), int(m.group(2))
        final = images_dir / f'{pdf.stem}_p{page}_{num}.png'
        png.rename(final)
        illustrations.append({
            'page': page,
            'image': f'images/{final.name}',
            'caption': captioner(final),
        })
    return illustrations


def render_illustrations(illustrations: list[dict]) -> str:
    lines = ['## List of Illustrations', '']
    for il in illustrations:
        caption = il.get('caption') or f"Untitled illustration, p. {il['page']}"
        image = il.get('image', '')
        entry = f'* {caption} (p. {il["page"]})'
        if image:
            entry += f' — ![{caption}]({image})'
        lines.append(entry)
    return '\n'.join(lines)


def load_collection_meta(collection_dir: Path) -> dict:
    """Parse collections/<name>/metadata.yaml.

    ponytail: tiny two-level YAML-subset parser (we own every file it reads);
    swap in PyYAML if these files ever grow beyond key/value + one nesting.
    Layout:
        organization: "..."
        type: "..."            (optional override)
        files:
          <filename.pdf>:
            author: "..."
            title: "..."
    """
    meta: dict = {'organization': '', 'files': {}}
    path = collection_dir / 'metadata.yaml'
    if not path.exists():
        return meta

    current_file: str | None = None
    in_files = False
    for raw in path.read_text(encoding='utf-8').splitlines():
        if not raw.strip() or raw.lstrip().startswith('#'):
            continue
        indent = len(raw) - len(raw.lstrip())
        key, _, value = raw.strip().partition(':')
        value = value.strip().strip('"').strip("'")

        if indent == 0:
            in_files = key == 'files'
            current_file = None
            if not in_files:
                meta[key] = value
        elif in_files and indent == 2:
            current_file = key
            meta['files'][current_file] = {}
        elif in_files and indent >= 4 and current_file and value:
            meta['files'][current_file][key] = value
    return meta


def _meta_key_re(key: str) -> re.Pattern[str]:
    return re.compile(rf'^{re.escape(key)}: ".*"$', re.MULTILINE)


def set_collection_defaults(collection_dir: Path, fields: dict[str, str]) -> None:
    """Set one or more collection-level default metadata fields in metadata.yaml.

    Targeted per-key line patch (mirrors scripts/patch_citation_types.py's
    technique for markdown frontmatter) — never a full parse/re-serialize —
    so `files:` and comments are preserved untouched. Only touches this
    collection's metadata.yaml; never touches wiki/ output. An empty string
    value is still written explicitly (an intentionally-cleared default),
    not dropped.
    """
    path = collection_dir / 'metadata.yaml'
    if not path.exists():
        collection_dir.mkdir(parents=True, exist_ok=True)
        text = ''
    else:
        text = path.read_text(encoding='utf-8')

    for key, value in fields.items():
        new_line = f'{key}: "{value}"'
        pattern = _meta_key_re(key)
        if pattern.search(text):
            text = pattern.sub(new_line, text, count=1)
        else:
            sep = '' if text == '' or text.endswith('\n') else '\n'
            text = text + sep + new_line + '\n'

    path.write_text(text, encoding='utf-8')


def okf_header(*, collection: str, stem: str, pdf_relpath: str, page_count: int,
               coll_meta: dict, timestamp: str | None = None) -> str:
    okf_type = coll_meta.get('type') or FOLDER_TYPES.get(collection, 'Publication')
    citation_type = coll_meta.get('citation_type') or OKF_TYPE_TO_CITATION.get(okf_type, 'other')
    title = coll_meta.get('title') or to_title(collection)
    publisher = coll_meta.get('organization', '')
    file_meta = coll_meta.get('files', {}).get(stem + '.pdf', {})
    if file_meta.get('title'):
        title = file_meta['title']

    meta = parse_stem_meta(stem)

    desc_parts = [title]
    if meta['printed_volume']:
        desc_parts.append(f"vol. {meta['printed_volume']}")
    if meta['printed_issue']:
        desc_parts.append(f"no. {meta['printed_issue']}")
    if meta['year']:
        desc_parts.append(f"{meta['edition']} {meta['year']}".strip())
    description = ', '.join(desc_parts) + '.'

    ts = timestamp or datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

    lines = ['---']
    lines.append(f'type: "{okf_type}"')
    lines.append(f'citation_type: "{citation_type}"')
    lines.append(f'title: "{title}"')
    lines.append(f'description: "{description}"')
    lines.append(f'resource: "{pdf_relpath}"')
    lines.append(f'timestamp: "{ts}"')
    if publisher:
        lines.append(f'publisher: "{publisher}"')
    if meta['year']:
        lines.append(f'volume: "{meta["year"]}"')
    if meta['edition']:
        lines.append(f'edition: "{meta["edition"]}"')
    if meta['printed_volume']:
        lines.append(f'printed_volume: "{meta["printed_volume"]}"')
    if meta['printed_issue']:
        lines.append(f'printed_issue: "{meta["printed_issue"]}"')
    if file_meta.get('author'):
        lines.append(f'author: "{file_meta["author"]}"')
    lines.append(f'pages: "{page_count}"')
    lines.append('language: "en"')
    lines.append('---')
    return '\n'.join(lines)
