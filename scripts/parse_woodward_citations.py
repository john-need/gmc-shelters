#!/usr/bin/env python3
"""Parse Woodward history files and extract citations to woodward.json."""

import json
import re
from datetime import date
from pathlib import Path

SHELTERS_DIR = Path('/Users/johnneed/Projects/gmc-shelters/shelters')
OUTPUT_FILE = Path('/Users/johnneed/Projects/gmc-shelters/woodward.json')
TODAY = date.today().isoformat()

MONTH_MAP = {
    'jan': 'January', 'feb': 'February', 'mar': 'March', 'apr': 'April',
    'may': 'May', 'jun': 'June', 'jul': 'July', 'aug': 'August',
    'sep': 'September', 'sept': 'September', 'oct': 'October',
    'nov': 'November', 'dec': 'December',
    'january': 'January', 'february': 'February', 'march': 'March',
    'april': 'April', 'june': 'June', 'july': 'July', 'august': 'August',
    'september': 'September', 'october': 'October', 'november': 'November',
    'december': 'December',
    'fall': 'Fall', 'winter': 'Winter', 'spring': 'Spring', 'summer': 'Summer',
}


def find_year(text):
    # Fix typos like "1 923"
    text = re.sub(r'(\b1)\s+(\d{3}\b)', r'\1\2', text)
    m = re.search(r'\b(1[89]\d{2}|20[012]\d)\b', text)
    return int(m.group(1)) if m else None


def find_month(text):
    t = text.lower()
    for abbr in [
        'january', 'february', 'march', 'april', 'may', 'june', 'july',
        'august', 'september', 'october', 'november', 'december',
        'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sept', 'sep',
        'oct', 'nov', 'dec', 'fall', 'winter', 'spring', 'summer',
    ]:
        if re.search(r'\b' + re.escape(abbr) + r'\.?\b', t):
            return MONTH_MAP.get(abbr)
    return None


def make_base():
    return {
        'type': None, 'author': None, 'title': None, 'container_title': None,
        'editor': None, 'edition': None, 'volume': None, 'issue': None,
        'pages': None, 'publisher': None, 'place': None, 'year': None,
        'date': None, 'url': None, 'access_date': None, 'archive': None,
        'archive_location': None, 'created': TODAY, 'updated': TODAY, 'quote': None,
    }


def parse_date_str(date_str):
    """Parse m/d/yy or m/d/yyyy into (iso_date, year_int)."""
    parts = date_str.split('/')
    if len(parts) == 3:
        m_p, d_p, y_p = parts
        if len(y_p) == 2:
            y_p = ('19' if int(y_p) > 25 else '20') + y_p
        return f"{y_p}-{m_p.zfill(2)}-{d_p.zfill(2)}", int(y_p)
    return None, None


