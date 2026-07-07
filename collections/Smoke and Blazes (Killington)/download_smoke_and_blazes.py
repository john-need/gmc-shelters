#!/usr/bin/env python3
"""
Download Smoke & Blazes newsletter PDFs from the Internet Archive.
Smoke & Blazes is the newsletter of the Killington Section of the Green Mountain Club.
Donated to the Rutland Historical Society by Bob Perkins; scanned 2015-2016.

Run from your Mac Terminal:  python3 download_smoke_and_blazes.py
Files are saved in the same directory as this script.
"""

import urllib.request
import os

FILES = [
    {
        "url": "https://archive.org/download/SmokeAndBlazes_201605/Smoke%20and%20Blazes.pdf",
        "filename": "Smoke_and_Blazes_1948-2016.pdf",
        "description": "Complete run 1948–2016 (499 MB)",
    },
    {
        "url": "https://archive.org/download/smokeandblazes201319/Smoke%20and%20Blazes-2013-20.pdf",
        "filename": "Smoke_and_Blazes_2013-2020.pdf",
        "description": "Supplement 2013–2020 (46 MB)",
    },
]

script_dir = os.path.dirname(os.path.abspath(__file__))

def download(entry):
    url = entry["url"]
    filename = entry["filename"]
    dest = os.path.join(script_dir, filename)
    if os.path.exists(dest):
        print(f"  [skip] {filename} already exists")
        return True
    print(f"  Downloading {filename} ({entry['description']})...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=300) as r:
            total = int(r.headers.get("Content-Length", 0))
            downloaded = 0
            with open(dest, "wb") as f:
                while True:
                    chunk = r.read(1024 * 1024)  # 1 MB chunks
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded / total * 100
                        print(f"    {downloaded/1_048_576:.1f} / {total/1_048_576:.1f} MB ({pct:.0f}%)", end="\r")
        size_mb = os.path.getsize(dest) / 1_048_576
        print(f"\n  Done: {filename} ({size_mb:.1f} MB)")
        return True
    except Exception as e:
        print(f"\n  FAILED: {e}")
        if os.path.exists(dest):
            os.remove(dest)
        return False

print(f"Saving to: {script_dir}\n")
failed = []
for f in FILES:
    if not download(f):
        failed.append(f["filename"])

print(f"\nDone. {len(FILES) - len(failed)}/{len(FILES)} files downloaded.")
if failed:
    print("Failed:", ", ".join(failed))
