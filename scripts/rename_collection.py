#!/usr/bin/env python3
"""
Rename a collection folder and keep collections/ and wiki/ in sync.

A rename that only touches collections/ leaves wiki/<old>/ orphaned: its
resource: frontmatter still points at the pre-rename path, so every one of
its search results becomes a dead PDF link (see search-db skip guard in
build_wiki_index.py). This script renames both trees together and rewrites
frontmatter, so a rename can't fork into "collections renamed, wiki not"
again.

Usage:
  python3 scripts/rename_collection.py "<old-name>" "<new-name>"

Run scripts/build_wiki_index.py afterward to refresh the search index.
"""
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def rename_collection(repo: Path, old: str, new: str) -> dict:
    old_collections = repo / 'collections' / old
    new_collections = repo / 'collections' / new
    old_wiki = repo / 'wiki' / old
    new_wiki = repo / 'wiki' / new

    if not old_collections.exists():
        raise FileNotFoundError(f'collections/{old} not found')
    if new_collections.exists():
        raise FileExistsError(f'collections/{new} already exists')

    old_collections.rename(new_collections)

    wiki_migrated = old_wiki.exists()
    frontmatter_updated = 0
    if wiki_migrated:
        old_wiki.rename(new_wiki)
        for md in new_wiki.rglob('*.md'):
            text = md.read_text(encoding='utf-8')
            fixed = text.replace(f'collections/{old}/', f'collections/{new}/')
            if fixed != text:
                md.write_text(fixed, encoding='utf-8')
                frontmatter_updated += 1

    return {'wiki_migrated': wiki_migrated, 'frontmatter_updated': frontmatter_updated}


def main() -> None:
    if len(sys.argv) != 3:
        print('Usage: python3 scripts/rename_collection.py "<old-name>" "<new-name>"')
        sys.exit(1)
    old, new = sys.argv[1], sys.argv[2]
    result = rename_collection(REPO, old, new)
    print(f'collections/{old} -> collections/{new}')
    if result['wiki_migrated']:
        print(f'wiki/{old} -> wiki/{new} ({result["frontmatter_updated"]} file(s) had resource: frontmatter fixed)')
        print('Run scripts/build_wiki_index.py to refresh the search index.')
    else:
        print(f'no wiki/{old} to migrate — collection not yet converted, nothing else to do')


if __name__ == '__main__':
    main()
