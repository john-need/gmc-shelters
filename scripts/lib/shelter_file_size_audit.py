from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict, dataclass, field
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

DEFAULT_MAX_BYTES = 50_000_000
DEFAULT_TARGET_BYTES = 49_000_000
KNOWN_IMAGE_SUFFIXES = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".avif",
    ".svg",
    ".heic",
    ".heif",
}
SAVEABLE_FORMATS = {"JPEG", "PNG", "WEBP", "TIFF", "BMP", "GIF"}
LOSSY_FORMATS = {"JPEG", "WEBP"}

try:
    RESAMPLING_LANCZOS = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover
    RESAMPLING_LANCZOS = Image.LANCZOS


@dataclass(slots=True)
class AuditItem:
    relative_path: str
    kind: str
    original_size: int
    final_size: int
    action: str
    message: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class AuditSummary:
    root: str
    scanned_files: int = 0
    oversized_images: int = 0
    resized_images: int = 0
    dry_run_images: int = 0
    oversized_other_files: int = 0
    failed_images: int = 0
    remaining_oversized_files: int = 0
    items: list[AuditItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "root": self.root,
            "scanned_files": self.scanned_files,
            "oversized_images": self.oversized_images,
            "resized_images": self.resized_images,
            "dry_run_images": self.dry_run_images,
            "oversized_other_files": self.oversized_other_files,
            "failed_images": self.failed_images,
            "remaining_oversized_files": self.remaining_oversized_files,
            "items": [item.to_dict() for item in self.items],
        }


@dataclass(slots=True)
class ResizeResult:
    success: bool
    final_size: int
    message: str | None = None


@dataclass(slots=True)
class ImageDescriptor:
    is_image: bool
    is_resizable: bool
    format_name: str | None
    message: str | None = None


def audit_shelter_files(
    root: Path | str,
    *,
    max_bytes: int = DEFAULT_MAX_BYTES,
    target_bytes: int = DEFAULT_TARGET_BYTES,
    dry_run: bool = False,
) -> AuditSummary:
    root_path = Path(root).resolve()
    if not root_path.exists():
        raise ValueError(f"Shelter root does not exist: {root_path}")
    if not root_path.is_dir():
        raise ValueError(f"Shelter root is not a directory: {root_path}")
    if target_bytes <= 0:
        raise ValueError("target_bytes must be positive")
    if max_bytes <= target_bytes:
        raise ValueError("max_bytes must be greater than target_bytes")

    summary = AuditSummary(root=str(root_path))
    for file_path in sorted(path for path in root_path.rglob("*") if path.is_file()):
        summary.scanned_files += 1
        original_size = file_path.stat().st_size
        if original_size <= max_bytes:
            continue

        relative_path = file_path.relative_to(root_path).as_posix()
        descriptor = describe_image(file_path)
        if descriptor.is_image:
            summary.oversized_images += 1
            if dry_run:
                summary.dry_run_images += 1
                summary.remaining_oversized_files += 1
                summary.items.append(
                    AuditItem(
                        relative_path=relative_path,
                        kind="image",
                        original_size=original_size,
                        final_size=original_size,
                        action="would-resize",
                        message=descriptor.message,
                    )
                )
                continue

            if not descriptor.is_resizable:
                summary.failed_images += 1
                summary.remaining_oversized_files += 1
                summary.items.append(
                    AuditItem(
                        relative_path=relative_path,
                        kind="image",
                        original_size=original_size,
                        final_size=original_size,
                        action="failed",
                        message=descriptor.message or "image format is not resizable by this script",
                    )
                )
                continue

            result = resize_image_to_target(file_path, descriptor.format_name or "JPEG", target_bytes)
            if result.success:
                summary.resized_images += 1
                summary.items.append(
                    AuditItem(
                        relative_path=relative_path,
                        kind="image",
                        original_size=original_size,
                        final_size=result.final_size,
                        action="resized",
                        message=result.message,
                    )
                )
            else:
                summary.failed_images += 1
                summary.remaining_oversized_files += 1
                summary.items.append(
                    AuditItem(
                        relative_path=relative_path,
                        kind="image",
                        original_size=original_size,
                        final_size=result.final_size,
                        action="failed",
                        message=result.message,
                    )
                )
            continue

        summary.oversized_other_files += 1
        summary.remaining_oversized_files += 1
        summary.items.append(
            AuditItem(
                relative_path=relative_path,
                kind="non-image",
                original_size=original_size,
                final_size=original_size,
                action="reported",
                message="non-image file exceeds max size",
            )
        )

    return summary


