from __future__ import annotations

from pathlib import Path

import html2text
import markdown


def _md_to_plain(text: str) -> str:
    html = markdown.markdown(text)
    converter = html2text.HTML2Text()
    converter.ignore_links = True
    converter.ignore_images = True
    converter.ignore_emphasis = True
    converter.body_width = 0  # no line wrapping (matches pandoc --wrap=none)
    return converter.handle(html).strip()


def load_shelter_content(slug: str, shelters_dir: Path) -> str:
    """Read the shelter's markdown file and return as plain text. Empty string if missing."""
    content_file = shelters_dir / slug / f"{slug}.md"
    if not content_file.exists():
        return ""
    return _md_to_plain(content_file.read_text(encoding="utf-8"))


def convert_description(description: str | None) -> str:
    """Convert a markdown description string to plain text."""
    if not description:
        return ""
    return _md_to_plain(description)
