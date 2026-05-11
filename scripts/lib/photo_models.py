from __future__ import annotations

from dataclasses import asdict, dataclass, field


@dataclass(slots=True)
class CandidatePhoto:
    photo_id: int
    shelter_id: int
    shelter_slug: str
    shelter_name: str
    file_name: str
    caption: str | None
    photographer: str | None
    default_photo_id: int | None


@dataclass(slots=True)
class GallerySlide:
    photo_id: int | None
    wp_attachment_id: int | None
    image_url: str
    alt_text: str | None
    caption: str | None
    credit: str | None
    is_fallback: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class ImportItemResult:
    photo_id: int
    shelter_slug: str
    source_rel_path: str
    source_sha256: str | None
    outcome: str
    wp_attachment_id: int | None
    reason: str | None = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass(slots=True)
class ImportSummary:
    run_id: int | None
    mode: str
    target_base_url: str
    requested: int
    uploaded: int
    skipped: int
    failed: int
    items: list[ImportItemResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "mode": self.mode,
            "target_base_url": self.target_base_url,
            "requested": self.requested,
            "uploaded": self.uploaded,
            "skipped": self.skipped,
            "failed": self.failed,
            "items": [item.to_dict() for item in self.items],
        }


@dataclass(slots=True)
class SourceImageInfo:
    source_rel_path: str
    source_sha256: str
    mime_type: str
    byte_size: int
    absolute_path: str

