#!/usr/bin/env python3
"""
Download Long Trail Guidebooks (Editions 1–23) from the GMC Montpelier Section archive.
Run this script from your Mac Terminal:  python3 download_guides.py
Files are saved in the same directory as this script.
"""

import http.client
import ssl
import socket
import os
import sys

GMC_HOST = "gmcmontpelier.org"
GMC_IP   = "173.236.143.175"  # resolved via Cloudflare DoH; bypasses system DNS

BASE = "https://gmcmontpelier.org/Archive_Publications/LongTrailGuides/"

GUIDES = [
    ("01", "1917", "LTG_1917/LTG1917.pdf"),
    ("02", "1920", "LTG_1920/LTG1920.pdf"),
    ("03", "1921", "LTG_1921/LTG1921.pdf"),
    ("04", "1922", "LTG_1922/LTG1922.pdf"),
    ("05", "1924", "LTG_1924_FifthEd/LTG1924_Fifth.pdf"),
    ("06", "1924", "LTG_1924_SixthEd/LTG1924_Sixth.pdf"),
    ("07", "1928", "LTG_1928/LTG1928.pdf"),
    ("08", "1930", "LTG_1930/LTG1930.pdf"),
    ("09", "1932", "LTG_1932/LTG1932.pdf"),
    ("10", "1935", "LTG_1935/LTG1935.pdf"),
    ("11", "1937", "LTG_1937/LTG1937.pdf"),
    ("12", "1940", "LTG_1940/LTG1940.pdf"),
    ("13", "1947", "LTG_1947/LTG1947.pdf"),
    ("14", "1951", "LTG_1951/LTG1951.pdf"),
    ("15", "1956", "LTG_1956/LTG1956.pdf"),
    ("16", "1960", "LTG_1960/LTG1960.pdf"),
    ("17", "1963", "LTG_1963/LTG1963.pdf"),
    ("18", "1966", "LTG_1966/LTG1966.pdf"),
    ("19", "1968", "LTG_1968/LTG1968.pdf"),
    ("20", "1971", "LTG_1971/LTG1971.pdf"),
    ("21", "1977", "LTG_1977/LTG1977.pdf"),
    ("22", "1983", "LTG_1983/LTG1983.pdf"),
    ("23", "1985", "LTG_1985/LTG1985.pdf"),
]

script_dir = os.path.dirname(os.path.abspath(__file__))

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36"

def _open_conn(timeout=180):
    ctx      = ssl.create_default_context()
    raw_sock = socket.create_connection((GMC_IP, 443), timeout=timeout)
    ssl_sock = ctx.wrap_socket(raw_sock, server_hostname=GMC_HOST)
    conn     = http.client.HTTPSConnection(GMC_HOST)
    conn.sock = ssl_sock
    return conn

def download(edition, year, path):
    http_path = "/Archive_Publications/LongTrailGuides/" + path
    filename  = f"LongTrailGuide_Ed{edition}_{year}.pdf"
    dest      = os.path.join(script_dir, filename)
    if os.path.exists(dest):
        print(f"  [skip] {filename} already exists")
        return True
    print(f"  Downloading Edition {edition} ({year})...", end=" ", flush=True)
    tmp = dest + ".tmp"
    try:
        conn = _open_conn()
        conn.request("GET", http_path, headers={
            "Host": GMC_HOST, "User-Agent": UA,
            "Accept": "application/pdf,*/*", "Connection": "close",
        })
        resp = conn.getresponse()
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
        size_mb = os.path.getsize(dest) / 1_048_576
        print(f"done ({size_mb:.1f} MB)")
        return True
    except Exception as e:
        print(f"FAILED: {e}")
        if os.path.exists(tmp):
            os.remove(tmp)
        return False

print(f"Saving to: {script_dir}\n")
failed = []
for edition, year, path in GUIDES:
    ok = download(edition, year, path)
    if not ok:
        failed.append(f"Edition {edition} ({year})")

print(f"\nDone. {len(GUIDES) - len(failed)}/{len(GUIDES)} files downloaded.")
if failed:
    print("Failed:", ", ".join(failed))
