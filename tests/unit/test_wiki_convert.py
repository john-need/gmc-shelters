"""Unit tests for scripts/lib/wiki_convert.py — OKF profile conversion logic."""
from __future__ import annotations

from pathlib import Path

from scripts.lib import wiki_convert as wc


def header_fields(header: str) -> dict[str, str]:
    """Parse the flat `key: "value"` frontmatter block we emit."""
    fields = {}
    for line in header.splitlines():
        if line == '---':
            continue
        key, _, value = line.partition(':')
        fields[key.strip()] = value.strip().strip('"')
    return fields


class TestOkfHeader:
    def test_newsletter_header_follows_profile(self):
        header = wc.okf_header(
            collection='Long Trail News',
            stem='1922_12_Dec',
            pdf_relpath='collections/Long Trail News/1922_12_Dec.pdf',
            page_count=6,
            coll_meta={'organization': 'Green Mountain Club'},
            timestamp='2026-07-02T00:00:00Z',
        )
        f = header_fields(header)
        assert f['type'] == 'Newsletter'
        assert f['citation_type'] == 'magazine'
        assert f['title'] == 'Long Trail News'
        assert f['publisher'] == 'Green Mountain Club'
        assert f['volume'] == '1922'
        assert f['edition'] == 'December'
        assert f['resource'] == 'collections/Long Trail News/1922_12_Dec.pdf'
        assert f['pages'] == '6'
        assert f['language'] == 'en'
        assert f['timestamp'] == '2026-07-02T00:00:00Z'
        # profile explicitly removes these
        assert 'tags' not in f
        assert 'date' not in f

    def test_book_header_includes_author_and_title_from_metadata(self):
        coll_meta = {
            'organization': 'Green Mountain Club',
            'files': {
                'history-of-stratton-vt.pdf': {
                    'author': 'Jane Doe',
                    'title': 'History of Stratton, Vermont',
                },
            },
        }
        header = wc.okf_header(
            collection='Books',
            stem='history-of-stratton-vt',
            pdf_relpath='collections/Books/history-of-stratton-vt.pdf',
            page_count=120,
            coll_meta=coll_meta,
            timestamp='2026-07-02T00:00:00Z',
        )
        f = header_fields(header)
        assert f['type'] == 'Book'
        assert f['citation_type'] == 'book'
        assert f['author'] == 'Jane Doe'
        assert f['title'] == 'History of Stratton, Vermont'

    def test_every_document_in_a_collection_gets_the_same_citation_type(self):
        """Citation type is a collection-wide rule, not per-document."""
        h1 = wc.okf_header(
            collection='Ridgelines (Burlington)', stem='issue1',
            pdf_relpath='collections/Ridgelines (Burlington)/issue1.pdf',
            page_count=4, coll_meta={}, timestamp='2026-07-02T00:00:00Z',
        )
        h2 = wc.okf_header(
            collection='Ridgelines (Burlington)', stem='issue2',
            pdf_relpath='collections/Ridgelines (Burlington)/issue2.pdf',
            page_count=4, coll_meta={}, timestamp='2026-07-02T00:00:00Z',
        )
        assert header_fields(h1)['citation_type'] == header_fields(h2)['citation_type'] == 'magazine'

    def test_unmapped_collection_falls_back_to_other_citation_type(self):
        header = wc.okf_header(
            collection='Some New Unmapped Collection', stem='doc',
            pdf_relpath='collections/Some New Unmapped Collection/doc.pdf',
            page_count=1, coll_meta={}, timestamp='2026-07-02T00:00:00Z',
        )
        f = header_fields(header)
        assert f['type'] == 'Publication'
        assert f['citation_type'] == 'other'

    def test_printed_volume_and_issue_from_filename(self):
        header = wc.okf_header(
            collection='montpelier-trail-talk',
            stem='TrailTalk_Vol.19No.21989',
            pdf_relpath='collections/montpelier-trail-talk/TrailTalk_Vol.19No.21989.pdf',
            page_count=8,
            coll_meta={'organization': 'Montpelier Section, Green Mountain Club'},
            timestamp='2026-07-02T00:00:00Z',
        )
        f = header_fields(header)
        assert f['printed_volume'] == '19'
        assert f['printed_issue'] == '2'
        assert f['volume'] == '1989'

    def test_season_edition(self):
        header = wc.okf_header(
            collection='bennington-stepping-stone',
            stem='SteppingStone_2024_SpringSummer',
            pdf_relpath='collections/bennington-stepping-stone/SteppingStone_2024_SpringSummer.pdf',
            page_count=12,
            coll_meta={'organization': 'Bennington Section, Green Mountain Club'},
            timestamp='2026-07-02T00:00:00Z',
        )
        f = header_fields(header)
        assert f['volume'] == '2024'
        assert f['edition'] == 'Spring/Summer'


