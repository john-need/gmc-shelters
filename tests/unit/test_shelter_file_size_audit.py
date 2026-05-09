from __future__ import annotations

import os
from pathlib import Path

from PIL import Image

from scripts.lib.shelter_file_size_audit import audit_shelter_files


def _write_noise_image(path: Path, *, size: tuple[int, int] = (1024, 1024), quality: int = 95) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = os.urandom(size[0] * size[1] * 3)
    image = Image.frombytes("RGB", size, payload)
    image.save(path, format="JPEG", quality=quality)


def test_audit_resizes_large_images_and_reports_large_non_images(tmp_path: Path):
    shelters_root = tmp_path / "shelters"
    large_image_path = shelters_root / "alpha-camp" / "photo.jpg"
    oversized_note_path = shelters_root / "alpha-camp" / "notes.txt"

    _write_noise_image(large_image_path)
    oversized_note_path.parent.mkdir(parents=True, exist_ok=True)
    oversized_note_path.write_bytes(b"n" * 15_000)

    original_size = large_image_path.stat().st_size
    assert original_size > 10_000

    summary = audit_shelter_files(shelters_root, max_bytes=10_000, target_bytes=9_000)

    assert summary.scanned_files == 2
    assert summary.oversized_images == 1
    assert summary.resized_images == 1
    assert summary.oversized_other_files == 1
    assert large_image_path.stat().st_size <= 9_000
    assert any(item.relative_path.endswith("notes.txt") and item.action == "reported" for item in summary.items)

