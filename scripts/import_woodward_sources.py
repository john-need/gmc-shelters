#!/usr/bin/env python3
"""Import citations from woodward.json into the sources and shelter_sources tables.

Runs clean-slate: deletes all existing sources and shelter_sources rows, then
inserts one sources row per citation and links it to its shelter via shelter_sources.
Slugs in woodward.json that have no matching shelter in the DB are skipped silently.

Usage:
    python3 scripts/import_woodward_sources.py
"""

import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / 'database' / 'gmc_shelters.sqlite'
WOODWARD_JSON = Path(__file__).parent.parent / 'woodward.json'

# NOT NULL TEXT columns in sources that map from nullable JSON fields.
# Python None becomes '' for these; year and quote can stay None (nullable in schema).
TEXT_FIELDS = (
    'type', 'author', 'title', 'container_title', 'editor', 'edition',
    'volume', 'issue', 'pages', 'publisher', 'place', 'date',
    'url', 'access_date', 'archive', 'archive_location',
)


def coerce(citation):
    """Return a dict safe for INSERT: None → '' for NOT NULL TEXT columns."""
    row = dict(citation)
    for field in TEXT_FIELDS:
        if row.get(field) is None:
            row[field] = ''
    return row


def main():
    data = json.loads(WOODWARD_JSON.read_text())

    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA foreign_keys = ON')

    with conn:
        # --- Clean slate ---
        conn.execute('DELETE FROM shelter_sources')
        conn.execute('DELETE FROM sources')

        # --- Build slug → shelter_id index ---
        slug_to_id = {
            row[0]: row[1]
            for row in conn.execute('SELECT slug, id FROM shelters')
        }

        inserted_sources = 0
        inserted_links = 0

        for slug, citations in data.items():
            shelter_id = slug_to_id.get(slug)
            if shelter_id is None:
                continue  # no matching shelter, skip silently

            for citation in citations:
                c = coerce(citation)

                cur = conn.execute(
                    '''
                    INSERT INTO sources (
                        type, author, title, container_title, editor, edition,
                        volume, issue, pages, publisher, place, year, date,
                        url, access_date, archive, archive_location,
                        created, updated, quote
                    ) VALUES (
                        :type, :author, :title, :container_title, :editor, :edition,
                        :volume, :issue, :pages, :publisher, :place, :year, :date,
                        :url, :access_date, :archive, :archive_location,
                        :created, :updated, :quote
                    )
                    ''',
                    c,
                )
                source_id = cur.lastrowid
                inserted_sources += 1

                conn.execute(
                    'INSERT INTO shelter_sources (shelter_id, source_id) VALUES (?, ?)',
                    (shelter_id, source_id),
                )
                inserted_links += 1

    print(f'Inserted {inserted_sources} sources, {inserted_links} shelter_sources links.')

    skipped = [slug for slug in data if slug not in slug_to_id]
    if skipped:
        print(f'Skipped {len(skipped)} unmatched slug(s): {", ".join(skipped)}')


if __name__ == '__main__':
    main()
