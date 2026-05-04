#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
from pathlib import Path
from typing import Iterable
from urllib.parse import quote
from urllib.parse import urljoin, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup, Tag

USER_AGENT = "Mozilla/5.0 (compatible; gmc-shelter-scraper/1.0)"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape GMC shelter posts into markdown and image folders."
    )
    parser.add_argument(
        "--index-url",
        default="https://gmcburlington.org/shelters/",
        help="Web page containing links to shelter posts.",
    )
    parser.add_argument(
        "--post-urls",
        nargs="*",
        default=[],
        help="Optional explicit post URLs. If provided, index page link discovery is skipped.",
    )
    parser.add_argument(
        "--output-dir",
        default="gmc-website-content",
        help="Output folder root.",
    )
    parser.add_argument(
        "--max-posts",
        type=int,
        default=None,
        help="Optional limit for test runs.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=20,
        help="HTTP timeout in seconds.",
    )
    return parser.parse_args()


def normalize_url(raw_url: str) -> str:
    parsed = urlparse(raw_url)
    normalized = parsed._replace(query="", fragment="")
    return urlunparse(normalized)


def slug_from_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    if not path:
        return "home"
    return path.split("/")[0]


def get_soup(session: requests.Session, url: str, timeout: int) -> BeautifulSoup:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def site_origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def discover_post_links(session: requests.Session, index_url: str, timeout: int) -> list[str]:
    soup = get_soup(session, index_url, timeout)
    base_host = urlparse(index_url).netloc.lower()
    links: set[str] = set()

    for anchor in soup.select("a[href]"):
        href = anchor.get("href")
        if not href:
            continue

        absolute = normalize_url(urljoin(index_url, href))
        parsed = urlparse(absolute)

        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc.lower() != base_host:
            continue

        path = parsed.path.strip("/")
        if not path:
            continue

        # Keep simple post-style URLs: /slug/
        parts = [p for p in path.split("/") if p]
        if len(parts) != 1:
            continue

        slug = parts[0].lower()
        if re.match(r"^[a-z0-9-]+$", slug):
            links.add(absolute if absolute.endswith("/") else f"{absolute}/")

    return sorted(links)


def discover_post_links_via_api(session: requests.Session, index_url: str, timeout: int) -> list[str]:
    origin = site_origin(index_url)
    category_id = None

    # Try to scope to the shelters category if it exists.
    cat_url = f"{origin}/wp-json/wp/v2/categories?slug=shelters"
    cat_response = session.get(cat_url, timeout=timeout)
    if cat_response.ok:
        categories = cat_response.json()
        if categories:
            category_id = categories[0].get("id")

    links: set[str] = set()
    page = 1
    while True:
        posts_url = f"{origin}/wp-json/wp/v2/posts?per_page=100&page={page}&_fields=link,slug"
        if category_id is not None:
            posts_url += f"&categories={category_id}"

        resp = session.get(posts_url, timeout=timeout)
        if resp.status_code == 400:
            break
        resp.raise_for_status()

        posts = resp.json()
        if not posts:
            break

        for post in posts:
            link = normalize_url(post.get("link", ""))
            if not link:
                continue
            parsed = urlparse(link)
            parts = [p for p in parsed.path.strip("/").split("/") if p]
            if len(parts) == 1 and re.match(r"^[a-z0-9-]+$", parts[0]):
                links.add(link if link.endswith("/") else f"{link}/")

        page += 1

    return sorted(links)


def choose_content_root(soup: BeautifulSoup) -> Tag:
    selectors = [
        "article .entry-content",
        "article .post-content",
        "article",
        ".entry-content",
        "main",
    ]
    for selector in selectors:
        node = soup.select_one(selector)
        if isinstance(node, Tag):
            return node

    body = soup.body
    if isinstance(body, Tag):
        return body

    raise ValueError("Could not find page body.")


def content_to_markdown(content: Tag, title: str, source_url: str) -> str:
    lines = [f"# {title}", "", f"Source: {source_url}", ""]

    for elem in content.find_all(["h2", "h3", "h4", "p", "li", "blockquote"]):
        text = elem.get_text(" ", strip=True)
        if not text:
            continue

        if text in {"Index", "Next", "Previous"}:
            continue

        if elem.name in {"h2", "h3", "h4"}:
            hashes = "#" * int(elem.name[1])
            lines.append(f"{hashes} {text}")
            lines.append("")
        elif elem.name == "li":
            lines.append(f"- {text}")
        elif elem.name == "blockquote":
            lines.append(f"> {text}")
            lines.append("")
        else:
            lines.append(text)
            lines.append("")

    # Remove accidental trailing blank line spam.
    while lines and lines[-1] == "":
        lines.pop()

    return "\n".join(lines) + "\n"


def soup_from_html_fragment(html: str) -> Tag:
    soup = BeautifulSoup(html, "html.parser")
    container = soup.find("div")
    if isinstance(container, Tag):
        return container
    body = soup.body
    if isinstance(body, Tag):
        return body
    return soup


