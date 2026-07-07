# Contract: Anthropic Messages API (OCR cleanup + illustration captions)

External integration used only by the conversion pipeline
(`scripts/ocr_to_markdown.py` via `scripts/lib/llm_client.py`).
The Electron app never calls the API.

## Endpoint & auth

- `POST https://api.anthropic.com/v1/messages`, header `anthropic-version: 2023-06-01`
- Auth: `x-api-key` from the `ANTHROPIC_API_KEY` environment variable, falling
  back to the gitignored `.anthropic_api_key` file at the repo root (written by
  the app's Settings → AI Integration page, chmod 600). Never committed; the
  pipeline exits with a clear error if neither is set (run with `--no-clean`
  for an offline dry run).

## Models

- Default: `claude-haiku-4-5-20251001` (cheap; fine for most scans)
- Escalation: `claude-sonnet-4-6` (documents flagged by the garbled-ratio
  heuristic after cleanup)

## Calls

1. **Text cleanup** — one call per PDF page. Prompt (`wiki_convert.CLEANUP_PROMPT`)
   enforces the fidelity contract: fix reading order and OCR errors only,
   never paraphrase, preserve proper nouns, mark unreadable text `[illegible]`.
2. **Illustration captions** — one vision call per extracted image ≥ 20 KB.
   Returns the printed caption, a short description, or `SKIP` for non-illustrations.

## Cost & rerun safety

Output is cached in `collections/.conversion_cache/` keyed by
sha256(PDF) + pipeline version + variant. Unchanged PDFs are rewritten from
cache with **zero** API calls; a failed document writes nothing and is
retried on the next run. Bump `wiki_convert.PIPELINE_VERSION` to invalidate.