class TestCollectionMetadata:
    def test_loads_organization_and_file_entries(self, tmp_path: Path):
        (tmp_path / 'metadata.yaml').write_text(
            'organization: "Green Mountain Club"\n'
            'files:\n'
            '  history-of-stratton-vt.pdf:\n'
            '    author: "Jane Doe"\n'
            '    title: "History of Stratton, Vermont"\n',
            encoding='utf-8',
        )
        meta = wc.load_collection_meta(tmp_path)
        assert meta['organization'] == 'Green Mountain Club'
        assert meta['files']['history-of-stratton-vt.pdf']['author'] == 'Jane Doe'

    def test_missing_file_returns_empty_meta(self, tmp_path: Path):
        meta = wc.load_collection_meta(tmp_path)
        assert meta == {'organization': '', 'files': {}}


class TestPageMarkers:
    def test_pdftotext_form_feeds_become_page_markers(self):
        raw = 'first page text\fsecond page text\fthird page text'
        body = wc.render_pages(wc.split_pages(raw))
        assert '<!-- page: 1 -->\nfirst page text' in body
        assert '<!-- page: 2 -->\nsecond page text' in body
        assert '<!-- page: 3 -->\nthird page text' in body

    def test_empty_page_keeps_numbering_aligned(self):
        raw = 'page one\f\fpage three'
        body = wc.render_pages(wc.split_pages(raw))
        assert '<!-- page: 2 -->\n[illegible]' in body
        assert '<!-- page: 3 -->\npage three' in body

    def test_trailing_form_feed_does_not_add_phantom_page(self):
        raw = 'only page\f'
        pages = wc.split_pages(raw)
        assert len(pages) == 1


class FakeLlm:
    """Records calls; 'cleans' by prefixing so tests can see the pass ran."""
    def __init__(self):
        self.calls: list[str] = []

    def __call__(self, prompt: str) -> str:
        self.calls.append(prompt)
        return 'CLEANED'


def make_pdf(tmp_path: Path, name: str = 'x.pdf', content: bytes = b'%PDF-fake-1') -> Path:
    pdf = tmp_path / 'collections' / 'long-trail-news' / name
    pdf.parent.mkdir(parents=True, exist_ok=True)
    pdf.write_bytes(content)
    return pdf


