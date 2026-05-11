from __future__ import annotations

import sqlite3

from scripts.lib.photo_models import CandidatePhoto, GallerySlide


class PhotoRepository:
    def __init__(self, connection: sqlite3.Connection):
        self.connection = connection

    def list_candidate_photos(
        self,
        *,
        shelter_slug: str | None = None,
        photo_id: int | None = None,
        limit: int | None = None,
    ) -> list[CandidatePhoto]:
        conditions = ["COALESCE(TRIM(p.file_name), '') <> ''", "COALESCE(s.show_on_web, 1) = 1"]
        params: list[object] = []
        if shelter_slug:
            conditions.append("s.slug = ?")
            params.append(shelter_slug)
        if photo_id is not None:
            conditions.append("p.id = ?")
            params.append(photo_id)

        sql = f"""
        SELECT
            p.id AS photo_id,
            p.shelter_id AS shelter_id,
            s.slug AS shelter_slug,
            s.name AS shelter_name,
            p.file_name AS file_name,
            p.caption AS caption,
            p.photographer AS photographer,
            s.default_photo_id AS default_photo_id
        FROM photos p
        JOIN shelters s ON s.id = p.shelter_id
        WHERE {' AND '.join(conditions)}
        ORDER BY p.id ASC
        """
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)

        rows = self.connection.execute(sql, tuple(params)).fetchall()
        return [CandidatePhoto(**dict(row)) for row in rows]

    def list_gallery_slides(self, shelter_slug: str) -> list[GallerySlide]:
        rows = self.connection.execute(
            """
            SELECT
                p.id AS photo_id,
                a.wp_attachment_id AS wp_attachment_id,
                a.wp_media_url AS image_url,
                COALESCE(a.alt_text, a.title, s.name) AS alt_text,
                p.caption AS caption,
                p.photographer AS credit
            FROM shelters s
            JOIN photos p ON p.shelter_id = s.id
            JOIN photo_asset_links l ON l.photo_id = p.id
            JOIN photo_managed_assets a ON a.id = l.asset_id
            WHERE s.slug = ?
              AND (s.default_photo_id IS NULL OR s.default_photo_id = 0 OR p.id <> s.default_photo_id)
              AND a.status = 'uploaded'
              AND a.wp_attachment_id IS NOT NULL
              AND COALESCE(a.wp_media_url, '') <> ''
            ORDER BY p.id ASC
            """,
            (shelter_slug,),
        ).fetchall()
        return [GallerySlide(is_fallback=False, **dict(row)) for row in rows]

    def get_default_fallback_slide(self, shelter_slug: str) -> GallerySlide | None:
        row = self.connection.execute(
            """
            SELECT
                s.name AS shelter_name,
                a.wp_attachment_id AS wp_attachment_id,
                a.wp_media_url AS image_url,
                COALESCE(a.alt_text, a.title, s.name || ' default image') AS alt_text
            FROM shelters s
            JOIN photos p ON p.id = s.default_photo_id
            JOIN photo_asset_links l ON l.photo_id = p.id
            JOIN photo_managed_assets a ON a.id = l.asset_id
            WHERE s.slug = ?
              AND s.default_photo_id IS NOT NULL
              AND s.default_photo_id > 0
              AND a.status = 'uploaded'
              AND a.wp_attachment_id IS NOT NULL
              AND COALESCE(a.wp_media_url, '') <> ''
            LIMIT 1
            """,
            (shelter_slug,),
        ).fetchone()
        if row is None:
            return None
        return GallerySlide(
            photo_id=None,
            wp_attachment_id=row["wp_attachment_id"],
            image_url=row["image_url"],
            alt_text=row["alt_text"],
            caption=None,
            credit=None,
            is_fallback=True,
        )

    def get_shelter_name(self, shelter_slug: str) -> str:
        row = self.connection.execute(
            "SELECT name FROM shelters WHERE slug = ? LIMIT 1",
            (shelter_slug,),
        ).fetchone()
        if row is None:
            raise KeyError(f"unknown shelter slug: {shelter_slug}")
        return str(row["name"])

