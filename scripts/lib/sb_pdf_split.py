"""One-time split of the combined Smoke & Blazes scan PDFs into per-issue PDFs.

After this runs, smoke-and-blazes is a normal collection: one PDF per issue,
converted/cleaned/tracked individually. The combined scans are archived to
originals/ and excluded from every pipeline scan.

Sources are processed in priority order — the later (cleaner 2013-2020) scan
wins for any issue present in both.
"""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

# Matches issue-header lines like "Vol. 2 No. 3  Killington Section  March 1949"
HEADER_RE = re.compile(
    r'^\s*V[oO][^\n]{0,50}(?:N[oObB]|Number)\s*\S[^\n]{0,30}Killington',
    re.IGNORECASE | re.MULTILINE,
)

ROMAN = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
    'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12,
}


def _roman(s: str) -> str:
    if s.isdigit():
        return s
    return str(ROMAN.get(s.upper(), '')) or s


def parse_header(line: str) -> dict[str, str]:
    meta = {'volume': '', 'issue': '', 'year': ''}
    m = re.search(r'V[oO][lwuLwW][^\d]{0,20}(\d+)', line, re.IGNORECASE)
    if m:
        meta['volume'] = str(int(m.group(1)))  # strip OCR leading zeros
    m = re.search(r'(?:N[oObB][\s.,]*|Number\s+)([0-9]+|[IVX]+)\b', line, re.IGNORECASE)
    if m:
        meta['issue'] = _roman(m.group(1))
    m = re.search(r'\b(1[89]\d\d|20[012]\d)\b', line)
    if m:
        meta['year'] = m.group(1)
    return meta


def out_name(meta: dict[str, str], idx: int) -> str:
    yr, vol, iss = meta['year'], meta['volume'], meta['issue']
    if yr and vol and iss:
        return f'Smoke_and_Blazes_{yr}_V{vol.zfill(2)}_N{iss.zfill(2)}.pdf'
    if yr and vol:
        return f'Smoke_and_Blazes_{yr}_V{vol.zfill(2)}.pdf'
    return f'Smoke_and_Blazes_issue_{idx:04d}.pdf'


def plan_issues(pages: list[str], min_year: int, max_year: int) -> list[dict]:
    """[{name, start, end}] with 1-based inclusive page ranges.

    A header page starts an issue; it runs to the page before the next header.
    Issues whose year falls outside [min_year, max_year] (historical reprints
    embedded in modern issues) are dropped, but still terminate the previous
    issue's range.
    """
    starts: list[tuple[int, str]] = []
    for i, text in enumerate(pages):
        m = HEADER_RE.search(text)
        if m:
            line_end = text.find('\n', m.start())
            full_line = text[m.start():line_end if line_end != -1 else len(text)]
            starts.append((i + 1, full_line))

    plan = []
    for idx, (page, header_line) in enumerate(starts):
        end = starts[idx + 1][0] - 1 if idx + 1 < len(starts) else len(pages)
        meta = parse_header(header_line)
        yr = int(meta['year']) if meta['year'].isdigit() else 0
        if yr and not (min_year <= yr <= max_year):
            continue
        plan.append({'name': out_name(meta, idx), 'start': page, 'end': end})
    return plan


def merge_plans(source_plans: list[tuple[str, list[dict]]]) -> dict[str, tuple[str, int, int]]:
    """{issue_pdf_name: (source, start, end)} — later sources win duplicates."""
    merged: dict[str, tuple[str, int, int]] = {}
    for source, plan in source_plans:
        for issue in plan:
            merged[issue['name']] = (source, issue['start'], issue['end'])
    return merged


def cut_pdf(src: Path, start: int, end: int, out: Path) -> None:
    r = subprocess.run(
        ['qpdf', str(src), '--pages', '.', f'{start}-{end}', '--', str(out)],
        capture_output=True,
    )
    if r.returncode not in (0, 3):  # 3 = success with warnings (common on old scans)
        raise RuntimeError(f'qpdf failed on {src.name} {start}-{end}: {r.stderr.decode()[:200]}')


def split_text_pages(raw: str) -> list[str]:
    pages = raw.split('\f')
    if pages and not pages[-1].strip():
        pages.pop()
    return pages


def pdf_pages_text(pdf: Path) -> list[str]:
    r = subprocess.run(['pdftotext', '-layout', str(pdf), '-'],
                       capture_output=True, text=True, check=True)
    return split_text_pages(r.stdout)
