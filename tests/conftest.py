from __future__ import annotations

import io
import json
import sqlite3
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.lib.photo_db import apply_migrations, connect_db

FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"
MIGRATIONS_DIR = REPO_ROOT / "database" / "migrations"


class FakeWordPressMediaClient:
    def __init__(self, base_url: str, username: str, app_password: str, fail_auth: bool = False):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.app_password = app_password
        self.fail_auth = fail_auth
        self.upload_calls: list[dict] = []
        self.metadata_calls: list[dict] = []
        self._next_attachment_id = 9000

    def verify_auth(self) -> None:
        if self.fail_auth:
            raise RuntimeError("invalid-auth")

    def upload_media(self, file_path: Path, title: str | None = None, alt_text: str | None = None, caption: str | None = None) -> dict:
        self._next_attachment_id += 1
        attachment_id = self._next_attachment_id
        payload = {
            "id": attachment_id,
            "source_url": f"{self.base_url}/wp-content/uploads/{file_path.name}",
            "title": title,
            "alt_text": alt_text,
            "caption": caption,
        }
        self.upload_calls.append({"file_path": str(file_path), **payload})
        return payload

    def update_media_metadata(self, attachment_id: int, title: str | None = None, alt_text: str | None = None, caption: str | None = None) -> dict:
        payload = {
            "id": attachment_id,
            "title": title,
            "alt_text": alt_text,
            "caption": caption,
        }
        self.metadata_calls.append(payload)
        return payload


@pytest.fixture
def fixture_sql_path() -> Path:
    return FIXTURES_DIR / "photo_import_fixture.sql"


@pytest.fixture
def consumer_cases_path() -> Path:
    return FIXTURES_DIR / "shelter_gallery_consumer_cases.json"


@pytest.fixture
def fixture_repo(tmp_path: Path) -> Path:
    for rel_path, payload in {
        "shelters/alpha-camp/alpha-1.jpg": b"alpha-1",
        "shelters/alpha-camp/alpha-2.jpg": b"alpha-2",
        "shelters/beta-camp/beta-1.jpg": b"beta-1",
        "shelters/gamma-camp/gamma-default.jpg": b"gamma-default",
        "shelters/rerun-camp/duplicate-a.jpg": b"duplicate-content",
        "shelters/rerun-camp/duplicate-b.jpg": b"duplicate-content",
        "shelters/hidden-camp/hidden.jpg": b"hidden",
        "introduction/placeholder.jpg": b"placeholder",
    }.items():
        target = tmp_path / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(payload)

    manifest = tmp_path / "site-placeholder.json"
    manifest.write_text(
        json.dumps(
            {
                "source_rel_path": "introduction/placeholder.jpg",
                "published_image_url": "https://example.org/media/placeholder.jpg",
                "alt_text": "Shelter image unavailable",
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return tmp_path


@pytest.fixture
def raw_db_path(tmp_path: Path, fixture_sql_path: Path) -> Path:
    db_path = tmp_path / "fixture.sqlite"
    connection = sqlite3.connect(db_path)
    connection.executescript(fixture_sql_path.read_text(encoding="utf-8"))
    connection.commit()
    connection.close()
    return db_path


@pytest.fixture
def migrated_db_path(raw_db_path: Path) -> Path:
    connection = connect_db(raw_db_path)
    apply_migrations(connection, MIGRATIONS_DIR)
    connection.close()
    return raw_db_path


@pytest.fixture
def migrated_connection(migrated_db_path: Path):
    connection = connect_db(migrated_db_path)
    yield connection
    connection.close()


@pytest.fixture
def placeholder_manifest_path(fixture_repo: Path) -> Path:
    return fixture_repo / "site-placeholder.json"


@pytest.fixture
def fake_wordpress_client() -> FakeWordPressMediaClient:
    return FakeWordPressMediaClient("https://example.org", "user", "pass")


@pytest.fixture
def captured_streams() -> tuple[io.StringIO, io.StringIO]:
    return io.StringIO(), io.StringIO()


@pytest.fixture
def insert_uploaded_asset(migrated_connection):
    def _insert(photo_id: int, source_sha256: str, source_rel_path: str, wp_attachment_id: int, image_url: str, status: str = "uploaded", alt_text: str | None = None):
        cursor = migrated_connection.execute(
            """
            INSERT INTO photo_managed_assets (
                source_sha256,
                canonical_source_rel_path,
                mime_type,
                byte_size,
                wp_attachment_id,
                wp_media_url,
                title,
                alt_text,
                status,
                uploaded_at,
                last_verified_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                source_sha256,
                source_rel_path,
                "image/jpeg",
                10,
                wp_attachment_id,
                image_url,
                alt_text or Path(source_rel_path).stem,
                alt_text,
                status,
                "2026-05-05T00:00:00Z",
                "2026-05-05T00:00:00Z",
            ),
        )
        asset_id = cursor.lastrowid
        migrated_connection.execute(
            """
            INSERT INTO photo_asset_links (photo_id, asset_id, observed_source_rel_path, linked_at, last_verified_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                photo_id,
                asset_id,
                source_rel_path,
                "2026-05-05T00:00:00Z",
                "2026-05-05T00:00:00Z",
            ),
        )
        migrated_connection.commit()
        return asset_id

    return _insert

