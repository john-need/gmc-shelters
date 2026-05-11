from __future__ import annotations

import json

from scripts.import_shelter_photos import main


def test_cli_emits_json_summary_with_per_item_outcomes(migrated_db_path, fixture_repo, captured_streams):
    stdout, stderr = captured_streams

    class ClientFactory:
        def __init__(self):
            self.client = None

        def __call__(self, base_url: str, username: str, app_password: str):
            from tests.conftest import FakeWordPressMediaClient

            self.client = FakeWordPressMediaClient(base_url, username, app_password)
            return self.client

    factory = ClientFactory()
    exit_code = main(
        [
            "--db",
            str(migrated_db_path),
            "--base-url",
            "https://example.org",
            "--username",
            "user",
            "--app-password",
            "pass",
            "--shelter",
            "rerun-camp",
            "--dry-run",
            "--format",
            "json",
        ],
        repo_root=fixture_repo,
        stdout=stdout,
        stderr=stderr,
        wordpress_client_factory=factory,
    )

    assert exit_code == 0
    payload = json.loads(stdout.getvalue())
    assert payload["requested"] == 3
    assert payload["uploaded"] == 1
    assert payload["skipped"] == 1
    assert payload["failed"] == 1
    assert {item["outcome"] for item in payload["items"]} == {"uploaded", "skipped", "failed"}
    assert stderr.getvalue() == ""


def test_cli_returns_exit_code_one_for_run_level_auth_failures(migrated_db_path, fixture_repo, captured_streams):
    stdout, stderr = captured_streams

    class FailingFactory:
        def __call__(self, base_url: str, username: str, app_password: str):
            from tests.conftest import FakeWordPressMediaClient

            return FakeWordPressMediaClient(base_url, username, app_password, fail_auth=True)

    exit_code = main(
        [
            "--db",
            str(migrated_db_path),
            "--base-url",
            "https://example.org",
            "--username",
            "user",
            "--app-password",
            "pass",
            "--shelter",
            "rerun-camp",
        ],
        repo_root=fixture_repo,
        stdout=stdout,
        stderr=stderr,
        wordpress_client_factory=FailingFactory(),
    )

    assert exit_code == 1
    assert stdout.getvalue() == ""
    assert "invalid-auth" in stderr.getvalue()

