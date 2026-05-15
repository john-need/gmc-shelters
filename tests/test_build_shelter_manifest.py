from __future__ import annotations

import json
import shutil
import sqlite3
import subprocess
from pathlib import Path

import pytest


SCRIPT_PATH = Path(__file__).resolve().parent.parent / "scripts" / "build-shelter-manifest.sh"


def _require_tool(name: str) -> None:
    if shutil.which(name) is None:
        pytest.skip(f"{name} is required for this test")


def _create_fixture_repo(root: Path) -> None:
    database_dir = root / "database"
    shelters_dir = root / "shelters" / "demo-shelter"
    database_dir.mkdir(parents=True)
    shelters_dir.mkdir(parents=True)

    shelters_dir.joinpath("demo-shelter.md").write_text(
        "Slug markdown body with **formatting**.\n",
        encoding="utf-8",
    )
    shelters_dir.joinpath("other.md").write_text(
        "This file should not be used.\n",
        encoding="utf-8",
    )
    shelters_dir.joinpath("photo.jpg").write_bytes(b"not-a-real-image")

    connection = sqlite3.connect(database_dir / "gmc_shelters.sqlite")
    connection.executescript(
        """
        CREATE TABLE shelters (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            start_year INTEGER,
            end_year INTEGER,
            slug TEXT NOT NULL,
            default_photo_id INTEGER,
            is_extant INTEGER NOT NULL,
            is_gmc INTEGER NOT NULL,
            description TEXT,
            show_on_web INTEGER NOT NULL
        );

        CREATE TABLE timelines (
            id INTEGER PRIMARY KEY,
            shelter_id INTEGER NOT NULL,
            year INTEGER,
            name TEXT,
            latitude REAL,
            longitude REAL,
            notes TEXT
        );

        CREATE TABLE photos (
            id INTEGER PRIMARY KEY,
            shelter_id INTEGER NOT NULL,
            include_in_post INTEGER NOT NULL,
            file_name TEXT,
            caption TEXT,
            photographer TEXT
        );
        """
    )
    connection.execute(
        """
        INSERT INTO shelters (
            id, name, latitude, longitude, start_year, end_year, slug,
            default_photo_id, is_extant, is_gmc, description, show_on_web
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            "Demo Shelter",
            44.1,
            -72.1,
            1900,
            0,
            "demo-shelter",
            None,
            1,
            1,
            None,
            1,
        ),
    )
    connection.execute(
        """
        INSERT INTO timelines (
            id, shelter_id, year, name, latitude, longitude, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            1,
            1910,
            "Demo Shelter",
            44.1,
            -72.1,
            "Timeline note",
        ),
    )
    connection.execute(
        """
        INSERT INTO photos (
            id, shelter_id, include_in_post, file_name, caption, photographer
        ) VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            1,
            1,
            1,
            "shelters/demo-shelter/photo.jpg",
            "Caption",
            "Photographer",
        ),
    )
    connection.commit()
    connection.close()


def test_build_manifest_uses_slug_markdown_for_content(tmp_path: Path) -> None:
    _require_tool("jq")
    _require_tool("pandoc")
    _require_tool("sqlite3")

    _create_fixture_repo(tmp_path)

    subprocess.run(
        ["bash", str(SCRIPT_PATH)],
        cwd=tmp_path,
        check=True,
        capture_output=True,
        text=True,
    )

    manifest = json.loads((tmp_path / "shelter-manifest.json").read_text(encoding="utf-8"))

    assert manifest["shelters"][0]["slug"] == "demo-shelter"
    assert manifest["shelters"][0]["content"].strip() == "Slug markdown body with formatting."
