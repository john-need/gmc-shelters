#!/usr/bin/env python3
"""
Download all available Stepping Stone newsletter PDFs from the Bennington Section GMC.

15 issues found (2020–2026). Three issues are NOT available as PDF downloads:
  - Winter 2019-2020: published as HTML only on the website
  - Autumn 2020:      broken link on site (points to wrong file)
  - Winter 2020-21:   embedded viewer (Issuu), no PDF available

Run from Terminal:
  python3 "/Users/johnneed/Claude/Projects/GMC-ARCHIVES/bennington-stepping-stone/download_stepping_stone.py"
"""

import subprocess
import os
import csv

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_ROOT = os.path.dirname(SCRIPT_DIR)
MANIFEST_PATH = os.path.join(ARCHIVE_ROOT, "manifest.csv")
MANIFEST_HEADER = ["collection", "publication", "year", "issue_or_edition",
                   "filename", "source_url", "notes"]

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

BASE = "https://www.benningtongmc.org/uploads/1/2/9/9/129930871/"

# (year, issue label, filename on server, local filename)
ISSUES = [
    ("2026", "Spring/Summer 2026",  "newsletterspring2026.pdf",        "SteppingStone_2026_SpringSummer.pdf"),
    ("2025", "Winter 2025-26",      "newsletterdecember2025best.pdf",   "SteppingStone_2025_Winter.pdf"),
    ("2025", "Fall 2025",           "newsletteraugust2025.pdf",         "SteppingStone_2025_Fall.pdf"),
    ("2025", "Spring/Summer 2025",  "newsletterapril2025finale.pdf",    "SteppingStone_2025_SpringSummer.pdf"),
    ("2024", "Winter 2024-25",      "newsletterdec2024onliner.pdf",     "SteppingStone_2024_Winter.pdf"),
    ("2024", "Autumn 2024",         "newsletterseptember2024online.pdf","SteppingStone_2024_Autumn.pdf"),
    ("2024", "Spring/Summer 2024",  "newsletterapril2024.pdf",          "SteppingStone_2024_SpringSummer.pdf"),
    ("2023", "Winter 2023-24",      "newsletterdec2023web2.pdf",        "SteppingStone_2023_Winter.pdf"),
    ("2023", "Autumn 2023",         "newsletterseptember2023.pdf",      "SteppingStone_2023_Autumn.pdf"),
    ("2023", "Spring/Summer 2023",  "newsletterapril2023web.pdf",       "SteppingStone_2023_SpringSummer.pdf"),
    ("2022", "Autumn 2022",         "newslettersep2022web.pdf",         "SteppingStone_2022_Autumn.pdf"),
    ("2022", "Spring/Summer 2022",  "newslettercolormar2022_2.pdf",     "SteppingStone_2022_SpringSummer.pdf"),
    ("2021", "Fall 2021",           "newslettersep2021.pdf",            "SteppingStone_2021_Fall.pdf"),
    ("2021", "Spring/Summer 2021",  "spring2021.pdf",                   "SteppingStone_2021_SpringSummer.pdf"),
    ("2020", "Spring/Summer 2020",  "springsummer2020.pdf",             "SteppingStone_2020_SpringSummer.pdf"),
]


def download_pdf(url, dest):
    if os.path.exists(dest):
        kb = os.path.getsize(dest) / 1024
        print(f"  [skip] {os.path.basename(dest)} ({kb:.0f} KB)")
        return True
    tmp = dest + ".tmp"
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "60",
             "-A", UA,
             "-H", "Accept: application/pdf,*/*",
             "-H", "Accept-Language: en-US,en;q=0.9",
             "-o", tmp, url],
            capture_output=True, timeout=120
        )
        if result.returncode != 0:
            raise RuntimeError(f"curl exit {result.returncode}: {result.stderr.decode()[:200]}")
        if not os.path.exists(tmp) or os.path.getsize(tmp) < 1024:
            raise RuntimeError("Downloaded file missing or too small")
        os.rename(tmp, dest)
        kb = os.path.getsize(dest) / 1024
        print(f"  OK  {os.path.basename(dest)} ({kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  FAIL {os.path.basename(dest)}: {e}")
        if os.path.exists(tmp):
            os.remove(tmp)
        return False


def append_to_manifest(new_entries):
    existing_rows = []
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, newline="", encoding="utf-8") as f:
            existing_rows = list(csv.reader(f))
    url_col = 5
    existing_urls = {r[url_col] for r in existing_rows[1:] if len(r) > url_col}
    to_add = [e for e in new_entries if e.get("source_url", "") not in existing_urls]
    mode = "a" if existing_rows else "w"
    with open(MANIFEST_PATH, mode, newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if not existing_rows:
            w.writerow(MANIFEST_HEADER)
        for e in to_add:
            w.writerow([e.get(k, "") for k in MANIFEST_HEADER])
    skipped = len(new_entries) - len(to_add)
    print(f"\n→ manifest: +{len(to_add)} new entries"
          + (f" ({skipped} already present)" if skipped else ""))


def main():
    print(f"Saving to: {SCRIPT_DIR}\n")
    entries = []
    failed = []

    for year, label, server_fname, local_fname in ISSUES:
        url = BASE + server_fname
        dest = os.path.join(SCRIPT_DIR, local_fname)
        ok = download_pdf(url, dest)
        if ok:
            entries.append({
                "collection": "Bennington Section GMC",
                "publication": "The Stepping Stone",
                "year": year,
                "issue_or_edition": label,
                "filename": os.path.join("bennington-stepping-stone", local_fname),
                "source_url": url,
                "notes": "",
            })
        else:
            failed.append((label, url))

    print(f"\nDownloaded: {len(entries)}/{len(ISSUES)}")
    if failed:
        print("Failed:")
        for label, url in failed:
            print(f"  {label}  {url}")

    print("\nNOTE: 3 issues have no PDF download available:")
    print("  - Winter 2019-2020: HTML only")
    print("  - Autumn 2020:      broken link on site")
    print("  - Winter 2020-21:   embedded viewer (Issuu), no PDF")

    append_to_manifest(entries)


if __name__ == "__main__":
    main()
