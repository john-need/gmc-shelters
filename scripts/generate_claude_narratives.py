#!/usr/bin/env python3
"""Generate claude-{slug}.md shelter narratives.

Research sources (not cited in output):
  - {slug}.md / woodward-{slug}.md
  - database/gmc_shelters.sqlite

Fetches live GMC Burlington pages per shelter.
Output cites only real historical sources: guidebooks, LTN, URLs, named works.
"""
from __future__ import annotations
import argparse, difflib, re, sqlite3, time
from dataclasses import dataclass, field
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SHELTERS_DIR = PROJECT_ROOT / "shelters"
DATABASE_PATH = PROJECT_ROOT / "database" / "gmc_shelters.sqlite"
DEFAULT_REPORT_PATH = PROJECT_ROOT / "claude-narrative-error-report.md"
USER_AGENT = "Mozilla/5.0 (compatible; gmc-shelter-researcher/2.0)"
GMC_BASE = "https://gmcburlington.org"


# ── data classes ──────────────────────────────────────────────────────────────

@dataclass
class ShelterRecord:
    slug: str
    name: str | None
    start_year: int | None
    end_year: int | None
    latitude: float | None
    longitude: float | None
    description: str | None = None


@dataclass
class SourceDoc:
    path: Path
    title: str | None = None
    paragraphs: list[str] = field(default_factory=list)
    source_url: str | None = None
    source_items: list[str] = field(default_factory=list)
    bracket_citations: list[str] = field(default_factory=list)
    location_line: str | None = None
    is_woodward: bool = False
    has_prose: bool = False


# ── utilities ─────────────────────────────────────────────────────────────────

def normalize_ws(t: str) -> str:
    # Normalise curly quotes and common Unicode whitespace to ASCII equivalents
    t = t.replace("\u2019", "'").replace("\u2018", "'")
    t = t.replace("\u201c", '"').replace("\u201d", '"')
    t = t.replace("\u2013", "-").replace("\u2014", "--")
    return re.sub(r"\s+", " ", t.replace("\xa0", " ")).strip()

def title_from_slug(slug: str) -> str:
    return " ".join(w.capitalize() for w in slug.split("-"))

LT_LOC_RE   = re.compile(r"^LT\s+[Mm]ile\b", re.IGNORECASE)
SOURCE_URL_RE = re.compile(r"^[Ss]ource:\s*(https?://\S+)")
YEAR_RE     = re.compile(r"\b(1[789]\d{2}|20\d{2})\b")
NAV_LOWER   = {
    "skip to content", "become a member", "outings & events", "trip reports",
    "trail trivia", "ridgelines", "contact us",
    "green mountain club, burlington section",
}

def looks_like_source_line(t: str) -> bool:
    s = t.strip(); lo = s.lower()
    if not s: return False
    if s.startswith(("http://", "https://")): return True
    if len(s) < 250 and any(k in lo for k in (
        "long trail guide", "long trail news", "guidebook", "edition",
        "wikipedia", ".pdf", "newsletter", "o'kane", "trail guide",
    )): return True
    return False


# ── database ──────────────────────────────────────────────────────────────────

def load_records(db_path: Path) -> dict[str, ShelterRecord]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "select slug, name, start_year, end_year, latitude, longitude, description "
        "from shelters where slug is not null"
    ).fetchall()
    conn.close()
    return {
        str(r["slug"]): ShelterRecord(
            slug=str(r["slug"]), name=r["name"],
            start_year=r["start_year"], end_year=r["end_year"],
            latitude=r["latitude"], longitude=r["longitude"],
            description=r["description"],
        )
        for r in rows
    }


# ── file parsing ──────────────────────────────────────────────────────────────

def parse_doc(path: Path) -> SourceDoc:
    doc = SourceDoc(path=path)
    doc.is_woodward = path.stem.startswith("woodward-")
    text = path.read_text(encoding="utf-8", errors="ignore")
    body_lines: list[str] = []
    sources_mode = False

    for raw in text.splitlines():
        line = raw.rstrip()
        s = line.strip()
        if not s:
            body_lines.append("")
            continue
        m = SOURCE_URL_RE.match(s)
        if m:
            doc.source_url = m.group(1)
            continue
        if s.startswith("#"):
            heading = s.lstrip("#").strip()
            if doc.title is None and s.startswith("# "):
                doc.title = heading
            if heading.lower() in {"sources", "references"}:
                sources_mode = True
            continue
        if sources_mode:
            item = normalize_ws(s.lstrip("-* "))
            if item:
                doc.source_items.append(item)
            continue
        body_lines.append(line)

    paragraphs: list[str] = []
    current: list[str] = []
    for line in body_lines:
        s = line.strip()
        if not s:
            if current:
                paragraphs.append(normalize_ws(" ".join(current)))
                current = []
        elif LT_LOC_RE.match(s) and not paragraphs and not current:
            doc.location_line = s
        else:
            current.append(s)
    if current:
        paragraphs.append(normalize_ws(" ".join(current)))

    if not doc.is_woodward:
        while paragraphs and looks_like_source_line(paragraphs[-1]):
            doc.source_items.append(paragraphs.pop())

    seen: set[str] = set()
    for m2 in re.finditer(r"\[[^\]]+\]", text):
        if m2.end() < len(text) and text[m2.end()] == "(":
            continue
        c = normalize_ws(m2.group(0).strip("[]"))
        if c and c not in seen:
            seen.add(c)
            doc.bracket_citations.append(c)

    doc.paragraphs = [p for p in paragraphs if p]
    doc.has_prose = (
        sum(len(p) for p in doc.paragraphs) >= 400
        or (doc.title is not None and len(doc.paragraphs) > 0)
    )
    return doc