def classify_citation(raw, url=None, quote=None):  # noqa: C901
    r = raw.strip().rstrip('.')
    c = make_base()
    c['quote'] = quote.strip() if quote and quote.strip() else None
    if url:
        c['url'] = url

    # ── Guidebook ────────────────────────────────────────────────────────────
    # Covers: [GB Nth Edition YYYY], [G8 …], [17th Edition GB YYYY],
    # [Supplement to GB …], [1955 Supplement to GB …]
    is_gb = (bool(re.search(r'\bGB\b|\bG8\b', r)) or
             bool(re.search(r'\bEdition\b.*\bGB\b', r)))

    if is_gb and not re.search(r'\bnote\s+in\s+GB\b', r, re.IGNORECASE):
        c['type'] = 'book'
        c['title'] = 'Long Trail Guide Book'
        c['publisher'] = 'Green Mountain Club'

        anniv_m = re.search(r'(\d+(?:st|nd|rd|th)?\s+Anniversary\s+Edition)', r, re.IGNORECASE)
        ed_m = re.search(r'(\d+(?:st|nd|rd|th)?\s+Edition)', r, re.IGNORECASE)

        if anniv_m:
            edition = anniv_m.group(1).strip()
            paren_m = re.search(r'\((\d+(?:st|nd|rd|th)?)\)', r)
            if paren_m:
                edition += f' ({paren_m.group(1)})'
            c['edition'] = edition
        elif ed_m:
            c['edition'] = ed_m.group(1).strip()

        c['year'] = find_year(r)

        if re.search(r'\bsupplement\b', r, re.IGNORECASE):
            c['title'] = 'Long Trail Guide Book (Supplement)'
            month = find_month(r)
            if month:
                c['issue'] = month
        return c

    # Dickinson-style annotation: "E. P Dickinson note in GB 7th Edition 1928"
    if re.search(r'\bnote\s+in\s+GB\b', r, re.IGNORECASE):
        c['type'] = 'book'
        c['title'] = 'Long Trail Guide Book'
        c['publisher'] = 'Green Mountain Club'
        ed_m = re.search(r'(\d+(?:st|nd|rd|th)?\s+Edition)', r, re.IGNORECASE)
        if ed_m:
            c['edition'] = ed_m.group(1).strip()
        c['year'] = find_year(r)
        note_author_m = re.match(r'^([A-Z][^(]+?)\s+note\s+in', r)
        if note_author_m:
            c['editor'] = note_author_m.group(1).strip()
        return c

    # ── Long Trail News (LTN) ─────────────────────────────────────────────────
    is_ltn = bool(re.search(
        r'\bLT\s+New[s]?\b|\bLTN\b|\bLong\s+Trail\s+News\b|\bThe\s+LT\s+News\b',
        r, re.IGNORECASE,
    ))
    if is_ltn:
        # Authored article: "Author. LT News, …" or "Author, LT News, …"
        auth_m = re.match(r'^([A-Z][a-zA-Z\s\.]+?)[,\.]\s*(?:LT\s+New[s]?|LTN)', r)
        if auth_m:
            c['type'] = 'article'
            author_raw = auth_m.group(1).strip()
            # Strip trailing date fragment ("Larry Dean, Jan. 1940" → "Larry Dean")
            author_clean = re.sub(r',?\s+[A-Z][a-z]{2,}\.?\s+\d{4}\.?\s*$', '', author_raw).strip()
            c['author'] = author_clean or author_raw
            c['container_title'] = 'Long Trail News'
        else:
            c['type'] = 'magazine'
            c['title'] = 'Long Trail News'
        c['year'] = find_year(r)
        c['issue'] = find_month(r)
        return c

    # ── Green Mountain News ───────────────────────────────────────────────────
    if re.search(r'\bGM\s+News\b|\bGreen\s+Mountain\s+News\b', r, re.IGNORECASE):
        c['type'] = 'magazine'
        c['title'] = 'Green Mountain News'
        c['year'] = find_year(r)
        c['issue'] = find_month(r)
        return c

    # ── O'Kane ───────────────────────────────────────────────────────────────
    if re.search(r"O'Kane", r, re.IGNORECASE):
        c['type'] = 'book'
        c['author'] = "Walter O'Kane"
        c['title'] = 'Trails and Summits of the Green Mountains'
        c['year'] = find_year(r)
        return c

    # ── Burlington Section Records ────────────────────────────────────────────
    if re.search(r'Burlington Section Records', r, re.IGNORECASE):
        c['type'] = 'archive'
        c['title'] = 'Burlington Section Records'
        c['archive'] = 'Green Mountain Club Burlington Section'
        years = re.findall(r'\b(1[89]\d{2}|20\d{2})\b', r)
        if years:
            c['year'] = int(years[0])
            if len(years) > 1:
                c['date'] = f"{years[0]}–{years[-1]}"
        return c

    # ── Ridge Lines newsletter ────────────────────────────────────────────────
    if re.search(r'[Rr]idge\s+[Ll]ines?', r, re.IGNORECASE):
        c['type'] = 'newsletter'
        c['title'] = 'Ridge Lines'
        c['publisher'] = 'Green Mountain Club Burlington Section'
        vol_m = re.search(r'[Vv]ol\.?\s*(\d+)', r)
        no_m = re.search(r'[Nn]o\.?\s*(\d+)', r)
        c['volume'] = vol_m.group(1) if vol_m else None
        c['issue'] = no_m.group(1) if no_m else None
        c['year'] = find_year(r)
        return c

    # ── Sterling Section Newsletter ───────────────────────────────────────────
    if re.search(r'Sterling Section Newsletter', r, re.IGNORECASE):
        c['type'] = 'newsletter'
        c['title'] = 'Sterling Section Newsletter'
        c['publisher'] = 'Green Mountain Club Sterling Section'
        c['year'] = find_year(r)
        c['issue'] = find_month(r)
        return c

    # ── Forest & Crag ─────────────────────────────────────────────────────────
    if re.search(r'Forest\s+[&a]\w*\s+Crag', r, re.IGNORECASE):
        c['type'] = 'book'
        c['author'] = 'Laura and Guy Waterman'
        c['title'] = 'Forest & Crag'
        c['year'] = find_year(r)
        return c

    # ── The Making of the Long Trail ──────────────────────────────────────────
    if re.search(r'Making of the Long Trail', r, re.IGNORECASE):
        c['type'] = 'article'
        c['author'] = 'Lewis J. Paris'
        c['title'] = 'The Making of the Long Trail'
        c['container_title'] = 'Long Trail News'
        return c

    # ── History of Stratton ───────────────────────────────────────────────────
    if re.search(r'History of Stratton', r, re.IGNORECASE):
        c['type'] = 'book'
        c['author'] = 'D.K. Young'
        c['title'] = 'History of Stratton, Vt.'
        return c

    # ── ORR (Outing Record Report – Paul Woodward) ────────────────────────────
    if re.match(r'^ORR\.?\s', r) or r.strip() == 'ORR':
        c['type'] = 'personal'
        c['author'] = 'Paul Woodward'
        c['title'] = 'Outing Record Report'
        date_m = re.search(r'([A-Z][a-z]+)\s+(\d+),?\s+(\d{4})', r)
        if date_m:
            c['date'] = f"{date_m.group(1)} {date_m.group(2)}, {date_m.group(3)}"
        c['year'] = find_year(r)
        return c

    # ── Paul Woodward personal notes ──────────────────────────────────────────
    if re.match(r'^Paul Woodward', r):
        c['type'] = 'personal'
        c['author'] = 'Paul Woodward'
        date_m = re.search(r'(\d{1,2}/\d{1,2}/\d{2,4})', r)
        if date_m:
            iso, yr = parse_date_str(date_m.group(1))
            c['date'] = iso
            c['year'] = yr
        return c

    # ── Generic personal log: "First Last M/D/YY" ────────────────────────────
    personal_m = re.match(
        r'^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){1,3})\s+(\d{1,2}/\d{1,2}/\d{2,4})$', r,
    )
    if personal_m:
        c['type'] = 'personal'
        c['author'] = personal_m.group(1).strip()
        iso, yr = parse_date_str(personal_m.group(2))
        c['date'] = iso
        c['year'] = yr
        return c

    # ── Quoted-title citations: "Title," Publisher or "Title," Publisher(url) ─
    # Also handles: "Title" by Author
    quoted_m = re.match(r'^"([^"]+)",?\s+(.+)$', r)
    if quoted_m:
        c['title'] = quoted_m.group(1).strip().rstrip(',')
        rest = quoted_m.group(2).strip()
        by_m = re.match(r'^[Bb]y\s+(.+)', rest)
        if by_m:
            c['type'] = 'document'
            c['author'] = by_m.group(1).strip()
        else:
            c['type'] = 'website' if (url or re.search(
                r'Wikipedia|AllTrails|Trail\s*Finder|SectionHiker|Chronicle|Vermont|GMC|Green Mountain',
                rest,
            )) else 'document'
            pub_clean = re.sub(r'\s*\([^)]*\)\s*$', '', rest).strip()
            c['publisher'] = pub_clean
        year_m = re.search(r'\b(\d{4})\b', rest)
        if year_m:
            c['year'] = int(year_m.group(1))
        return c

    # ── "by Author" pattern (books, documents) ────────────────────────────────
    by_m = re.search(r'\bby\s+([A-Z][^,\]\n]+?)(?:[,\]]|\s*$)', r, re.IGNORECASE)
    if by_m:
        by_pos = r.lower().rfind(' by ')
        title_part = r[:by_pos].strip().strip('"') if by_pos > 0 else ''
        # All-caps title → document, mixed-case → book
        is_all_caps = bool(title_part and re.match(r'^[A-Z][A-Z\s\.,\':\-]+$', title_part))
        c['type'] = 'document' if is_all_caps else 'book'
        c['author'] = by_m.group(1).strip().rstrip(',')
        if title_part:
            c['title'] = title_part
        c['year'] = find_year(r)
        return c

    # ── Informational note (long, no clear structure) ─────────────────────────
    if len(r) > 100:
        c['type'] = 'note'
        c['title'] = r[:100] + '…'
        return c

    # ── Catch-all ─────────────────────────────────────────────────────────────
    c['type'] = 'document'
    c['title'] = r
    c['year'] = find_year(r)
    return c