class TestCleanupAndCache:
    def test_clean_pages_calls_llm_once_per_page_with_fidelity_rules(self):
        llm = FakeLlm()
        cleaned = wc.clean_pages(['page one', 'page two'], llm)
        assert cleaned == ['CLEANED', 'CLEANED']
        assert len(llm.calls) == 2
        # the fidelity contract must ride along in every prompt
        assert 'never paraphrase' in llm.calls[0].lower()
        assert '[illegible]' in llm.calls[0]

    def test_convert_document_writes_markdown_with_header_and_pages(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        llm = FakeLlm()
        audit = wc.convert_document(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one\fraw two',
            llm=llm,
        )
        assert audit['status'] == 'converted'
        md = (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').read_text(encoding='utf-8')
        assert md.startswith('---')
        assert 'publisher: "Green Mountain Club"' in md
        assert '<!-- page: 1 -->\nCLEANED' in md
        assert '<!-- page: 2 -->\nCLEANED' in md
        assert 'pages: "2"' in md

    def test_rerun_with_unchanged_pdf_makes_zero_llm_calls(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        kwargs = dict(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one\fraw two',
        )
        wc.convert_document(llm=FakeLlm(), **kwargs)
        first = (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').read_text(encoding='utf-8')

        llm2 = FakeLlm()
        audit = wc.convert_document(llm=llm2, **kwargs)
        assert audit['status'] == 'cached'
        assert llm2.calls == []
        second = (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').read_text(encoding='utf-8')
        assert second == first

    def test_changed_pdf_is_reconverted(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        kwargs = dict(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one',
        )
        wc.convert_document(llm=FakeLlm(), **kwargs)
        pdf.write_bytes(b'%PDF-fake-2-different')
        llm2 = FakeLlm()
        audit = wc.convert_document(llm=llm2, **kwargs)
        assert audit['status'] == 'converted'
        assert len(llm2.calls) == 1

    def test_raw_run_never_downgrades_a_cleaned_document(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        kwargs = dict(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one',
        )
        wc.convert_document(llm=FakeLlm(), cache_variant='clean', **kwargs)
        cleaned = (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').read_text(encoding='utf-8')

        llm = FakeLlm()
        audit = wc.convert_document(llm=llm, cache_variant='raw', **kwargs)
        assert audit['status'] == 'cached'
        assert llm.calls == []
        assert (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').read_text(encoding='utf-8') == cleaned

    def test_purge_cache_removes_all_variants_for_a_pdf(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        kwargs = dict(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one',
        )
        wc.convert_document(llm=FakeLlm(), cache_variant='raw', **kwargs)
        wc.purge_cache(tmp_path / 'cache', pdf)
        llm = FakeLlm()
        audit = wc.convert_document(llm=llm, cache_variant='raw', **kwargs)
        assert audit['status'] == 'converted'  # cache was purged, so it re-ran
        assert len(llm.calls) == 1

    def test_uncleaned_runs_do_not_poison_the_cleaned_cache(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        kwargs = dict(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one',
        )
        wc.convert_document(llm=FakeLlm(), cache_variant='raw', **kwargs)
        llm = FakeLlm()
        audit = wc.convert_document(llm=llm, **kwargs)  # default: cleaned variant
        assert audit['status'] == 'converted'
        assert len(llm.calls) == 1

    def test_llm_failure_writes_nothing_and_reports_failed(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)

        def boom(prompt: str) -> str:
            raise RuntimeError('api down')

        audit = wc.convert_document(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one\fraw two',
            llm=boom,
        )
        assert audit['status'] == 'failed'
        assert not (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').exists()
        # failed docs must be retried next run, so nothing may be cached
        llm2 = FakeLlm()
        audit2 = wc.convert_document(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one\fraw two',
            llm=llm2,
        )
        assert audit2['status'] == 'converted'
        assert len(llm2.calls) == 2


class TestIllustrations:
    def test_render_lists_captions_with_pages_and_untitled_fallback(self):
        section = wc.render_illustrations([
            {'page': 3, 'caption': 'Monroe Lodge under construction', 'image': 'images/x_p3_1.png'},
            {'page': 5, 'caption': '', 'image': 'images/x_p5_1.png'},
        ])
        assert '## List of Illustrations' in section
        assert 'Monroe Lodge under construction (p. 3)' in section
        assert 'Untitled illustration, p. 5' in section
        assert '](images/x_p3_1.png)' in section

    def test_harvest_extracts_images_and_captions_them(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        images_dir = tmp_path / 'wiki' / 'long-trail-news' / 'images'

        def fake_pdfimages(pdf_path: Path, prefix: Path) -> None:
            # pdfimages -png -p names files {prefix}-{page:03d}-{num:03d}.png
            prefix.parent.mkdir(parents=True, exist_ok=True)
            Path(f'{prefix}-003-000.png').write_bytes(b'png3')
            Path(f'{prefix}-005-001.png').write_bytes(b'png5')

        captions = {'png3': 'Monroe Lodge under construction', 'png5': ''}
        illustrations = wc.harvest_illustrations(
            pdf, images_dir,
            run_pdfimages=fake_pdfimages,
            captioner=lambda p: captions[p.read_bytes().decode()],
        )
        assert [il['page'] for il in illustrations] == [3, 5]
        assert illustrations[0]['caption'] == 'Monroe Lodge under construction'
        assert illustrations[0]['image'].startswith('images/')
        assert (images_dir / Path(illustrations[0]['image']).name).exists()

    def test_convert_document_appends_illustrations_section(self, tmp_path: Path):
        pdf = make_pdf(tmp_path)
        audit = wc.convert_document(
            pdf=pdf,
            repo_root=tmp_path,
            wiki_root=tmp_path / 'wiki',
            cache_dir=tmp_path / 'cache',
            coll_meta={'organization': 'Green Mountain Club'},
            extract_text=lambda p: 'raw one',
            llm=FakeLlm(),
            extract_illustrations=lambda p: [
                {'page': 2, 'caption': 'A cabin', 'image': 'images/x_p2_1.png'},
            ],
        )
        assert audit['status'] == 'converted'
        md = (tmp_path / 'wiki' / 'long-trail-news' / 'x.md').read_text(encoding='utf-8')
        assert '## List of Illustrations' in md
        assert 'A cabin (p. 2)' in md


class TestQualityHeuristic:
    def test_clean_prose_scores_low_and_garbled_scores_high(self):
        clean = 'The Green Mountain Club held its annual meeting in Rutland.'
        garbled = 'Th~ Gr##n M0unt@1n C1vb h3ld 1ts @nnu@l m##t1ng 1n Rvtl@nd zxq wqx.'
        assert wc.garbled_ratio(clean) < 0.1
        assert wc.garbled_ratio(garbled) > 0.3