# ── web fetching ──────────────────────────────────────────────────────────────

_session: requests.Session | None = None

def get_session() -> requests.Session:
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update({"User-Agent": USER_AGENT})
    return _session

def fetch_web_paragraphs(slug: str, explicit_url: str | None = None, timeout: int = 15) -> list[str]:
    """Fetch a GMC Burlington shelter page and return its body paragraphs."""
    url = explicit_url or f"{GMC_BASE}/{slug}/"
    try:
        resp = get_session().get(url, timeout=timeout, allow_redirects=True)
        if not resp.ok:
            return []
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "header", "footer", "aside"]):
            tag.decompose()
        main = (
            soup.find("article")
            or soup.find("main")
            or soup.find("div", class_=re.compile(r"entry.content|post.content", re.I))
        )
        root = main or soup

        # Collect text from all <p> elements in document order
        raw_paras: list[str] = []
        for elem in root.find_all("p"):
            t = normalize_ws(elem.get_text(" ", strip=True))
            if t:
                raw_paras.append(t)

        # If no <p> tags, fall back to splitting on blank lines
        if not raw_paras:
            full = (root.get_text("\n", strip=True))
            for chunk in full.split("\n\n"):
                t = normalize_ws(chunk)
                if t:
                    raw_paras.append(t)

        # Filter out navigation, empty, citation-only, and duplicate items
        paras: list[str] = []
        seen: set[str] = set()
        for p in raw_paras:
            lo = p.lower()
            # Stop at pagination nav
            if any(nav in lo for nav in ("previous index next", "« previous", "next »")):
                break
            if any(nav in lo for nav in NAV_LOWER):
                continue
            # Skip citation / source lines (these belong in the Sources section)
            if looks_like_source_line(p):
                continue
            # Skip short captions (alt text, etc.)
            if len(p) < 40:
                continue
            key = p[:80]
            if key in seen:
                continue
            seen.add(key)
            paras.append(p)

        return paras
    except Exception:
        return []


# ── source document selection ─────────────────────────────────────────────────

def choose_docs(folder: Path, slug: str) -> tuple[SourceDoc | None, list[SourceDoc], list[str]]:
    notes: list[str] = []
    md_files = sorted(
        [p for p in folder.glob("*.md") if not p.name.startswith("claude-")],
        key=lambda p: p.name,
    )
    if not md_files:
        return None, [], ["No markdown history files found."]
    exact = folder / f"{slug}.md"
    if exact.exists():
        primary_path = exact
    else:
        def score(p: Path) -> tuple:
            bare = p.stem.removeprefix("woodward-")
            return (
                difflib.SequenceMatcher(None, slug, bare).ratio(),
                0 if p.stem.startswith("woodward-") else 1,
            )
        primary_path = max(md_files, key=score)
        notes.append(f"Used fallback primary source `{primary_path.name}`.")
    primary = parse_doc(primary_path)
    secondary = [parse_doc(p) for p in md_files if p != primary_path]
    if secondary:
        notes.append(
            "Supplemental notes: "
            + ", ".join(f"`{s.path.name}`" for s in secondary)
            + "."
        )
    return primary, secondary, notes


# ── display name ──────────────────────────────────────────────────────────────

def get_display_name(
    slug: str, record: ShelterRecord | None, primary: SourceDoc | None
) -> str:
    if record and record.name:
        return record.name.strip()
    if primary and primary.title:
        return primary.title.strip()
    return title_from_slug(slug)


# ── historical source filtering ───────────────────────────────────────────────

_SKIP_PATS = [
    re.compile(r"\.md$", re.I),
    re.compile(r"\.sqlite", re.I),
    re.compile(r"\bfolder source\b", re.I),
    re.compile(r"\bdatabase record\b", re.I),
    re.compile(r"\bno database row\b", re.I),
]

