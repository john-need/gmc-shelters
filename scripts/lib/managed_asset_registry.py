from __future__ import annotations

import hashlib
import mimetypes
from pathlib import Path

from scripts.lib.photo_models import SourceImageInfo


class SourceImageError(RuntimeError):
    pass


def normalize_source_rel_path(repo_root: Path, source_path: Path | str) -> str:
    root = Path(repo_root).resolve()
    candidate = Path(source_path).resolve()
    try:
        relative = candidate.relative_to(root)
    except ValueError as exc:
        raise SourceImageError(f"source path is outside repo root: {candidate}") from exc
    return relative.as_posix()


def choose_canonical_source_rel_path(existing: str | None, candidate: str) -> str:
    return existing or candidate


def inspect_source_image(repo_root: Path, source_path: Path | str) -> SourceImageInfo:
    absolute_path = Path(source_path).resolve()
    if not absolute_path.exists() or not absolute_path.is_file():
        raise SourceImageError(f"missing source image: {absolute_path}")

    source_rel_path = normalize_source_rel_path(Path(repo_root), absolute_path)
    payload = absolute_path.read_bytes()
    mime_type = mimetypes.guess_type(absolute_path.name)[0] or "application/octet-stream"
    return SourceImageInfo(
        source_rel_path=source_rel_path,
        source_sha256=hashlib.sha256(payload).hexdigest(),
        mime_type=mime_type,
        byte_size=len(payload),
        absolute_path=str(absolute_path),
    )


def resolve_repo_file(repo_root: Path, source_rel_path: str) -> Path:
    return (Path(repo_root) / source_rel_path).resolve()

