# Photo carousel and import fixtures

- `photo_import_fixture.sql` seeds shelter, photo, fallback, hidden-shelter, and duplicate-source scenarios.
- `shelter_gallery_consumer_cases.json` defines consumer-facing gallery expectations for gallery, single-slide, and site-placeholder payloads.
- Binary image bytes are created at test runtime in `tests/conftest.py` so duplicate-content and missing-file cases stay explicit and easy to maintain.