def is_historical_source(s: str) -> bool:
    if not s.strip():
        return False
    return not any(p.search(s) for p in _SKIP_PATS)

_CITE_MARKER_RE = re.compile(
    r"(?:The\s+)?Long Trail (?:Guide Book|Guide,|News)|O'Kane",
    re.IGNORECASE,
)

def split_mashed_citations(s: str) -> list[str]:
    """Break a string containing multiple concatenated citations."""
    positions = [m.start() for m in _CITE_MARKER_RE.finditer(s)]
    if not positions:
        return [normalize_ws(s)] if s.strip() else []
    parts: list[str] = []
    for i, pos in enumerate(positions):
        end = positions[i + 1] if i + 1 < len(positions) else len(s)
        chunk = normalize_ws(s[pos:end])
        if chunk:
            parts.append(chunk)
    return parts


def expand_source_items(items: list[str]) -> list[str]:
    """Expand any mashed citation strings into individual items."""
    result: list[str] = []
    for item in items:
        if len(item) > 80 and len(_CITE_MARKER_RE.findall(item)) > 1:
            result.extend(split_mashed_citations(item))
        else:
            result.append(item)
    return result


def collect_sources(
    docs: list[SourceDoc], extra_urls: list[str] | None = None
) -> list[str]:
    raw: list[str] = list(extra_urls or [])
    for doc in docs:
        if doc.source_url:
            raw.append(doc.source_url)
        raw.extend(expand_source_items(doc.source_items))
        raw.extend(doc.bracket_citations)
    seen: set[str] = set()
    result: list[str] = []
    for item in raw:
        s = normalize_ws(item)
        if s and s not in seen and is_historical_source(s):
            seen.add(s)
            result.append(s)
    return result


# ── narrative building ────────────────────────────────────────────────────────

def years_phrase(start: int | None, end: int | None) -> str:
    if start and end and end > 0:
        return f"from approximately {start} to {end}"
    if start:
        return f"from approximately {start}"
    if end and end > 0:
        return f"until approximately {end}"
    return "during a period not precisely documented"

def synthesize_woodward(docs: list[SourceDoc], display_name: str) -> str | None:
    wdocs = [d for d in docs if d.is_woodward and d.paragraphs]
    if not wdocs:
        return None
    years: list[int] = []
    for doc in wdocs:
        for para in doc.paragraphs:
            for m in YEAR_RE.finditer(para):
                years.append(int(m.group(1)))
    years = sorted(set(years))
    labels: list[str] = []
    for doc in wdocs:
        for cite in doc.bracket_citations:
            lo = cite.lower()
            if any(k in lo for k in ("gb", "guidebook", "guide book", "edition")) \
                    and "Long Trail Guide Book" not in labels:
                labels.append("Long Trail Guide Book")
            if any(k in lo for k in ("ltn", "long trail news")) \
                    and "Long Trail News" not in labels:
                labels.append("Long Trail News")
            if "o'kane" in lo and "O'Kane" not in labels:
                labels.append("O'Kane")
    if len(years) >= 2:
        span = f"between {years[0]} and {years[-1]}"
    elif years:
        span = f"as early as {years[0]}"
    else:
        span = "across multiple editions"
    if labels:
        plural = "s" if len(labels) > 1 else ""
        intro = f"The {' and '.join(labels)} document{plural} {display_name} {span}."
    else:
        intro = f"The guidebook record traces {display_name} {span}."
    parts: list[str] = []
    for doc in wdocs[:1]:
        for para in doc.paragraphs[:3]:
            cleaned = normalize_ws(re.sub(r"\[[^\]]+\]", "", para))
            if cleaned and len(cleaned) > 40:
                parts.append(cleaned)
                if len(" ".join(parts)) > 450:
                    break
    return (intro + " " + " ".join(parts)).strip() if parts else intro

def build_narrative(
    slug: str,
    record: ShelterRecord | None,
    primary: SourceDoc | None,
    secondary: list[SourceDoc],
    web_paragraphs: list[str],
) -> list[str]:
    display_name = get_display_name(slug, record, primary)
    paragraphs: list[str] = []

    if web_paragraphs:
        paragraphs.extend(web_paragraphs)
    elif primary and primary.paragraphs:
        paragraphs.extend(primary.paragraphs)
    else:
        if record:
            intro = (
                f"{display_name} was a shelter associated with Vermont's Long Trail, "
                f"active {years_phrase(record.start_year, record.end_year)}."
            )
            if record.description:
                intro += " " + normalize_ws(record.description)
            paragraphs.append(intro)
        else:
            paragraphs.append(
                f"{display_name} is recorded in the history of Vermont's Long Trail "
                f"shelter system. The surviving documentary evidence for this shelter "
                f"is limited."
            )

    all_wd = secondary + ([primary] if primary and primary.is_woodward else [])
    wp = synthesize_woodward(all_wd, display_name)
    # Only add woodward synthesis when the narrative is truly sparse (≤1 real paragraphs)
    if wp and not web_paragraphs and len(paragraphs) <= 1:
        if not (primary and primary.is_woodward):
            paragraphs.append(wp)

    seen: set[str] = set()
    result: list[str] = []
    for p in paragraphs:
        key = normalize_ws(p)[:120]
        if key not in seen:
            seen.add(key)
            result.append(p)
    return result


