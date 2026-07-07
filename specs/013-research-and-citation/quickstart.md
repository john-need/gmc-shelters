# Quickstart: Research Search & Citation Pipeline

## Prerequisites

```bash
brew install ocrmypdf poppler     # pdftotext, pdfimages, qpdf, OCR
```

API key for cleanup + captions (not needed for offline adds), either:

- In the app: Settings → **Collections Management** → paste your Anthropic key
  (saved to the gitignored `.anthropic_api_key` at the repo root), or
- `export ANTHROPIC_API_KEY=sk-...` (env var takes precedence over the file).

## In the app (recommended)

Settings → **Collections Management** lists every collection with
`N of M to add · N of M to clean`. Expand a collection, check files (or the
whole collection), then:

- **Add to wiki** — fast offline conversion (`--no-clean --no-images`); text is
  searchable immediately but keeps OCR artifacts.
- **Clean up** — full Anthropic pass on the selected PDFs: fixes reading order
  and OCR errors, captions illustrations. Already-clean files are skipped
  unless you confirm a re-run (re-runs purge those files' cache entries).

Status is derived from the conversion cache, so terminal runs and app runs
always agree. The search index rebuilds automatically after each run.

## From the terminal

```bash
python3 scripts/ocr_to_markdown.py                       # everything
python3 scripts/ocr_to_markdown.py books                 # one collection
python3 scripts/ocr_to_markdown.py --files collections/books/x.pdf
python3 scripts/ocr_to_markdown.py --no-clean --no-images  # offline add
python3 scripts/ocr_to_markdown.py --force --files ...     # redo cached files
python3 scripts/build_wiki_index.py                          # rebuild search index
python3 scripts/collection_status.py                         # status JSON
```

Each run ends with an audit line (`Audit: N converted, M cached, K failed`)
plus files flagged for escalation. Failed documents retry automatically on the
next run; unchanged PDFs cost zero API calls.

## Smoke & Blazes

The combined 1948–2016 and 2013–2020 scans were split once into per-issue PDFs
(`scripts/split_sb_pdfs.py`; the newer scan won overlapping issues). The
combined originals are archived in `collections/smoke-and-blazes/originals/`
and excluded from all scans. Smoke & Blazes is now a normal collection —
there is no separate splitting step in the pipeline.

## Adding new PDFs

Drop the PDF into the right `collections/<name>/` folder (create
`metadata.yaml` with `organization:` for a new collection; books also need
`files:` entries with `author:`). It appears in Collections Management as
"needs addition".

## Metadata corrections

Edit `collections/<name>/metadata.yaml`, then re-run the affected files with
`--force` (or the app's re-run confirmation), or bump `PIPELINE_VERSION` in
`scripts/lib/wiki_convert.py` to redo everything.
