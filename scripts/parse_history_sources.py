#!/usr/bin/env python3
"""Read {slug}.md history files, extract ## Sources citations, write history-sources.json.

Each slug maps to an array of structured citation objects (same schema as woodward.json)
ready for import_woodward_sources.py to insert into sources / shelter_sources tables.

Usage:
    python3 scripts/parse_history_sources.py
"""

import json
import re
import sys
from pathlib import Path

# Reuse classify_citation from the sibling script.
sys.path.insert(0, str(Path(__file__).parent))
from parse_woodward_citations import classify_citation  # noqa: E402

SHELTERS_DIR = Path(__file__).parent.parent / 'shelters'
OUTPUT_FILE = Path(__file__).parent.parent / 'history-sources.json'

_SOURCES_RE = re.compile(r'^#{2,3}\s+Sources\s*$', re.MULTILINE)


def extract_sources(content: str) -> list[str]:
    """Return raw citation strings from the Sources section."""
    m = _SOURCES_RE.search(content)
    if not m:
        return []

    section = content[m.end():]
    citations = []
    for line in section.splitlines():
        stripped = line.strip()
        if stripped.startswith('- '):
            citations.append(stripped[2:].strip())
        elif stripped.startswith('#'):
            break  # next heading — stop
    return [c for c in citations if c]


def main():
    result: dict[str, list] = {}
    skipped: list[str] = []

    for slug_dir in sorted(SHELTERS_DIR.iterdir()):
        if not slug_dir.is_dir():
            continue
        slug = slug_dir.name
        history_file = slug_dir / f'{slug}.md'
        if not history_file.exists():
            skipped.append(slug)
            continue

        raw_citations = extract_sources(history_file.read_text(encoding='utf-8'))
        if raw_citations:
            result[slug] = [classify_citation(raw) for raw in raw_citations]

    OUTPUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')

    total = sum(len(v) for v in result.values())
    print(f'Wrote {len(result)} shelters, {total} citations → {OUTPUT_FILE}')
    if skipped:
        print(f'Skipped {len(skipped)} shelters with no history file.')


if __name__ == '__main__':
    main()
