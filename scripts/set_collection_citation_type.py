#!/usr/bin/env python3
"""Set a collection's default citation_type in its metadata.yaml.

Only patches collections/<name>/metadata.yaml — never touches wiki/ output.
Already-converted files keep their existing citation type until an operator
edits and re-saves that file's header; only files added after this change
pick up the new default (see scripts/lib/wiki_convert.py's okf_header()).

Usage: python3 scripts/set_collection_citation_type.py <collection-name> <citation-type>
"""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib.wiki_convert import set_collection_citation_type


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: set_collection_citation_type.py <collection-name> <citation-type>', file=sys.stderr)
        sys.exit(1)
    collection_name, citation_type = sys.argv[1], sys.argv[2]
    set_collection_citation_type(REPO / 'collections' / collection_name, citation_type)


if __name__ == '__main__':
    main()
