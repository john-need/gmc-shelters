#!/usr/bin/env python3
"""Deploy shelter photos and manifest to Google Drive.

Setup (one-time):
  1. Create a Google Cloud project and enable the Drive API.
  2. Create OAuth 2.0 Desktop App credentials and download as credentials.json
     to the project root.
  3. Run this script — a browser window opens for consent; token.json is cached.

Usage:
  python3 scripts/deploy_to_drive.py

The script uploads photos from dist/{slug}/ to matching subfolders in the
target Drive folder, records driveFileId for each photo, normalises fileName
to a bare filename, and updates shelter-manifest.json both locally and on Drive.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
from pathlib import Path

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow

ROOT_FOLDER_ID = "1T0w8pSSIT13y4HzNOKerIPNULjDopD45"
DIST_PATH = Path("dist")
MANIFEST_NAME = "shelter-manifest.json"
SCOPES = ["https://www.googleapis.com/auth/drive"]


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------

def authenticate(credentials_path: Path, token_path: Path):
    """Return an authenticated Drive API service object."""
    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(credentials_path), SCOPES
            )
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())
    return build("drive", "v3", credentials=creds)


# ---------------------------------------------------------------------------
# Filename normalisation
# ---------------------------------------------------------------------------

def normalise_filename(file_name: str) -> str:
    """Return the bare filename, stripping any leading path components."""
    return Path(file_name).name


# ---------------------------------------------------------------------------
# Drive index helpers
# ---------------------------------------------------------------------------

def build_drive_file_index(service, folder_id: str) -> dict[str, str]:
    """Return {filename: drive_id} for all non-trashed files in folder_id."""
    result = (
        service.files()
        .list(
            q=f"'{folder_id}' in parents and trashed=false",
            fields="files(id, name)",
            pageSize=1000,
        )
        .execute(num_retries=5)
    )
    return {f["name"]: f["id"] for f in result.get("files", [])}


def get_or_create_subfolder(
    service, parent_id: str, slug: str, root_index: dict[str, str]
) -> str:
    """Return the Drive folder ID for slug, creating it if absent."""
    if slug in root_index:
        return root_index[slug]
    metadata = {
        "name": slug,
        "mimeType": "application/vnd.google-apps.folder",
        "parents": [parent_id],
    }
    folder = (
        service.files().create(body=metadata, fields="id").execute(num_retries=5)
    )
    folder_id = folder["id"]
    root_index[slug] = folder_id
    print(f"  [FOLDER] Created '{slug}' ({folder_id})")
    return folder_id


# ---------------------------------------------------------------------------
# Upload helpers
# ---------------------------------------------------------------------------

def upload_photo(service, local_path: Path, folder_id: str) -> str:
    """Upload a photo to folder_id and return its new Drive file ID."""
    mime_type, _ = mimetypes.guess_type(str(local_path))
    if mime_type is None:
        mime_type = "application/octet-stream"
    metadata = {"name": local_path.name, "parents": [folder_id]}
    media = MediaFileUpload(str(local_path), mimetype=mime_type, resumable=False)
    file = (
        service.files()
        .create(body=metadata, media_body=media, fields="id")
        .execute(num_retries=5)
    )
    return file["id"]


def update_or_create_manifest(
    service, root_folder_id: str, manifest_path: Path
) -> None:
    """Upload manifest_path to Drive root, updating in place if it already exists."""
    root_index = build_drive_file_index(service, root_folder_id)
    media = MediaFileUpload(str(manifest_path), mimetype="application/json")
    if MANIFEST_NAME in root_index:
        existing_id = root_index[MANIFEST_NAME]
        service.files().update(
            fileId=existing_id, media_body=media
        ).execute(num_retries=5)
        print(f"[MANIFEST] Updated {MANIFEST_NAME} in place ({existing_id})")
    else:
        metadata = {"name": MANIFEST_NAME, "parents": [root_folder_id]}
        result = (
            service.files()
            .create(body=metadata, media_body=media, fields="id")
            .execute(num_retries=5)
        )
        print(f"[MANIFEST] Uploaded {MANIFEST_NAME} ({result['id']})")


# ---------------------------------------------------------------------------
# Per-shelter processing
# ---------------------------------------------------------------------------

def process_shelter(
    service,
    shelter: dict,
    root_folder_id: str,
    dist_path: Path,
    root_index: dict[str, str],
) -> dict:
    """Process one shelter: upload new photos, resolve IDs for existing ones.

    Returns stats dict: {uploaded, skipped, failed, missing_local}.
    """
    slug = shelter["slug"]
    stats = {"uploaded": 0, "skipped": 0, "failed": 0, "missing_local": 0}

    subfolder_id = get_or_create_subfolder(service, root_folder_id, slug, root_index)
    drive_index = build_drive_file_index(service, subfolder_id)

    # Detect duplicate local filenames within this slug folder
    seen_names: set[str] = set()
    for photo in shelter.get("photos", []):
        bare = normalise_filename(photo["fileName"])
        if bare in seen_names:
            print(f"  [WARN] Duplicate filename '{bare}' in slug '{slug}'")
        seen_names.add(bare)

    for photo in shelter.get("photos", []):
        bare = normalise_filename(photo["fileName"])
        local_file = dist_path / slug / bare

        # Missing local file guard (FR-009, T028)
        if not local_file.exists():
            print(f"  [WARN] {bare} (not in dist/)")
            stats["missing_local"] += 1
            # Preserve any existing driveFileId — do not overwrite
            continue

        photo["fileName"] = bare

        if bare in drive_index:
            # File already on Drive — resolve ID, skip upload
            photo["driveFileId"] = drive_index[bare]
            print(f"  [RESOLVE] {bare} (ID from Drive index)")
            stats["skipped"] += 1
        else:
            # Upload new file
            try:
                drive_id = upload_photo(service, local_file, subfolder_id)
                photo["driveFileId"] = drive_id
                drive_index[bare] = drive_id
                print(f"  [UPLOAD] {bare}")
                stats["uploaded"] += 1
            except HttpError as exc:
                print(
                    f"  [ERROR] {bare} — HTTP {exc.resp.status}: {exc._get_reason()}"
                )
                stats["failed"] += 1
                # Preserve any existing driveFileId; only clear if there was none
                if photo.get("driveFileId") is None:
                    photo["driveFileId"] = None

    return stats


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--credentials",
        default="credentials.json",
        help="Path to OAuth2 credentials JSON (default: credentials.json)",
    )
    parser.add_argument(
        "--token",
        default="token.json",
        help="Path to cached OAuth2 token (default: token.json)",
    )
    args = parser.parse_args()

    credentials_path = Path(args.credentials)
    token_path = Path(args.token)

    if not credentials_path.exists():
        print(
            f"ERROR: credentials file not found at '{credentials_path}'.\n"
            "Download OAuth 2.0 Desktop App credentials from Google Cloud Console.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Authenticating with Google Drive...")
    service = authenticate(credentials_path, token_path)

    # T034: Verify root folder is reachable before processing anything
    try:
        service.files().get(fileId=ROOT_FOLDER_ID, fields="id,name").execute(
            num_retries=5
        )
    except HttpError as exc:
        print(
            f"ERROR: Target Drive folder not found or not accessible "
            f"(ID: {ROOT_FOLDER_ID}). HTTP {exc.resp.status}.",
            file=sys.stderr,
        )
        sys.exit(1)

    manifest_path = DIST_PATH / MANIFEST_NAME
    if not manifest_path.exists():
        print(f"ERROR: Manifest not found at '{manifest_path}'.", file=sys.stderr)
        sys.exit(1)

    with manifest_path.open() as f:
        manifest = json.load(f)

    shelters = manifest.get("shelters", [])
    print(f"Processing {len(shelters)} shelters...")

    # Pre-build root index once to avoid redundant Drive calls for subfolder lookup
    root_index = build_drive_file_index(service, ROOT_FOLDER_ID)

    totals = {"uploaded": 0, "skipped": 0, "failed": 0, "missing_local": 0}
    for shelter in shelters:
        slug = shelter["slug"]
        print(f"\n[{slug}]")
        stats = process_shelter(service, shelter, ROOT_FOLDER_ID, DIST_PATH, root_index)
        for key in totals:
            totals[key] += stats[key]
        print(
            f"  → uploaded={stats['uploaded']} skipped={stats['skipped']} "
            f"failed={stats['failed']} missing={stats['missing_local']}"
        )

    # Write updated manifest locally first (FR-010), then push to Drive
    with manifest_path.open("w") as f:
        json.dump(manifest, f, indent=2)
    print(f"\nManifest written locally to {manifest_path}")

    update_or_create_manifest(service, ROOT_FOLDER_ID, manifest_path)

    print(
        f"\n{'='*60}\n"
        f"Deploy complete.\n"
        f"  Shelters processed : {len(shelters)}\n"
        f"  Photos uploaded    : {totals['uploaded']}\n"
        f"  Photos skipped     : {totals['skipped']}\n"
        f"  Photos failed      : {totals['failed']}\n"
        f"  Missing local      : {totals['missing_local']}\n"
        f"{'='*60}"
    )
    if totals["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