def describe_image(file_path: Path) -> ImageDescriptor:
    try:
        with Image.open(file_path) as image:
            format_name = (image.format or "").upper() or None
            if getattr(image, "is_animated", False) and getattr(image, "n_frames", 1) > 1:
                return ImageDescriptor(True, False, format_name, "animated images are report-only")
            if format_name in SAVEABLE_FORMATS:
                return ImageDescriptor(True, True, format_name)
            return ImageDescriptor(True, False, format_name, f"unsupported image format: {format_name or 'unknown'}")
    except (UnidentifiedImageError, OSError):
        if file_path.suffix.lower() in KNOWN_IMAGE_SUFFIXES:
            return ImageDescriptor(True, False, None, "unsupported image format")
        return ImageDescriptor(False, False, None)


def resize_image_to_target(file_path: Path, format_name: str, target_bytes: int) -> ResizeResult:
    try:
        with Image.open(file_path) as source_image:
            base_image = ImageOps.exif_transpose(source_image).copy()
    except (UnidentifiedImageError, OSError) as exc:
        return ResizeResult(False, file_path.stat().st_size, str(exc))

    for scale_factor in _scale_factors():
        candidate_image = _resize_image(base_image, scale_factor)
        for save_kwargs in _save_option_sets(format_name):
            result = _write_candidate(file_path, candidate_image, format_name, save_kwargs, target_bytes)
            if result.success:
                return result

    return ResizeResult(False, file_path.stat().st_size, f"unable to reduce {file_path.name} below {target_bytes} bytes")


def format_audit_summary(summary: AuditSummary, output_format: str = "human") -> str:
    if output_format == "json":
        return json.dumps(summary.to_dict(), indent=2) + "\n"

    lines = [
        f"Scanned {summary.scanned_files} files under {summary.root}",
        f"Resized images: {summary.resized_images}",
        f"Dry-run oversized images: {summary.dry_run_images}",
        f"Oversized non-image files: {summary.oversized_other_files}",
        f"Failed image resizes: {summary.failed_images}",
        f"Remaining oversized files: {summary.remaining_oversized_files}",
    ]

    if summary.items:
        lines.append("")
        lines.append("Oversized file actions:")
        for item in summary.items:
            lines.append(
                "- "
                f"{item.action} {item.kind} {item.relative_path} "
                f"({_format_mb(item.original_size)} -> {_format_mb(item.final_size)})"
                + (f": {item.message}" if item.message else "")
            )

    return "\n".join(lines) + "\n"


def _scale_factors() -> tuple[float, ...]:
    return (1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1)


def _resize_image(image: Image.Image, scale_factor: float) -> Image.Image:
    if scale_factor >= 0.999:
        return image.copy()
    width = max(1, int(image.width * scale_factor))
    height = max(1, int(image.height * scale_factor))
    return image.resize((width, height), RESAMPLING_LANCZOS)


def _save_option_sets(format_name: str) -> list[dict]:
    if format_name == "JPEG":
        return [{"quality": quality, "optimize": True, "progressive": True} for quality in (85, 75, 65, 55, 45, 35)]
    if format_name == "WEBP":
        return [{"quality": quality, "method": 6} for quality in (85, 75, 65, 55, 45, 35)]
    if format_name == "PNG":
        return [{"optimize": True, "compress_level": 9}]
    if format_name == "TIFF":
        return [{"compression": "tiff_adobe_deflate"}, {}]
    if format_name == "GIF":
        return [{"optimize": True}]
    return [{}]


def _write_candidate(file_path: Path, image: Image.Image, format_name: str, save_kwargs: dict, target_bytes: int) -> ResizeResult:
    temp_path = _temporary_output_path(file_path)
    prepared = _prepare_image_for_format(image, format_name)
    try:
        prepared.save(temp_path, format=format_name, **save_kwargs)
        final_size = temp_path.stat().st_size
        if final_size <= target_bytes:
            os.replace(temp_path, file_path)
            return ResizeResult(True, final_size)
        temp_path.unlink(missing_ok=True)
        return ResizeResult(False, final_size)
    except OSError as exc:
        temp_path.unlink(missing_ok=True)
        return ResizeResult(False, file_path.stat().st_size, str(exc))
    finally:
        prepared.close()


def _prepare_image_for_format(image: Image.Image, format_name: str) -> Image.Image:
    candidate = image.copy()
    if format_name == "JPEG":
        if candidate.mode in {"RGBA", "LA"}:
            background = Image.new("RGB", candidate.size, (255, 255, 255))
            alpha = candidate.getchannel("A")
            background.paste(candidate.convert("RGBA"), mask=alpha)
            candidate.close()
            return background
        if candidate.mode not in {"RGB", "L"}:
            converted = candidate.convert("RGB")
            candidate.close()
            return converted
        return candidate
    if format_name == "GIF":
        converted = candidate.convert("P")
        candidate.close()
        return converted
    return candidate


def _temporary_output_path(file_path: Path) -> Path:
    handle, temp_name = tempfile.mkstemp(prefix=f"{file_path.stem}.", suffix=file_path.suffix, dir=file_path.parent)
    os.close(handle)
    return Path(temp_name)


def _format_mb(size_bytes: int) -> str:
    return f"{size_bytes / 1_000_000:.2f}MB"

