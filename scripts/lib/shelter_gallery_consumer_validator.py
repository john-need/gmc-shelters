from __future__ import annotations


def validate_gallery_payload(payload: dict) -> None:
    if payload.get("fallback_mode") not in {"gallery", "default-image", "site-placeholder"}:
        raise ValueError("invalid fallback_mode")

    slides = payload.get("slides")
    if not isinstance(slides, list) or not slides:
        raise ValueError("slides must be a non-empty list")

    navigation_enabled = bool(payload.get("navigation_enabled"))
    if payload["fallback_mode"] == "gallery" and navigation_enabled != (len(slides) > 1):
        raise ValueError("gallery navigation mismatch")
    if payload["fallback_mode"] != "gallery" and navigation_enabled:
        raise ValueError("fallback payload must disable navigation")

    for slide in slides:
        for key in ["photo_id", "wp_attachment_id", "image_url", "alt_text", "caption", "credit", "is_fallback"]:
            if key not in slide:
                raise ValueError(f"missing slide key: {key}")

    if payload["fallback_mode"] == "gallery" and any(slide["is_fallback"] for slide in slides):
        raise ValueError("gallery payload cannot contain fallback slides")
    if payload["fallback_mode"] != "gallery" and not all(slide["is_fallback"] for slide in slides):
        raise ValueError("fallback payload must mark slides as fallback")


def validate_gallery_case(payload: dict, case: dict) -> None:
    validate_gallery_payload(payload)
    expected = case["expected"]
    if "fallback_mode" in expected:
        assert payload["fallback_mode"] == expected["fallback_mode"]
    if "navigation_enabled" in expected:
        assert payload["navigation_enabled"] is expected["navigation_enabled"]
    if "slide_count" in expected:
        assert len(payload["slides"]) == expected["slide_count"]
    if "slide_photo_ids" in expected:
        assert [slide["photo_id"] for slide in payload["slides"]] == expected["slide_photo_ids"]
    if "captions" in expected:
        assert [slide["caption"] for slide in payload["slides"]] == expected["captions"]
    if "credits" in expected:
        assert [slide["credit"] for slide in payload["slides"]] == expected["credits"]
    if "is_fallback" in expected:
        assert all(slide["is_fallback"] is expected["is_fallback"] for slide in payload["slides"])