# ── rendering ─────────────────────────────────────────────────────────────────

def render(
    slug: str,
    record: ShelterRecord | None,
    primary: SourceDoc | None,
    secondary: list[SourceDoc],
    web_paragraphs: list[str],
    web_url: str | None,
) -> str:
    display_name = get_display_name(slug, record, primary)
    paragraphs = build_narrative(slug, record, primary, secondary, web_paragraphs)
    all_docs = ([primary] if primary else []) + secondary
    sources = collect_sources(all_docs, [web_url] if web_url else [])
    lines = [f"# {display_name}", "", "## Narrative history", ""]
    for para in paragraphs:
        lines.append(para)
        lines.append("")
    if sources:
        lines += ["## Sources", ""]
        for s in sources:
            lines.append(f"- {s}")
        lines.append("")
    return "\n".join(lines)


# ── argument parsing ──────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate shelter narratives citing only real historical sources."
    )
    p.add_argument("--slug", action="append", default=[])
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--report", default=str(DEFAULT_REPORT_PATH))
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--no-fetch", action="store_true", help="Skip live URL fetching.")
    p.add_argument("--delay", type=float, default=0.4)
    return p.parse_args()


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()
    report_path = Path(args.report).resolve()

    folders = sorted(
        [p for p in SHELTERS_DIR.iterdir() if p.is_dir() and not p.name.startswith(".")],
        key=lambda p: p.name,
    )
    if args.slug:
        wanted = set(args.slug)
        folders = [p for p in folders if p.name in wanted]
    if args.limit is not None:
        folders = folders[: args.limit]

    records = load_records(DATABASE_PATH)
    stats: dict[str, int] = {
        "processed": 0, "written": 0, "fetched_web": 0,
        "missing_db": 0, "fallback_primary": 0, "errors": 0,
    }
    report_entries: list[tuple[str, list[str]]] = []

    for folder in folders:
        slug = folder.name
        notes: list[str] = []
        stats["processed"] += 1
        output_path = folder / f"claude-{slug}.md"
        record = records.get(slug)
        if record is None:
            stats["missing_db"] += 1
            notes.append("No database row found for this slug.")

        try:
            primary, secondary, source_notes = choose_docs(folder, slug)
            notes.extend(source_notes)
            if any("fallback" in n.lower() for n in notes):
                stats["fallback_primary"] += 1

            web_paragraphs: list[str] = []
            web_url: str | None = None
            if not args.no_fetch:
                explicit = primary.source_url if primary else None
                web_paragraphs = fetch_web_paragraphs(slug, explicit_url=explicit)
                if web_paragraphs:
                    web_url = explicit or f"{GMC_BASE}/{slug}/"
                    stats["fetched_web"] += 1
                    notes.append(f"Fetched {len(web_paragraphs)} web paragraphs.")
                else:
                    notes.append("Web fetch returned nothing; using local files.")
                if args.delay > 0:
                    time.sleep(args.delay)

            rendered = render(slug, record, primary, secondary, web_paragraphs, web_url)

            if args.dry_run:
                print(f"[DRY-RUN] Would write {output_path}")
                if args.slug:
                    print(rendered)
            else:
                output_path.write_text(rendered, encoding="utf-8")
            stats["written"] += 1

        except Exception as exc:
            import traceback
            stats["errors"] += 1
            notes.append(f"Error: {exc}\n{traceback.format_exc()}")

        if notes:
            report_entries.append((slug, notes))

    lines = [
        "# Claude narrative generation report", "",
        f"- Mode: {'dry-run' if args.dry_run else 'apply'}",
    ]
    for k in ["processed", "written", "fetched_web", "missing_db", "fallback_primary", "errors"]:
        lines.append(f"- {k.replace('_', ' ').capitalize()}: {stats.get(k, 0)}")
    lines += ["", "## Per-shelter notes", ""]
    if report_entries:
        for s, ns in report_entries:
            lines.append(f"### {s}")
            lines.append("")
            for n in ns:
                lines.append(f"- {n}")
            lines.append("")
    else:
        lines.append("No issues or warnings recorded.")
    content = "\n".join(lines).rstrip() + "\n"
    if not args.dry_run:
        report_path.write_text(content, encoding="utf-8")
    else:
        print("\n--- REPORT ---\n" + content)


if __name__ == "__main__":
    main()
