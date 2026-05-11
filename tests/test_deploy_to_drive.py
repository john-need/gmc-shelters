"""Tests for scripts/deploy_to_drive.py — TDD approach.

Run per user story:
  pytest tests/test_deploy_to_drive.py -k "us1" -v
  pytest tests/test_deploy_to_drive.py -k "us2" -v
  pytest tests/test_deploy_to_drive.py -k "us3" -v
"""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, call, patch

import pytest
from googleapiclient.errors import HttpError

import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from deploy_to_drive import (
    build_drive_file_index,
    get_or_create_subfolder,
    normalise_filename,
    process_shelter,
    update_or_create_manifest,
    upload_photo,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_http_error(status: int = 429) -> HttpError:
    resp = MagicMock()
    resp.status = status
    resp.reason = "Too Many Requests"
    return HttpError(resp=resp, content=b"rate limit")


def _shelter(slug: str, photos: list[dict]) -> dict:
    return {"id": 1, "name": slug.title(), "slug": slug, "photos": photos}


def _photo(file_name: str, drive_id: str | None = None) -> dict:
    return {
        "id": 100,
        "fileName": file_name,
        "driveFileId": drive_id,
        "caption": "test",
        "photographer": None,
    }


# ---------------------------------------------------------------------------
# US1 — Initial Deploy
# ---------------------------------------------------------------------------

class TestUs1InitialDeploy:
    def test_upload_photo_calls_files_create(self, mock_drive_service, tmp_path):
        """T007: upload_photo calls files().create() with correct name and parents."""
        local_file = tmp_path / "gmc-shelters_test-shelter_img.jpg"
        local_file.write_bytes(b"fake image data")
        mock_drive_service.files.return_value.create.return_value.execute.return_value = {
            "id": "new-drive-id"
        }

        result = upload_photo(mock_drive_service, local_file, "folder-123")

        create_call = mock_drive_service.files.return_value.create
        assert create_call.called
        call_kwargs = create_call.call_args.kwargs
        assert call_kwargs["body"]["name"] == local_file.name
        assert "folder-123" in call_kwargs["body"]["parents"]
        assert result == "new-drive-id"

    def test_process_shelter_sets_drive_file_id(
        self, mock_drive_service, tmp_path
    ):
        """T008: process_shelter sets driveFileId on photo entry after upload."""
        slug = "aeolus-view-camp"
        bare = "gmc-shelters_aeolus-view-camp_img.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare).write_bytes(b"img")

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }
        mock_drive_service.files.return_value.create.return_value.execute.return_value = {
            "id": "uploaded-id"
        }

        shelter = _shelter(slug, [_photo(bare)])
        root_index: dict = {}
        process_shelter(mock_drive_service, shelter, "root-id", tmp_path, root_index)

        assert shelter["photos"][0]["driveFileId"] == "uploaded-id"

    def test_normalise_filename_strips_path_prefix(self):
        """T009: normalise_filename strips leading path components."""
        assert (
            normalise_filename("shelters/aeolus-view-camp/img.jpg") == "img.jpg"
        )
        assert normalise_filename("img.jpg") == "img.jpg"
        assert (
            normalise_filename("shelters/slug/nested/deep.png") == "deep.png"
        )

    def test_update_or_create_manifest_calls_update_when_exists(
        self, mock_drive_service, tmp_path
    ):
        """T010: update_or_create_manifest calls files().update() when manifest already on Drive."""
        manifest_path = tmp_path / "shelter-manifest.json"
        manifest_path.write_text('{"shelters": []}')

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": [{"id": "existing-manifest-id", "name": "shelter-manifest.json"}]
        }

        update_or_create_manifest(mock_drive_service, "root-folder-id", manifest_path)

        update_call = mock_drive_service.files.return_value.update
        assert update_call.called
        assert update_call.call_args.kwargs["fileId"] == "existing-manifest-id"
        mock_drive_service.files.return_value.create.assert_not_called()

    def test_build_drive_file_index_returns_name_id_dict(self, mock_drive_service):
        """build_drive_file_index returns {name: id} mapping."""
        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": [
                {"id": "id-1", "name": "photo1.jpg"},
                {"id": "id-2", "name": "photo2.png"},
            ]
        }

        index = build_drive_file_index(mock_drive_service, "folder-id")

        assert index == {"photo1.jpg": "id-1", "photo2.png": "id-2"}

    def test_update_or_create_manifest_calls_create_when_not_exists(
        self, mock_drive_service, tmp_path
    ):
        """update_or_create_manifest calls files().create() when manifest not yet on Drive."""
        manifest_path = tmp_path / "shelter-manifest.json"
        manifest_path.write_text('{"shelters": []}')

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }
        mock_drive_service.files.return_value.create.return_value.execute.return_value = {
            "id": "new-manifest-id"
        }

        update_or_create_manifest(mock_drive_service, "root-folder-id", manifest_path)

        create_call = mock_drive_service.files.return_value.create
        assert create_call.called
        mock_drive_service.files.return_value.update.assert_not_called()

    def test_process_shelter_normalises_filename(self, mock_drive_service, tmp_path):
        """process_shelter writes bare filename back to photo entry."""
        slug = "test-shelter"
        bare = "gmc-shelters_test-shelter_img.jpg"
        path_prefixed = f"shelters/{slug}/{bare}"

        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare).write_bytes(b"img")

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }
        mock_drive_service.files.return_value.create.return_value.execute.return_value = {
            "id": "some-id"
        }

        shelter = _shelter(slug, [_photo(path_prefixed)])
        process_shelter(mock_drive_service, shelter, "root", tmp_path, {})

        assert shelter["photos"][0]["fileName"] == bare


