#!/usr/bin/env python3
"""Print per-collection add/clean status as JSON (consumed by the app's
Collections Management screen). Logic in scripts/lib/collection_status.py."""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from scripts.lib import collection_status


def main() -> None:
    print(json.dumps(collection_status.scan(REPO)))


if __name__ == '__main__':
    main()
