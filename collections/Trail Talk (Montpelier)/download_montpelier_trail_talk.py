#!/usr/bin/env python3
"""
Download all Montpelier Section GMC Trail Talk newsletter PDFs.
Scrapes https://gmcmontpelier.org/archives/TrailTalk/index.htm at runtime,
so new issues are automatically picked up.

253 issues found spanning 1956–2026 (quarterly since ~2002; irregular earlier).

Run from Terminal:
  python3 "/Users/johnneed/Claude/Projects/GMC-ARCHIVES/montpelier-trail-talk/download_montpelier_trail_talk.py"
"""

import http.client
import ssl
import socket
import re
import os
import csv
import time
from urllib.parse import urlparse, urljoin

SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
ARCHIVE_ROOT = os.path.dirname(SCRIPT_DIR)
MANIFEST_PATH = os.path.join(ARCHIVE_ROOT, "manifest.csv")
MANIFEST_HEADER = ["collection", "publication", "year", "issue_or_edition",
                   "filename", "source_url", "notes"]

INDEX_URL = "https://gmcmontpelier.org/archives/TrailTalk/index.htm"
BASE_URL  = "https://gmcmontpelier.org"

GMC_HOST = "gmcmontpelier.org"
GMC_IP   = "173.236.143.175"   # resolved via Cloudflare DoH; bypasses system DNS

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")


def _open_conn(timeout=30):
    """
    Return an http.client.HTTPSConnection whose socket is already connected
    directly to GMC_IP — no DNS lookup ever happens.
    SSL still validates against GMC_HOST via SNI, so certs remain valid.
    """
    ctx      = ssl.create_default_context()
    raw_sock = socket.create_connection((GMC_IP, 443), timeout=timeout)
    ssl_sock = ctx.wrap_socket(raw_sock, server_hostname=GMC_HOST)
    conn     = http.client.HTTPSConnection(GMC_HOST)
    conn.sock = ssl_sock          # inject pre-connected socket; skips connect()
    return conn


def _gmc_request(path, accept="text/html,*/*", timeout=30):
    """GET path, follow up to 5 redirects. Returns (response, conn)."""
    url = f"https://{GMC_HOST}{path}"
    for _ in range(5):
        conn = _open_conn(timeout)
        conn.request("GET", path, headers={
            "Host":            GMC_HOST,
            "User-Agent":      UA,
            "Accept":          accept,
            "Accept-Language": "en-US,en;q=0.9",
            "Connection":      "close",
        })
        resp = conn.getresponse()
        if resp.status in (301, 302, 303, 307, 308):
            location = resp.getheader("Location", "")
            resp.read()
            conn.close()
            new_url = urljoin(url, location)
            path    = urlparse(new_url).path
            url     = new_url
            continue
        return resp, conn
    raise RuntimeError("Too many redirects")


def fetch(url):
    path = urlparse(url).path
    resp, conn = _gmc_request(path, accept="text/html,*/*")
    try:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        raw = resp.read()
        ct  = resp.getheader("Content-Type", "")
        enc = "utf-8"
        if "charset=" in ct:
            enc = ct.split("charset=")[-1].split(";")[0].strip()
        return raw.decode(enc, errors="replace")
    finally:
        conn.close()


def download_pdf(url, dest):
    if os.path.exists(dest):
        kb = os.path.getsize(dest) / 1024
        print(f"  [skip] {os.path.basename(dest)} ({kb:.0f} KB)")
        return True
    tmp  = dest + ".tmp"
    path = urlparse(url).path
    try:
        resp, conn = _gmc_request(path, accept="application/pdf,*/*", timeout=60)
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        with open(tmp, "wb") as f:
            while True:
                chunk = resp.read(256 * 1024)
                if not chunk:
                    break
                f.write(chunk)
        conn.close()
        if os.path.getsize(tmp) < 1024:
            raise RuntimeError("file too small")
        os.rename(tmp, dest)
        kb = os.path.getsize(dest) / 1024
        print(f"  OK  {os.path.basename(dest)} ({kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  FAIL {os.path.basename(dest)}: {e}")
        if os.path.exists(tmp):
            os.remove(tmp)
        return False


def parse_season(cell_text):
    """Normalise a table cell value to a clean season/month label."""
    t = re.sub(r'\s+', ' ', cell_text.strip())
    # Remove ' HiDef' suffix
    t = re.sub(r'\s*HiDef\s*', '', t, flags=re.IGNORECASE).strip()
    # If it's just a number, no season info in this cell — return ''
    if re.fullmatch(r'\d+', t):
        return ''
    # Strip leading issue number (e.g. "58March" → "March", "55March" → "March")
    t = re.sub(r'^\d+', '', t).strip()
    return t


