import Database from 'better-sqlite3';
import { getAllShelters, getShelterById, createShelter, updateShelter, deleteShelter } from './shelters';

jest.mock('./connection');
import { getDb } from './connection';

const SCHEMA = `
  CREATE TABLE architectures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL DEFAULT (date('now')),
    updated TEXT NOT NULL DEFAULT (date('now'))
  );
  CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL DEFAULT (date('now')),
    updated TEXT NOT NULL DEFAULT (date('now'))
  );
  CREATE TABLE builders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'organization',
    notes TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL DEFAULT (date('now')),
    updated TEXT NOT NULL DEFAULT (date('now'))
  );
  CREATE TABLE shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, start_year INTEGER, end_year INTEGER,
    description TEXT, slug TEXT NOT NULL UNIQUE,
    default_photo_id INTEGER,
    is_gmc INTEGER DEFAULT 0,
    architecture_id INTEGER REFERENCES architectures(id),
    builder_id INTEGER REFERENCES builders(id),
    notes TEXT, created TEXT, updated TEXT,
    is_extant INTEGER DEFAULT 1,
    category_id INTEGER REFERENCES categories(id),
    show_on_web INTEGER DEFAULT 0,
    history TEXT
  );
  CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shelter_id INTEGER, file_name TEXT, title TEXT,
    photographer TEXT, caption TEXT, date_taken TEXT,
    alt_text TEXT, description TEXT, notes TEXT,
    include_in_post INTEGER DEFAULT 1, created TEXT, updated TEXT
  );
  CREATE TABLE sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, author TEXT, title TEXT
  );
  CREATE TABLE shelter_sources (
    shelter_id INTEGER REFERENCES shelters(id) ON DELETE CASCADE,
    source_id INTEGER
  );
  CREATE TABLE map_markers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    photo_id INTEGER REFERENCES photos(id),
    latitude REAL, longitude REAL, name TEXT,
    start_year INTEGER, end_year INTEGER,
    change_type TEXT, is_extant INTEGER, notes TEXT
  );
`;