_ABBREV_PAT = re.compile(
    r'\b(?:Mr|Mrs|Ms|Dr|Prof|Rev|Mt|St|Jr|Sr|Lt|Sgt|Cpl|Vol|No|Ed|vs|etc|approx)\.',
    re.IGNORECASE,
)


def extract_quote(text_segment):
    """Return the last meaningful sentence from the text segment preceding a citation."""
    text = text_segment.strip()
    if not text:
        return None
    # Strip markdown headings, bold, and list markers
    text = re.sub(r'^\s*#+\s+.+$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\*\*[^*]+\*\*', '', text)
    text = re.sub(r'\*[^*]+\*', '', text)
    text = re.sub(r'^\s*[-*]\s+', '', text, flags=re.MULTILINE)
    text = text.strip()
    if not text:
        return None
    # Take the last paragraph (double-newline separated block)
    paragraphs = [p.strip() for p in re.split(r'\n\s*\n', text) if len(p.strip()) > 15]
    if not paragraphs:
        return text.strip() or None
    last_para = paragraphs[-1]
    # Within the last paragraph, split sentences only at boundaries where the next
    # word starts with a capital letter and the period is not an abbreviation.
    # Placeholder abbreviation periods so they don't trigger splits.
    masked = _ABBREV_PAT.sub(lambda m: m.group().replace('.', '\x00'), last_para)
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z])', masked)
    sentences = [s.replace('\x00', '.').strip() for s in sentences if len(s.strip()) > 15]
    if not sentences:
        return last_para
    return sentences[-1]