def unique_path(path: Path) -> Path:
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    i = 2
    while True:
        candidate = parent / f"{stem}-{i}{suffix}"
        if not candidate.exists():
            return candidate
        i += 1


def pick_image_url(img: Tag, post_url: str) -> str | None:
    # Prefer explicit src, then lazy-loading attributes, then srcset/data-srcset.
    for attr in ["src", "data-src"]:
        value = img.get(attr)
        if value:
            return urljoin(post_url, value)

    for attr in ["srcset", "data-srcset"]:
        srcset = img.get(attr)
        if not srcset:
            continue
        candidate = srcset.split(",")[-1].strip().split(" ")[0]
        if candidate:
            return urljoin(post_url, candidate)

    return None


def download_images(
    session: requests.Session,
    content: Tag,
    post_url: str,
    target_dir: Path,
    timeout: int,
    extra_urls: list[str] | None = None,
) -> int:
    seen: set[str] = set()

    def download_one(img_url: str) -> bool:
        if img_url in seen:
            return False
        seen.add(img_url)

        parsed = urlparse(img_url)
        name = Path(parsed.path).name
        if not name:
            return False

        out_path = unique_path(target_dir / name)

        try:
            response = session.get(img_url, timeout=timeout)
            response.raise_for_status()
            out_path.write_bytes(response.content)
            return True
        except requests.RequestException as exc:
            print(f"  ! Failed image: {img_url} ({exc})")
            return False

    count = 0
    for img in content.find_all("img"):
        img_url = pick_image_url(img, post_url)
        if not img_url or img_url.startswith("data:"):
            continue

        if download_one(img_url):
            count += 1

    for extra in extra_urls or []:
        if extra and download_one(extra):
            count += 1

    return count


def scrape_post(
    session: requests.Session,
    post_url: str,
    out_root: Path,
    timeout: int,
) -> tuple[Path, int]:
    slug = slug_from_url(post_url)
    post_dir = out_root / slug
    post_dir.mkdir(parents=True, exist_ok=True)

    origin = site_origin(post_url)
    api_url = f"{origin}/wp-json/wp/v2/posts?slug={quote(slug)}&_embed=1"
    api_resp = session.get(api_url, timeout=timeout)

    content: Tag
    image_content: Tag
    title: str
    extra_images: list[str] = []
    if api_resp.ok and api_resp.json():
        post = api_resp.json()[0]
        title_html = post.get("title", {}).get("rendered", "")
        title = BeautifulSoup(title_html, "html.parser").get_text(" ", strip=True) or slug

        content_html = post.get("content", {}).get("rendered", "")
        image_content = soup_from_html_fragment(content_html)

        excerpt_html = post.get("excerpt", {}).get("rendered", "")
        content = image_content
        if len(content.get_text(" ", strip=True).split()) < 20 and excerpt_html:
            content = soup_from_html_fragment(excerpt_html)

        featured = post.get("jetpack_featured_media_url")
        if isinstance(featured, str) and featured:
            extra_images.append(featured)
    else:
        # HTML fallback when WP JSON is unavailable.
        soup = get_soup(session, post_url, timeout)
        title_node = soup.find("h1")
        title = title_node.get_text(" ", strip=True) if title_node else slug.replace("-", " ").title()
        content = choose_content_root(soup)
        image_content = content
    markdown = content_to_markdown(content, title, post_url)

    md_path = post_dir / f"{slug}.md"
    md_path.write_text(markdown)

    image_count = download_images(session, image_content, post_url, post_dir, timeout, extra_urls=extra_images)
    return md_path, image_count


def run(post_urls: Iterable[str], out_root: Path, timeout: int) -> None:
    out_root.mkdir(parents=True, exist_ok=True)

    with requests.Session() as session:
        session.headers.update({"User-Agent": USER_AGENT})

        for url in post_urls:
            try:
                md_path, image_count = scrape_post(session, url, out_root, timeout)
                print(f"Saved: {md_path} (images: {image_count})")
            except requests.RequestException as exc:
                print(f"! Failed page: {url} ({exc})")
            except Exception as exc:  # Keep batch running on one-off page issues.
                print(f"! Failed parse: {url} ({exc})")


def main() -> None:
    args = parse_args()
    out_root = Path(args.output_dir).resolve()

    with requests.Session() as session:
        session.headers.update({"User-Agent": USER_AGENT})

        if args.post_urls:
            post_urls = [normalize_url(u) for u in args.post_urls]
        else:
            try:
                post_urls = discover_post_links(session, args.index_url, args.timeout)
            except requests.RequestException:
                post_urls = []

            if not post_urls:
                post_urls = discover_post_links_via_api(session, args.index_url, args.timeout)

    if args.max_posts is not None:
        post_urls = post_urls[: args.max_posts]

    print(f"Output folder: {out_root}")
    print(f"Posts to scrape: {len(post_urls)}")

    run(post_urls, out_root, args.timeout)


if __name__ == "__main__":
    main()

