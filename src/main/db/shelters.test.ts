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
    shelter_id INTEGER, source_id INTEGER
  );
`;

describe('db/shelters', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
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
  });

  describe('deleteShelter', () => {
    it('removes the shelter', () => {
      const s = createShelter({ name: 'ToDelete', start_year: 1930, category: 'Lodge', is_gmc: false, sheltersRoot: '/tmp' });
      deleteShelter(s.id);
      expect(getShelterById(s.id)).toBeNull();
    });
  });
});
