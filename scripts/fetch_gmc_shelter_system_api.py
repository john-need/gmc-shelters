#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "https://gmcburlington.org"
CATEGORY_NAME = "GMC Shelter System"
USER_AGENT = "Mozilla/5.0 (compatible; gmc-wp-api-scraper/1.0)"


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif", ".svg", ".bmp", ".tif", ".tiff"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export posts from WordPress category 'GMC Shelter System' into slug folders."
    )
    parser.add_argument(
        "--base-url",
        default=BASE_URL,
        help="WordPress site base URL.",
    )
    parser.add_argument(
        "--category-name",
        default=CATEGORY_NAME,
        help="WordPress category name to export.",
    )
    parser.add_argument(
        "--output-dir",
        default="gmc-website-content",
        help="Directory where slug folders will be created.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="HTTP timeout in seconds.",
    )
    parser.add_argument(
        "--max-posts",
        type=int,
        default=None,
        help="Optional cap for test runs.",
    )
    return parser.parse_args()


def normalize_base_url(url: str) -> str:
    return url.rstrip("/")


def safe_slug(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "post"


def resolve_category_id(session: requests.Session, base_url: str, category_name: str, timeout: int) -> int:
    categories_url = f"{base_url}/wp-json/wp/v2/categories"
    page = 1
    matches = []

    while True:
        resp = session.get(categories_url, params={"per_page": 100, "page": page}, timeout=timeout)
        if resp.status_code == 400:
            break
        resp.raise_for_status()
        categories = resp.json()
        if not categories:
            break

        for cat in categories:
            if str(cat.get("name", "")).strip().lower() == category_name.strip().lower():
                matches.append(cat)

        page += 1

    if not matches:
        raise ValueError(f"Category not found: {category_name}")

    # Use the first exact match deterministically.
    return int(matches[0]["id"])


def fetch_posts_in_category(
    session: requests.Session,
    base_url: str,
    category_id: int,
    timeout: int,
    max_posts: int | None,
) -> list[dict]:
    posts_url = f"{base_url}/wp-json/wp/v2/posts"
    posts: list[dict] = []
    page = 1

    while True:
        params = {
            "categories": category_id,
            "per_page": 100,
            "page": page,
            "_embed": 1,
        }
        resp = session.get(posts_url, params=params, timeout=timeout)
        if resp.status_code == 400:
            break
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break

        posts.extend(batch)
        if max_posts is not None and len(posts) >= max_posts:
            posts = posts[:max_posts]
            break

        page += 1

    return posts


def choose_image_url(img: Tag) -> str | None:
    for attr in ["src", "data-src"]:
        value = img.get(attr)
        if value:
            return value

    for attr in ["srcset", "data-srcset"]:
        srcset = img.get(attr)
        if not srcset:
            continue
        candidate = srcset.split(",")[-1].strip().split(" ")[0]
        if candidate:
            return candidate

    return None


def image_name_from_url(url: str) -> str | None:
    path = urlparse(url).path
    name = Path(path).name
    if not name:
        return None
    if Path(name).suffix.lower() in IMAGE_EXTENSIONS:
        return name
    return None


def unique_file_path(path: Path) -> Path:
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    i = 2
    while True:
        candidate = path.with_name(f"{stem}-{i}{suffix}")
        if not candidate.exists():
            return candidate
        i += 1


def html_to_markdown(title: str, source_url: str, html: str) -> str:
    content = BeautifulSoup(html or "", "html.parser")
    lines = [f"# {title}", "", f"Source: {source_url}", ""]

    nav_tokens = {
        "index",
        "previous",
        "next",
        "next »",
        "« previous",
    }

    for elem in content.find_all(["h2", "h3", "h4", "p", "li", "blockquote"]):
        text = elem.get_text(" ", strip=True)
        if not text:
            continue
        if text.lower() in nav_tokens:
            continue

        if elem.name in {"h2", "h3", "h4"}:
            heading_level = int(elem.name[1])
            lines.append(f"{'#' * heading_level} {text}")
            lines.append("")
        elif elem.name == "li":
            lines.append(f"- {text}")
        elif elem.name == "blockquote":
            lines.append(f"> {text}")
            lines.append("")
        else:
            lines.append(text)
            lines.append("")

    while lines and lines[-1] == "":
        lines.pop()

    return "\n".join(lines) + "\n"


def collect_image_urls(post: dict) -> list[str]:
    urls: list[str] = []
    content_html = post.get("content", {}).get("rendered", "")
    soup = BeautifulSoup(content_html or "", "html.parser")

    for img in soup.find_all("img"):
        img_url = choose_image_url(img)
        if img_url:
            urls.append(img_url)

    featured = post.get("jetpack_featured_media_url")
    if isinstance(featured, str) and featured:
        urls.append(featured)

    embedded = post.get("_embedded", {})
    media_list = embedded.get("wp:featuredmedia", []) if isinstance(embedded, dict) else []
    for media in media_list:
        if isinstance(media, dict):
            src = media.get("source_url")
            if isinstance(src, str) and src:
                urls.append(src)

    # Deduplicate while preserving order.
    seen = set()
    out = []
    for url in urls:
        if url not in seen:
            seen.add(url)
            out.append(url)
    return out


def download_images(
    session: requests.Session,
    image_urls: Iterable[str],
    target_dir: Path,
    timeout: int,
) -> tuple[int, int]:
    saved = 0
    failed = 0

    for image_url in image_urls:
        name = image_name_from_url(image_url)
        if not name:
            continue

        out_path = unique_file_path(target_dir / name)

        try:
            resp = session.get(image_url, timeout=timeout)
            resp.raise_for_status()
            out_path.write_bytes(resp.content)
            saved += 1
        except requests.RequestException:
            failed += 1

    return saved, failed


def export_posts(
    session: requests.Session,
    posts: list[dict],
    output_dir: Path,
    timeout: int,
) -> tuple[int, int, int]:
    folder_count = 0
    md_count = 0
    image_count = 0

    output_dir.mkdir(parents=True, exist_ok=True)

    for post in posts:
        slug = safe_slug(str(post.get("slug", "")))
        post_dir = output_dir / slug
        post_dir.mkdir(parents=True, exist_ok=True)
        folder_count += 1

        title_html = post.get("title", {}).get("rendered", "")
        title = BeautifulSoup(title_html, "html.parser").get_text(" ", strip=True) or slug
        source_url = str(post.get("link", "")).strip() or f"{BASE_URL}/{slug}/"
        content_html = post.get("content", {}).get("rendered", "")

        markdown = html_to_markdown(title, source_url, content_html)
        md_path = post_dir / f"{slug}.md"
        md_path.write_text(markdown)
        md_count += 1

        image_urls = collect_image_urls(post)
        saved, failed = download_images(session, image_urls, post_dir, timeout)
        image_count += saved

        print(f"Saved: {md_path} (images: {saved}, failed: {failed})")

    return folder_count, md_count, image_count


def main() -> None:
    args = parse_args()
    base_url = normalize_base_url(args.base_url)
    output_dir = Path(args.output_dir).resolve()

    with requests.Session() as session:
        session.headers.update({"User-Agent": USER_AGENT})

        category_id = 69
        posts = fetch_posts_in_category(
            session,
            base_url,
            category_id,
            args.timeout,
            args.max_posts,
        )

        print(f"Base URL: {base_url}")
        print(f"Category: {args.category_name} (id={category_id})")
        print(f"Posts found: {len(posts)}")
        print(f"Output folder: {output_dir}")

        folders, markdown_files, images = export_posts(session, posts, output_dir, args.timeout)

    print("---")
    print(f"Folders created/updated: {folders}")
    print(f"Markdown files written: {markdown_files}")
    print(f"Images downloaded: {images}")


if __name__ == "__main__":
    main()

