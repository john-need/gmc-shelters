"""Unit tests for scripts/lib/sb_pdf_split.py — one-time per-issue PDF split."""
from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from scripts.lib import sb_pdf_split as sps

HEADER_1949 = 'Vol. 2 No. 3   Killington Section G.M.C.   March 1949'
HEADER_2014 = 'Volume 66, Number 1  Killington Section, Green Mountain Club  March 2014'


class TestPlanIssues:
    def test_issue_page_ranges_run_to_next_header(self):
        pages = [
            f'{HEADER_1949}\nissue text page 1',
            'continuation page 2',
            f'{HEADER_2014}\nnext issue',
            'more text',
        ]
        plan = sps.plan_issues(pages, 1940, 2016)
        assert [(p['start'], p['end']) for p in plan] == [(1, 2), (3, 4)]
        assert plan[0]['name'] == 'Smoke_and_Blazes_1949_V02_N03.pdf'
        assert plan[1]['name'] == 'Smoke_and_Blazes_2014_V66_N01.pdf'

    def test_pages_before_first_header_are_skipped(self):
        pages = ['cover / scan noise', f'{HEADER_1949}\ntext']
        plan = sps.plan_issues(pages, 1940, 2016)
        assert [(p['start'], p['end']) for p in plan] == [(2, 2)]

    def test_year_filter_drops_embedded_reprints(self):
        pages = [f'{HEADER_1949}\ntext', f'{HEADER_2014}\nreprint outside range']
        plan = sps.plan_issues(pages, 1940, 1999)
        assert len(plan) == 1
        # the reprint's pages still end the previous issue's range
        assert plan[0]['end'] == 1


class TestMergePlans:
    def test_newer_source_wins_for_duplicate_issues(self):
        old = [{'name': 'Smoke_and_Blazes_2014_V66_N01.pdf', 'start': 1, 'end': 2}]
        new = [{'name': 'Smoke_and_Blazes_2014_V66_N01.pdf', 'start': 5, 'end': 9}]
        merged = sps.merge_plans([('old.pdf', old), ('new.pdf', new)])
        assert merged == {'Smoke_and_Blazes_2014_V66_N01.pdf': ('new.pdf', 5, 9)}


def test_trailing_form_feed_is_not_a_page():
    # pdftotext output ends with \f; splitting naively yields a phantom page
    # that pushes the last issue's range past the PDF's real page count
    assert sps.split_text_pages('page one\fpage two\f') == ['page one', 'page two']


def make_minimal_pdf(path: Path, n_pages: int) -> None:
    """Hand-rolled valid PDF with n empty pages (no external deps)."""
    kids = ' '.join(f'{3 + i} 0 R' for i in range(n_pages))
    objs = [
        '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
        f'2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {n_pages} >>\nendobj\n',
    ]
    for i in range(n_pages):
        objs.append(
            f'{3 + i} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n'
        )
    body = ''
    offsets = []
    header = '%PDF-1.4\n'
    pos = len(header)
    for o in objs:
        offsets.append(pos)
        body += o
        pos += len(o)
    xref = f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'
    for off in offsets:
        xref += f'{off:010d} 00000 n \n'
    trailer = (
        f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n'
        f'startxref\n{pos}\n%%EOF\n'
    )
    path.write_text(header + body + xref + trailer, encoding='latin-1')


def npages(pdf: Path) -> int:
    r = subprocess.run(['qpdf', '--show-npages', str(pdf)], capture_output=True, text=True)
    return int(r.stdout.strip())


@pytest.mark.skipif(subprocess.run(['which', 'qpdf'], capture_output=True).returncode != 0,
                    reason='qpdf not installed')
def test_cut_pdf_extracts_the_page_range(tmp_path: Path):
    src = tmp_path / 'combined.pdf'
    make_minimal_pdf(src, 5)
    out = tmp_path / 'issue.pdf'
    sps.cut_pdf(src, 3, 5, out)
    assert npages(out) == 3