def extract_markdown_link_citations(content):
    """Handle citations written as markdown links: ['title,' Publisher](url).

    The comma may appear inside or outside the closing quote.
    """
    citations = []
    # Match any [text](url) where text starts with a double-quote
    pattern = re.compile(r'\[("(?:[^"]+)"[^\]]*)\]\(([^)]+)\)')
    for m in pattern.finditer(content):
        raw = m.group(1)
        url = m.group(2)
        c = classify_citation(raw, url=url, quote=None)
        citations.append(c)
    return citations


def parse_file(filepath):
    content = filepath.read_text(encoding='utf-8')

    # Pull out markdown-link citations first (e.g. shrewsbury-peak-shelter)
    md_link_citations = extract_markdown_link_citations(content)

    # Strip markdown links so their [text] part isn't double-counted as inline citations
    content_stripped = re.sub(r'\[([^\]]+)\]\([^)]+\)', '', content)

    # Split by inline [citation] brackets
    parts = re.split(r'\[([^\[\]]+)\]', content_stripped)

    inline_citations = []
    for i in range(1, len(parts), 2):
        raw = parts[i]
        text_before = parts[i - 1]
        quote = extract_quote(text_before)
        c = classify_citation(raw, quote=quote)
        inline_citations.append(c)

    return inline_citations + md_link_citations


def main():
    result = {}
    skipped = []

    for slug_dir in sorted(SHELTERS_DIR.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        woodward_file = slug_dir / f'woodward-{slug}.md'
        if not woodward_file.exists():
            skipped.append(slug)
            continue

        citations = parse_file(woodward_file)
        if citations:
            result[slug] = citations

    OUTPUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')

    total = sum(len(v) for v in result.values())
    print(f"Wrote {len(result)} shelters, {total} citations → {OUTPUT_FILE}")
    print(f"Skipped {len(skipped)} shelters with no woodward file.")


if __name__ == '__main__':
    main()