# ---------------------------------------------------------------------------
# US2 — Idempotent Re-deploy
# ---------------------------------------------------------------------------

class TestUs2IdempotentRedeploy:
    def test_existing_photo_skipped_not_reuploaded(
        self, mock_drive_service, tmp_path
    ):
        """T018: If photo already in Drive index, files().create() is NOT called."""
        slug = "battell-shelter"
        bare = "gmc-shelters_battell-shelter_img.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare).write_bytes(b"img")

        # Subfolder list returns the photo as already existing
        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": [{"id": "existing-photo-id", "name": bare}]
        }

        shelter = _shelter(slug, [_photo(bare)])
        root_index = {slug: "subfolder-id"}
        stats = process_shelter(
            mock_drive_service, shelter, "root-id", tmp_path, root_index
        )

        mock_drive_service.files.return_value.create.assert_not_called()
        assert stats["skipped"] == 1
        assert stats["uploaded"] == 0

    def test_existing_file_id_resolved_from_drive_index(
        self, mock_drive_service, tmp_path
    ):
        """T019: process_shelter resolves driveFileId from existing Drive index entry."""
        slug = "bear-hollow"
        bare = "gmc-shelters_bear-hollow_img.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare).write_bytes(b"img")

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": [{"id": "pre-existing-id", "name": bare}]
        }

        shelter = _shelter(slug, [_photo(bare)])
        root_index = {slug: "subfolder-id"}
        process_shelter(mock_drive_service, shelter, "root-id", tmp_path, root_index)

        assert shelter["photos"][0]["driveFileId"] == "pre-existing-id"

    def test_subfolder_not_recreated_if_exists(self, mock_drive_service):
        """T020: get_or_create_subfolder does NOT call files().create() when slug in root_index."""
        root_index = {"my-shelter": "existing-folder-id"}
        result = get_or_create_subfolder(
            mock_drive_service, "root-id", "my-shelter", root_index
        )

        mock_drive_service.files.return_value.create.assert_not_called()
        assert result == "existing-folder-id"

    def test_second_run_zero_uploads(self, mock_drive_service, tmp_path):
        """Full shelter processed twice: second run stats show uploaded=0."""
        slug = "birch-glen"
        bare = "gmc-shelters_birch-glen_img.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare).write_bytes(b"img")

        # First run: file not on Drive yet
        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }
        mock_drive_service.files.return_value.create.return_value.execute.return_value = {
            "id": "uploaded-id"
        }
        shelter = _shelter(slug, [_photo(bare)])
        root_index: dict = {}
        stats1 = process_shelter(
            mock_drive_service, shelter, "root-id", tmp_path, root_index
        )
        assert stats1["uploaded"] == 1

        # Second run: file now appears in Drive index
        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": [{"id": "uploaded-id", "name": bare}]
        }
        mock_drive_service.files.return_value.create.reset_mock()
        stats2 = process_shelter(
            mock_drive_service, shelter, "root-id", tmp_path, {slug: "subfolder-id"}
        )
        assert stats2["uploaded"] == 0
        assert stats2["skipped"] == 1
        mock_drive_service.files.return_value.create.assert_not_called()


