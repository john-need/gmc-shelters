from __future__ import annotations


def validate_map_markers(manifest: dict) -> list[dict]:
    """Validate map markers in a camelCase manifest.

    Returns a list of {slug, errors} for every shelter with issues.
    """
    results = []

    for shelter in manifest.get("shelters", []):
        errors: list[str] = []
        markers = shelter.get("mapMarkers", [])
        is_extant = shelter.get("isExtant", False)
        n = len(markers)

        if n == 0:
            errors.append("no mapMarkers")
        else:
            for i, m in enumerate(markers):
                is_last = i == n - 1
                start = m.get("startYear")
                end = m.get("endYear")
                marker_id = m.get("id") or "null"

                if start is None or (end is None and not (is_extant and is_last)):
                    errors.append(f"marker {marker_id} missing startYear or endYear")
                elif start is not None and end is not None and start > end:
                    errors.append(f"marker {marker_id} startYear {start} > endYear {end}")

            first, last = markers[0], markers[-1]

            if first.get("startYear") is not None and first.get("startYear") != shelter.get("startYear"):
                errors.append(
                    f"first marker startYear {first['startYear']} != shelter startYear {shelter.get('startYear')}"
                )

            if is_extant and last.get("endYear") is not None:
                errors.append(
                    f"last marker endYear should be null for extant shelter but got {last['endYear']}"
                )
            elif not is_extant and last.get("endYear") != shelter.get("endYear"):
                errors.append(
                    f"last marker endYear {last.get('endYear')} != shelter endYear {shelter.get('endYear')}"
                )

            for i in range(n - 1):
                end_i = markers[i].get("endYear")
                start_next = markers[i + 1].get("startYear")
                if end_i is not None and start_next is not None:
                    if end_i >= start_next:
                        errors.append(
                            f"overlap: marker {i} endYear {end_i} >= marker {i + 1} startYear {start_next}"
                        )
                    elif end_i + 1 < start_next:
                        errors.append(
                            f"gap: marker {i} endYear {end_i} -> marker {i + 1} startYear {start_next}"
                        )

        if errors:
            results.append({"slug": shelter["slug"], "errors": errors})

    return results
