from __future__ import annotations

import io
import json
import os
from pathlib import Path

from PIL import Image

from scripts.check_shelter_file_sizes import main


def _write_noise_image(path: Path, *, size: tuple[int, int] = (1024, 1024), quality: int = 95) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = os.urandom(size[0] * size[1] * 3)
    image = Image.frombytes("RGB", size, payload)
    image.save(path, format="JPEG", quality=quality)


def test_cli_json_summary_reports_dry_run_images_and_oversized_other_files(tmp_path: Path):
    shelters_root = tmp_path / "shelters"
    large_image_path = shelters_root / "beta-camp" / "gallery.jpg"
    oversized_binary_path = shelters_root / "beta-camp" / "archive.bin"

    _write_noise_image(large_image_path)
    oversized_binary_path.parent.mkdir(parents=True, exist_ok=True)
    oversized_binary_path.write_bytes(b"b" * 15_000)

    original_size = large_image_path.stat().st_size
    assert original_size > 10_000

    stdout = io.StringIO()
    stderr = io.StringIO()
    exit_code = main(
        [
            "--root",
            str(shelters_root),
            "--max-bytes",
            "10000",
            "--target-bytes",
            "9000",
            "--dry-run",
            "--format",
            "json",
        ],
        stdout=stdout,
        stderr=stderr,
    )

    payload = json.loads(stdout.getvalue())

    assert exit_code == 1
    assert payload["oversized_images"] == 1
    assert payload["dry_run_images"] == 1
    assert payload["resized_images"] == 0
    assert payload["oversized_other_files"] == 1
    assert payload["remaining_oversized_files"] == 2
    assert large_image_path.stat().st_size == original_size
    assert stderr.getvalue() == ""

