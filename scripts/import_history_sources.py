#!/usr/bin/env python3
"""Import citations from history-sources.json into sources and shelter_sources.

Dedup strategy: each source is fingerprinted by its full set of content fields
(type, author, title, …, archive_location). If a matching row already exists in
sources, its id is reused; otherwise a new row is inserted.  shelter_sources
links are inserted with INSERT OR IGNORE, so existing associations are preserved.

Usage:
    python3 scripts/import_history_sources.py
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / 'database' / 'gmc_shelters.sqlite'
JSON_PATH = Path(__file__).parent.parent / 'history-sources.json'

# All content columns in declaration order (no id / created / updated).
CONTENT_FIELDS = (
    'type', 'author', 'title', 'container_title', 'editor', 'edition',
    'volume', 'issue', 'pages', 'publisher', 'place', 'year', 'date',
    'url', 'access_date', 'archive', 'archive_location',
)

TEXT_FIELDS = {f for f in CONTENT_FIELDS if f != 'year'}


def coerce(citation: dict) -> dict:
    """Normalise a citation dict: None → '' for NOT NULL TEXT columns."""
    row = dict(citation)
    for field in TEXT_FIELDS:
        if row.get(field) is None:
            row[field] = ''
    return row


def fingerprint(row: dict) -> tuple:
    return tuple(row.get(f) for f in CONTENT_FIELDS)


def load_existing_sources(conn) -> dict[tuple, int]:
    """Return a fingerprint → id map for all rows already in sources."""
    rows = conn.execute(
        f"SELECT {', '.join(CONTENT_FIELDS)}, id FROM sources"
    ).fetchall()
    return {row[:-1]: row[-1] for row in rows}


def main():
    data = json.loads(JSON_PATH.read_text())

    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA foreign_keys = ON')

    inserted_sources = 0
    reused_sources = 0
    inserted_links = 0
    skipped_links = 0

    with conn:
        slug_to_id = {
            row[0]: row[1]
            for row in conn.execute('SELECT slug, id FROM shelters')
        }

        existing = load_existing_sources(conn)

        for slug, citations in data.items():
            shelter_id = slug_to_id.get(slug)
            if shelter_id is None:
                continue

            for citation in citations:
                row = coerce(citation)
                fp = fingerprint(row)

                if fp in existing:
                    source_id = existing[fp]
                    reused_sources += 1
                else:
                    cur = conn.execute(
                        f"""
                        INSERT INTO sources ({', '.join(CONTENT_FIELDS)})
                        VALUES ({', '.join(':' + f for f in CONTENT_FIELDS)})
                        """,
                        row,
                    )
                    source_id = cur.lastrowid
                    existing[fp] = source_id
                    inserted_sources += 1

                result = conn.execute(
                    'INSERT OR IGNORE INTO shelter_sources (shelter_id, source_id) VALUES (?, ?)',
                    (shelter_id, source_id),
                )
                if result.rowcount:
                    inserted_links += 1
                else:
                    skipped_links += 1

    print(f'Sources:        {inserted_sources} inserted, {reused_sources} reused')
    print(f'shelter_sources: {inserted_links} inserted, {skipped_links} already existed')

    skipped_slugs = [slug for slug in data if slug not in slug_to_id]
    if skipped_slugs:
        print(f'Skipped {len(skipped_slugs)} unmatched slug(s): {", ".join(skipped_slugs)}')


if __name__ == '__main__':
    main()
