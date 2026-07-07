#!/usr/bin/env python3
"""
Clean up a single citation-source quote using Claude — the same fidelity
contract as the collection-document OCR cleanup, applied to one short
text field instead of a full document. Never reads or writes any file
other than the existing key/model preference files.

Usage:
  python3 scripts/clean_quote.py "<quote text>"
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib import wiki_convert as wc
from scripts.lib.llm_client import AnthropicClient, load_api_key, load_model_tier, resolve_primary_model


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if not argv:
        print('Usage: clean_quote.py "<quote text>"', file=sys.stderr)
        return 1

    text = argv[0]
    try:
        client = AnthropicClient(
            api_key=load_api_key(REPO),
            primary_model=resolve_primary_model(load_model_tier(REPO)),
        )
        cleaned = wc.clean_quote(text, client.complete)
    except Exception as exc:  # noqa: BLE001 — any failure is reported via stderr/exit code
        print(str(exc), file=sys.stderr)
        return 1

    print(cleaned)
    return 0


if __name__ == '__main__':
    sys.exit(main())
