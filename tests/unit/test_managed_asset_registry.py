from __future__ import annotations

from scripts.lib.managed_asset_registry import (
    choose_canonical_source_rel_path,
    inspect_source_image,
    normalize_source_rel_path,
)


def test_normalize_source_rel_path_returns_repo_relative_posix_path(fixture_repo):
    source_path = fixture_repo / "shelters" / "rerun-camp" / "duplicate-a.jpg"

    normalized = normalize_source_rel_path(fixture_repo, source_path)

    assert normalized == "shelters/rerun-camp/duplicate-a.jpg"


def test_inspect_source_image_reuses_sha_for_identical_content(fixture_repo):
    first = inspect_source_image(fixture_repo, fixture_repo / "shelters/rerun-camp/duplicate-a.jpg")
    second = inspect_source_image(fixture_repo, fixture_repo / "shelters/rerun-camp/duplicate-b.jpg")

    assert first.source_sha256 == second.source_sha256
    assert first.byte_size == second.byte_size


def test_canonical_source_path_preserves_first_successful_path():
    canonical = choose_canonical_source_rel_path(
        existing="shelters/rerun-camp/duplicate-a.jpg",
        candidate="shelters/rerun-camp/duplicate-b.jpg",
    )

    assert canonical == "shelters/rerun-camp/duplicate-a.jpg"

