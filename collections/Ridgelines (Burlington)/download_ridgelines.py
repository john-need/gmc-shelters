#!/usr/bin/env python3
"""
Download RidgeLines newsletter PDFs from the Burlington Section of the GMC.
Fetches the full post list via the WordPress REST API, extracts PDF links,
and downloads each issue.

Run from your Mac Terminal:  python3 download_ridgelines.py
Files are saved in the same directory as this script.

Also writes ridgelines_manifest.csv alongside the PDFs.
"""

import urllib.request
import urllib.parse
import urllib.error
import json
import re
import os
import csv
import time

BASE_URL = "https://gmcburlington.org"
API_BASE = f"{BASE_URL}/wp-json/wp/v2/posts"
FIELDS = "id,slug,title,date,content"
PER_PAGE = 100

script_dir = os.path.dirname(os.path.abspath(__file__))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Referer": "https://gmcburlington.org/ridgelines/",
}


def fetch_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        # Detect encoding from Content-Type header, fall back to utf-8
        ct = r.headers.get("Content-Type", "")
        charset = "utf-8"
        if "charset=" in ct:
            charset = ct.split("charset=")[-1].split(";")[0].strip()
        return json.loads(raw.decode(charset, errors="replace"))


def fetch_all_posts():
    """Page through the WP REST API and return all posts."""
    posts = []
    page = 1
    while True:
        url = f"{API_BASE}?per_page={PER_PAGE}&page={page}&_fields={FIELDS}"
        try:
            batch = fetch_json(url)
        except urllib.error.HTTPError as e:
            if e.code == 400:
                break  # past last page
            raise
        if not batch:
            break
        posts.extend(batch)
        print(f"  Fetched page {page} ({len(batch)} posts, {len(posts)} total so far)")
        if len(batch) < PER_PAGE:
            break
        page += 1
        time.sleep(0.3)  # be polite
    return posts


def extract_pdf_links(html_content):
    """Return all PDF URLs found in rendered post content."""
    # Match href or src pointing to a .pdf
    return re.findall(r'https?://[^"\'<>\s]+\.pdf', html_content, re.IGNORECASE)


def is_ridgelines_post(post):
    slug = post.get("slug", "")
    title = post.get("title", {}).get("rendered", "")
    return (
        "ridgeline" in slug.lower()
        or "ridgeline" in title.lower()
    )


def clean_title(raw):
    """Strip HTML tags from a WP rendered title."""
    return re.sub(r"<[^>]+>", "", raw).strip()


def safe_filename(title, url):
    """
    Build a safe filename from the post title.
    Falls back to the URL basename.
    """
    name = clean_title(title)
    # Remove or replace characters that are problematic in filenames
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", "_", name)
    # Ensure it ends in .pdf
    if not name.lower().endswith(".pdf"):
        name = name + ".pdf"
    return name


PDF_HEADERS = {k: v for k, v in HEADERS.items() if k != "Accept-Encoding"}
PDF_HEADERS["Accept"] = "application/pdf,*/*"

def download_pdf(url, dest_path):
    if os.path.exists(dest_path):
        size = os.path.getsize(dest_path) / 1024
        print(f"  [skip] {os.path.basename(dest_path)} ({size:.0f} KB)")
        return True
    tmp = dest_path + ".tmp"
    try:
        req = urllib.request.Request(url, headers=PDF_HEADERS)
        with urllib.request.urlopen(req, timeout=60) as r:
            total = int(r.headers.get("Content-Length", 0))
            downloaded = 0
            with open(tmp, "wb") as f:
                while True:
                    chunk = r.read(256 * 1024)  # 256 KB chunks
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
            os.rename(tmp, dest_path)
        size_kb = os.path.getsize(dest_path) / 1024
        print(f"  OK  {os.path.basename(dest_path)} ({size_kb:.0f} KB)")
        return True
    except Exception as e:
        print(f"  FAIL {os.path.basename(dest_path)}: {e}")
        if os.path.exists(tmp):
            os.remove(tmp)
        return False


def main():
    print(f"Saving to: {script_dir}\n")

    print("Fetching post list from gmcburlington.org...")
    all_posts = fetch_all_posts()
    print(f"Total posts fetched: {len(all_posts)}\n")

    # Filter to RidgeLines posts and collect PDF URLs
    seen_urls = set()
    entries = []  # list of (title, date, pdf_url, filename)

    for post in all_posts:
        if not is_ridgelines_post(post):
            continue
        content = post.get("content", {}).get("rendered", "")
        title = clean_title(post.get("title", {}).get("rendered", ""))
        date = post.get("date", "")[:10]  # YYYY-MM-DD
        pdfs = extract_pdf_links(content)
        for pdf_url in pdfs:
            if pdf_url in seen_urls:
                continue
            seen_urls.add(pdf_url)
            # Use the post title for the filename
            fname = safe_filename(title, pdf_url)
            entries.append((title, date, pdf_url, fname))

    print(f"Found {len(entries)} unique RidgeLines PDFs.\n")

    # Sort by date
    entries.sort(key=lambda x: x[1])

    # Download
    print("Downloading PDFs...")
    failed = []
    for title, date, url, fname in entries:
        dest = os.path.join(script_dir, fname)
        ok = download_pdf(url, dest)
        if not ok:
            failed.append((title, url))

    print(f"\nDownload complete: {len(entries) - len(failed)}/{len(entries)} succeeded.")
    if failed:
        print("Failed:")
        for t, u in failed:
            print(f"  {t}  {u}")

    # Write local manifest CSV
    manifest_path = os.path.join(script_dir, "ridgelines_manifest.csv")
    with open(manifest_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["collection", "publication", "year", "issue_or_edition",
                    "filename", "source_url", "notes"])
        for title, date, url, fname in entries:
            year = date[:4] if date else ""
            w.writerow([
                "Burlington Section GMC",
                "RidgeLines",
                year,
                title,
                fname,
                url,
                "",
            ])
    print(f"Local manifest written: {manifest_path}")

    # Append to master manifest one level up
    master_manifest = os.path.join(script_dir, "..", "manifest.csv")
    master_manifest = os.path.normpath(master_manifest)
    if os.path.exists(master_manifest):
        # Remove any existing RidgeLines rows first to avoid duplicates
        with open(master_manifest, "r", newline="", encoding="utf-8") as f:
            rows = list(csv.reader(f))
        header = rows[0]
        # Keep header + non-RidgeLines rows
        kept = [r for r in rows[1:] if not (len(r) > 1 and r[1] == "RidgeLines")]
        with open(master_manifest, "w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(kept)
            for title, date, url, fname in entries:
                year = date[:4] if date else ""
                w.writerow([
                    "Burlington Section GMC",
                    "RidgeLines",
                    year,
                    title,
                    fname,
                    url,
                    "",
                ])
        print(f"Master manifest updated: {master_manifest}")
    else:
        print(f"(Master manifest not found at {master_manifest} — skipping)")


if __name__ == "__main__":
    main()
