#!/usr/bin/env python3
"""Set a collection's default header fields in its metadata.yaml.

Only patches collections/<name>/metadata.yaml — never touches wiki/ output.
Cascading these defaults onto already-converted documents' OKF headers is
done separately by the caller (src/main/ipc/collections.ts); this script
only persists the collection-level defaults themselves. Already-converted
files keep their existing values until an operator (or the cascade) edits
them; only files added after this change pick up the new default for
title/publisher (see scripts/lib/wiki_convert.py's okf_header()).

Usage: python3 scripts/set_collection_defaults.py <collection-name> <json-fields>

<json-fields> is a JSON object with any of: citation_type, title, description,
language, author, publisher. `publisher` is stored under metadata.yaml's
existing `organization` key.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib.wiki_convert import set_collection_defaults

# Wire-format (JSON from Node) -> metadata.yaml key
_KEY_MAP = {
    'citation_type': 'citation_type',
    'title': 'title',
    'description': 'description',
    'language': 'language',
    'author': 'author',
    'publisher': 'organization',
}


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: set_collection_defaults.py <collection-name> <json-fields>', file=sys.stderr)
        sys.exit(1)
    collection_name, raw_fields = sys.argv[1], sys.argv[2]
    incoming: dict[str, str] = json.loads(raw_fields)
    fields = {_KEY_MAP[k]: v for k, v in incoming.items() if k in _KEY_MAP}
    set_collection_defaults(REPO / 'collections' / collection_name, fields)


if __name__ == '__main__':
    main()
