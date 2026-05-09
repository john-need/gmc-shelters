from __future__ import annotations

import json

from scripts.lib.photo_models import ImportSummary


def format_import_summary(summary: ImportSummary, output_format: str) -> str:
    if output_format == "json":
        return json.dumps(summary.to_dict(), indent=2) + "\n"

    lines = [
        f"{item.outcome}: photo_id={item.photo_id} shelter={item.shelter_slug} path={item.source_rel_path}"
        + (f" reason={item.reason}" if item.reason else "")
        for item in summary.items
    ]
    lines.extend(
        [
            "",
            f"requested: {summary.requested}",
            f"uploaded: {summary.uploaded}",
            f"skipped: {summary.skipped}",
            f"failed: {summary.failed}",
            f"run_id: {summary.run_id}" if summary.run_id is not None else "run_id: dry-run",
            "",
        ]
    )
    return "\n".join(lines)