describe('db/shelters', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA);
    (getDb as jest.Mock).mockReturnValue(db);
  });

  afterEach(() => db.close());

  describe('getAllShelters', () => {
    it('returns empty array when no shelters', () => {
      expect(getAllShelters()).toEqual([]);
    });

    it('returns all shelters ordered by name', () => {
      db.exec(`INSERT INTO shelters (name, slug, is_gmc, is_extant, show_on_web, created, updated) VALUES ('Zoo', 'zoo', 0, 1, 0, '2020-01-01', '2020-01-01')`);
      db.exec(`INSERT INTO shelters (name, slug, is_gmc, is_extant, show_on_web, created, updated) VALUES ('Alpha', 'alpha', 1, 0, 1, '2020-01-01', '2020-01-01')`);
      const results = getAllShelters();
      expect(results).toHaveLength(2);
      expect(results[0].name).toBe('Alpha');
      expect(results[1].name).toBe('Zoo');
    });

    it('converts integer booleans to JS booleans', () => {
      db.exec(`INSERT INTO shelters (name, slug, is_gmc, is_extant, show_on_web, created, updated) VALUES ('Test', 'test', 1, 0, 1, '2020-01-01', '2020-01-01')`);
      const [s] = getAllShelters();
      expect(s.is_gmc).toBe(true);
      expect(s.is_extant).toBe(false);
      expect(s.show_on_web).toBe(true);
    });

    it('includes photo_count via LEFT JOIN', () => {
      db.exec(`INSERT INTO shelters (name, slug, is_gmc, is_extant, show_on_web, created, updated) VALUES ('Test', 'test', 0, 1, 0, '2020-01-01', '2020-01-01')`);
      const id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
      db.exec(`INSERT INTO photos (shelter_id, file_name, created, updated) VALUES (${id}, 'a.jpg', '2020-01-01', '2020-01-01')`);
      db.exec(`INSERT INTO photos (shelter_id, file_name, created, updated) VALUES (${id}, 'b.jpg', '2020-01-01', '2020-01-01')`);
      const [s] = getAllShelters();
      expect(s.photo_count).toBe(2);
    });
  });

  describe('getShelterById', () => {
    it('returns null when not found', () => {
      expect(getShelterById(999)).toBeNull();
    });

    it('returns correct shelter by id', () => {
      db.exec(`INSERT INTO shelters (name, slug, is_gmc, is_extant, show_on_web, created, updated) VALUES ('Found', 'found', 0, 1, 0, '2020-01-01', '2020-01-01')`);
      const id = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
      const s = getShelterById(id);
      expect(s).not.toBeNull();
      expect(s!.name).toBe('Found');
      expect(s!.id).toBe(id);
    });
  });

  describe('createShelter', () => {
    it('inserts and returns a new shelter', () => {
      const s = createShelter({ name: 'New Hut', start_year: 1950, category: 'Cabin', is_gmc: true, sheltersRoot: '/tmp' });
      expect(s.name).toBe('New Hut');
      expect(s.start_year).toBe(1950);
      expect(s.is_gmc).toBe(true);
    });

    it('auto-generates slug from name', () => {
      const s = createShelter({ name: 'Birch Glen Shelter', start_year: 1960, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });
      expect(s.slug).toBe('birch-glen-shelter');
    });

    it('shelter is retrievable after creation', () => {
      const s = createShelter({ name: 'Persistent', start_year: 1970, category: 'Lean-to', is_gmc: false, sheltersRoot: '/tmp' });
      expect(getShelterById(s.id)).not.toBeNull();
    });
  });

  describe('updateShelter', () => {
    it('updates fields and returns updated shelter', () => {
      const created = createShelter({ name: 'Original', start_year: 1940, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });
      const updated = updateShelter({ ...created, name: 'Renamed', description: 'New desc' });
      expect(updated.name).toBe('Renamed');
      expect(updated.description).toBe('New desc');
    });

    it('renaming the slug rewrites photos.file_name and shelters.history prefixes', () => {
      const created = createShelter({ name: 'Old Place', start_year: 1950, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });
      const oldSlug = created.slug;
      db.exec(`UPDATE shelters SET history = '${oldSlug}/${oldSlug}.md' WHERE id = ${created.id}`);
      db.exec(`INSERT INTO photos (shelter_id, file_name, created, updated) VALUES (${created.id}, '${oldSlug}/photos/a.jpg', '2020-01-01', '2020-01-01')`);

      const updated = updateShelter({ ...created, slug: 'new-place' });

      expect(updated.slug).toBe('new-place');
      // Only the directory prefix changes — the .md file itself isn't renamed,
      // it travels along inside the renamed folder (fs.rename moves the whole dir).
      expect(updated.history).toBe('new-place/old-place.md');
      const photo = db.prepare('SELECT file_name FROM photos WHERE shelter_id = ?').get(created.id) as { file_name: string };
      expect(photo.file_name).toBe('new-place/photos/a.jpg');
    });

    it('does not touch photos.file_name or history when the slug is unchanged', () => {
      const created = createShelter({ name: 'Steady', start_year: 1955, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });
      const slug = created.slug;
      db.exec(`UPDATE shelters SET history = '${slug}/${slug}.md' WHERE id = ${created.id}`);
      db.exec(`INSERT INTO photos (shelter_id, file_name, created, updated) VALUES (${created.id}, '${slug}/photos/a.jpg', '2020-01-01', '2020-01-01')`);

      updateShelter({ ...created, description: 'unrelated edit' });

      const photo = db.prepare('SELECT file_name FROM photos WHERE shelter_id = ?').get(created.id) as { file_name: string };
      expect(photo.file_name).toBe(`${slug}/photos/a.jpg`);
      const row = db.prepare('SELECT history FROM shelters WHERE id = ?').get(created.id) as { history: string };
      expect(row.history).toBe(`${slug}/${slug}.md`);
    });

    it('throws when renaming to a slug already used by another shelter, without mutating either row', () => {
      const a = createShelter({ name: 'Shelter A', start_year: 1960, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });
      const b = createShelter({ name: 'Shelter B', start_year: 1961, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });

      expect(() => updateShelter({ ...a, slug: b.slug })).toThrow('Slug already exists. Choose a unique slug');

      expect(getShelterById(a.id)!.slug).toBe(a.slug);
      expect(getShelterById(b.id)!.slug).toBe(b.slug);
    });

    it('sanitizes the slug before storing or using it for comparisons', () => {
      const created = createShelter({ name: 'Mixed Case', start_year: 1962, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });

      const updated = updateShelter({ ...created, slug: 'My Shelter/Two' });

      expect(updated.slug).toBe('my-shelter-two');
    });

    it('throws when the sanitized slug is empty, before any DB write', () => {
      const created = createShelter({ name: 'Original Name', start_year: 1963, category: 'Shelter', is_gmc: false, sheltersRoot: '/tmp' });

      expect(() => updateShelter({ ...created, slug: '!!!', name: 'Changed Name' })).toThrow(
        'Slug cannot be empty after removing invalid characters',
      );

      const row = getShelterById(created.id)!;
      expect(row.slug).toBe(created.slug);
      expect(row.name).toBe('Original Name');
    });
  });

  describe('deleteShelter', () => {
    it('removes the shelter', () => {
      const s = createShelter({ name: 'ToDelete', start_year: 1930, category: 'Lodge', is_gmc: false, sheltersRoot: '/tmp' });
      deleteShelter(s.id);
      expect(getShelterById(s.id)).toBeNull();
    });

    it('deletes shelter that has a photo referenced by a map_marker', () => {
      const s = createShelter({ name: 'WithMarker', start_year: 1940, category: 'Lodge', is_gmc: false, sheltersRoot: '/tmp' });
      db.exec(`INSERT INTO photos (shelter_id, file_name, created, updated) VALUES (${s.id}, 'a.jpg', '2020-01-01', '2020-01-01')`);
      const photo = db.prepare('SELECT id FROM photos WHERE shelter_id = ?').get(s.id) as { id: number };
      db.exec(`INSERT INTO map_markers (shelter_id, photo_id, latitude, longitude, name, start_year, change_type, is_extant) VALUES (${s.id}, ${photo.id}, 44.0, -72.0, 'Camp', 1940, 'Original', 1)`);
      expect(() => deleteShelter(s.id)).not.toThrow();
      expect(getShelterById(s.id)).toBeNull();
    });
  });
});