# ---------------------------------------------------------------------------
# US3 — Error Recovery
# ---------------------------------------------------------------------------

class TestUs3ErrorRecovery:
    def test_http_error_on_upload_does_not_abort(
        self, mock_drive_service, tmp_path
    ):
        """T024: HttpError on first photo upload does not stop second photo."""
        slug = "bigelow"
        bare1 = "gmc-shelters_bigelow_img1.jpg"
        bare2 = "gmc-shelters_bigelow_img2.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare1).write_bytes(b"img1")
        (shelter_dist / bare2).write_bytes(b"img2")

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }
        # First create raises HttpError; second succeeds
        mock_drive_service.files.return_value.create.return_value.execute.side_effect = [
            _make_http_error(500),
            {"id": "ok-id"},
        ]

        shelter = _shelter(slug, [_photo(bare1), _photo(bare2)])
        # Pre-populate root_index so get_or_create_subfolder skips files().create()
        root_index = {slug: "subfolder-id"}
        stats = process_shelter(
            mock_drive_service, shelter, "root-id", tmp_path, root_index
        )

        assert stats["failed"] == 1
        assert stats["uploaded"] == 1

    def test_missing_local_file_is_skipped_with_warning(
        self, mock_drive_service, tmp_path
    ):
        """T025: Photo entry with no local file increments missing_local; no Drive call."""
        slug = "bamforth-ridge"
        bare = "gmc-shelters_bamforth-ridge_missing.jpg"

        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }

        shelter = _shelter(slug, [_photo(bare)])
        root_index = {slug: "subfolder-id"}
        stats = process_shelter(
            mock_drive_service, shelter, "root-id", tmp_path, root_index
        )

        mock_drive_service.files.return_value.create.assert_not_called()
        assert stats["missing_local"] == 1

    def test_partial_deploy_resumes_correctly(self, mock_drive_service, tmp_path):
        """T026: 3-photo shelter where 2 are already on Drive — exactly 1 uploaded."""
        slug = "barnes-camp"
        bare1 = "gmc-shelters_barnes-camp_img1.jpg"
        bare2 = "gmc-shelters_barnes-camp_img2.jpg"
        bare3 = "gmc-shelters_barnes-camp_img3.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        for name in [bare1, bare2, bare3]:
            (shelter_dist / name).write_bytes(b"img")

        # 2 of 3 photos already on Drive
        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": [
                {"id": "id-1", "name": bare1},
                {"id": "id-2", "name": bare2},
            ]
        }
        mock_drive_service.files.return_value.create.return_value.execute.return_value = {
            "id": "id-3"
        }

        shelter = _shelter(slug, [_photo(bare1), _photo(bare2), _photo(bare3)])
        root_index = {slug: "subfolder-id"}
        stats = process_shelter(
            mock_drive_service, shelter, "root-id", tmp_path, root_index
        )

        assert stats["uploaded"] == 1
        assert stats["skipped"] == 2
        for photo in shelter["photos"]:
            assert photo["driveFileId"] is not None

    def test_failed_upload_preserves_existing_drive_id(
        self, mock_drive_service, tmp_path
    ):
        """T027 invariant: HttpError does not wipe a pre-existing driveFileId."""
        slug = "atlas-valley"
        bare = "gmc-shelters_atlas-valley_img.jpg"
        shelter_dist = tmp_path / slug
        shelter_dist.mkdir()
        (shelter_dist / bare).write_bytes(b"img")

        # File not in Drive index (so upload will be attempted)
        mock_drive_service.files.return_value.list.return_value.execute.return_value = {
            "files": []
        }
        mock_drive_service.files.return_value.create.return_value.execute.side_effect = (
            _make_http_error(500)
        )

        prior_id = "prior-successful-deploy-id"
        shelter = _shelter(slug, [_photo(bare, drive_id=prior_id)])
        # Pre-populate root_index so get_or_create_subfolder skips files().create()
        root_index = {slug: "subfolder-id"}
        process_shelter(mock_drive_service, shelter, "root-id", tmp_path, root_index)

        # Prior driveFileId must be preserved, not wiped to None
        assert shelter["photos"][0]["driveFileId"] == prior_id
