CREATE TABLE shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    slug TEXT,
    default_photo_id INTEGER,
    created TEXT,
    updated TEXT,
    show_on_web INTEGER DEFAULT 1
);

CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photographer TEXT,
    file_name TEXT,
    caption TEXT,
    date_taken TEXT,
    notes TEXT,
    created TEXT,
    updated TEXT,
    shelter_id INTEGER REFERENCES shelters(id)
);

INSERT INTO shelters (id, name, slug, default_photo_id, created, updated, show_on_web) VALUES
    (1, 'Alpha Camp', 'alpha-camp', NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (2, 'Beta Camp', 'beta-camp', NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (3, 'Gamma Camp', 'gamma-camp', 3001, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (4, 'Delta Camp', 'delta-camp', 0, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (5, 'Rerun Camp', 'rerun-camp', NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (6, 'Hidden Camp', 'hidden-camp', NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 0);

INSERT INTO photos (id, photographer, file_name, caption, date_taken, notes, created, updated, shelter_id) VALUES
    (1001, NULL, 'shelters/alpha-camp/alpha-1.jpg', 'Front view', NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (1002, 'Archive', 'shelters/alpha-camp/alpha-2.jpg', 'Interior', NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (1003, NULL, 'shelters/alpha-camp/alpha-missing.jpg', 'Unavailable', NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 1),
    (2001, NULL, 'shelters/beta-camp/beta-1.jpg', NULL, NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 2),
    (3001, NULL, 'shelters/gamma-camp/gamma-default.jpg', NULL, NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 3),
    (4001, NULL, 'shelters/rerun-camp/duplicate-a.jpg', 'Duplicate A', NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 5),
    (4002, NULL, 'shelters/rerun-camp/duplicate-b.jpg', 'Duplicate B', NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 5),
    (4003, NULL, 'shelters/rerun-camp/missing.jpg', 'Missing', NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 5),
    (5001, NULL, 'shelters/hidden-camp/hidden.jpg', NULL, NULL, NULL, '2026-05-05T00:00:00Z', '2026-05-05T00:00:00Z', 6);

