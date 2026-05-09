from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:  # pragma: no cover
    requests = None


class WordPressMediaClient:
    def __init__(self, base_url: str, username: str, app_password: str, session: Any | None = None, timeout: int = 30):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.app_password = app_password
        self.timeout = timeout
        if session is not None:
            self.session = session
        else:
            if requests is None:
                raise RuntimeError("requests is required for WordPressMediaClient")
            self.session = requests.Session()
        token = base64.b64encode(f"{username}:{app_password}".encode("utf-8")).decode("ascii")
        self.headers = {"Authorization": f"Basic {token}"}

    def verify_auth(self) -> None:
        response = self.session.get(
            f"{self.base_url}/wp-json/wp/v2/users/me",
            headers=self.headers,
            timeout=self.timeout,
        )
        response.raise_for_status()

    def upload_media(self, file_path: Path, title: str | None = None, alt_text: str | None = None, caption: str | None = None) -> dict:
        with Path(file_path).open("rb") as handle:
            response = self.session.post(
                f"{self.base_url}/wp-json/wp/v2/media",
                headers={
                    **self.headers,
                    "Content-Disposition": f'attachment; filename="{Path(file_path).name}"',
                },
                data=handle.read(),
                timeout=self.timeout,
            )
        response.raise_for_status()
        payload = response.json()
        attachment_id = int(payload["id"])
        self.update_media_metadata(attachment_id, title=title, alt_text=alt_text, caption=caption)
        return {
            "id": attachment_id,
            "source_url": payload.get("source_url") or payload.get("guid", {}).get("rendered"),
            "title": title,
            "alt_text": alt_text,
            "caption": caption,
        }

    def update_media_metadata(self, attachment_id: int, title: str | None = None, alt_text: str | None = None, caption: str | None = None) -> dict:
        payload = {}
        if title is not None:
            payload["title"] = title
        if alt_text is not None:
            payload["alt_text"] = alt_text
        if caption is not None:
            payload["caption"] = caption
        if not payload:
            return {"id": attachment_id}
        response = self.session.post(
            f"{self.base_url}/wp-json/wp/v2/media/{attachment_id}",
            headers=self.headers,
            json=payload,
            timeout=self.timeout,
        )
        response.raise_for_status()
        return response.json()