def scrape_index():
    """
    Parse the index.htm table and return a list of
    (url, year, season, issue_num, local_filename).
    Falls back to plain href scanning if table parsing fails.
    """
    print(f"Fetching index: {INDEX_URL}")
    html = fetch(INDEX_URL)

    # ── Table-based extraction ─────────────────────────────────────────────────
    # The table has columns: Year | Spring | Summer | Fall | Winter
    # Each data cell contains either:
    #   - A plain number (issue number, no direct link text label)
    #   - A number + month text (e.g. "58March")
    #   - A dash or empty (no issue that season)
    # Links: <a href="/archives/TrailTalk/YYYY/NNN.pdf">NNN</a>
    seasons = ["Spring", "Summer", "Fall", "Winter"]
    issues  = []  # (url, year, season, issue_num, local_fname)
    seen_urls = set()

    # Find all <tr> rows in the table
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL | re.IGNORECASE)
    for row in rows:
        # Extract all <td> contents
        cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL | re.IGNORECASE)
        if not cells:
            continue
        # First cell should be the year
        year_text = re.sub(r'<[^>]+>', '', cells[0]).strip()
        if not re.fullmatch(r'19\d\d|20\d\d', year_text):
            continue
        year = year_text

        for i, season in enumerate(seasons):
            col_idx = i + 1
            if col_idx >= len(cells):
                continue
            cell_html = cells[col_idx]
            # Find any PDF links in this cell
            pdf_links = re.findall(
                r'href=["\']([^"\']+\.pdf)["\']', cell_html, re.IGNORECASE
            )
            for rel in pdf_links:
                # Resolve relative hrefs against the index page URL
                url = urljoin(INDEX_URL, rel)
                if url in seen_urls:
                    continue
                seen_urls.add(url)
                bname    = url.split("/")[-1]            # e.g. "157.pdf" or "1981_04.pdf"
                stem     = bname[:-4]                    # strip .pdf
                # Build a clean local filename
                local_fn = f"TrailTalk_{year}_{season}_{stem}.pdf"
                issues.append((url, year, season, stem, local_fn))

    # ── Fallback: plain href scan ──────────────────────────────────────────────
    if not issues:
        print("  (table parse found nothing — falling back to plain href scan)")
        all_pdfs = re.findall(
            r'href=["\']([^"\']+\.pdf)["\']', html, re.IGNORECASE
        )
        for rel in all_pdfs:
            url = urljoin(INDEX_URL, rel)
            if url in seen_urls:
                continue
            seen_urls.add(url)
            # Extract year from path
            m_year = re.search(r'/TrailTalk/(\d{4})/', url)
            year   = m_year.group(1) if m_year else "unknown"
            bname  = url.split("/")[-1]
            stem   = bname[:-4]
            issues.append((url, year, "", stem, f"TrailTalk_{year}_{stem}.pdf"))

    return issues


def append_to_manifest(new_entries):
    existing_rows = []
    if os.path.exists(MANIFEST_PATH):
        with open(MANIFEST_PATH, newline="", encoding="utf-8") as f:
            existing_rows = list(csv.reader(f))
    url_col = 5
    existing_urls = {r[url_col] for r in existing_rows[1:] if len(r) > url_col}
    to_add  = [e for e in new_entries if e.get("source_url", "") not in existing_urls]
    mode    = "a" if existing_rows else "w"
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
    os.makedirs(SCRIPT_DIR, exist_ok=True)
    print(f"Output folder: {SCRIPT_DIR}\n")

    issues = scrape_index()
    print(f"Found {len(issues)} unique Trail Talk PDFs spanning "
          f"{min(y for _,y,*_ in issues)}–{max(y for _,y,*_ in issues)}\n")

    entries = []
    failed  = []

    for url, year, season, stem, local_fn in issues:
        dest = os.path.join(SCRIPT_DIR, local_fn)
        ok   = download_pdf(url, dest)
        if ok:
            label = f"{season} {year}".strip() if season else f"Issue {stem} ({year})"
            entries.append({
                "collection":      "Montpelier Section GMC",
                "publication":     "Trail Talk",
                "year":            year,
                "issue_or_edition": label,
                "filename":        os.path.join("montpelier-trail-talk", local_fn),
                "source_url":      url,
                "notes":           "",
            })
        else:
            failed.append((local_fn, url))
        time.sleep(0.1)

    print(f"\nDownload complete: {len(entries)}/{len(issues)} succeeded.")
    if failed:
        print("Failed:")
        for fn, url in failed:
            print(f"  {fn}  {url}")

    append_to_manifest(entries)
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
