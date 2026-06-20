import Database from 'better-sqlite3';
import { getSourcesByShelter, getAllSources, createSource, updateSource, deleteSource } from './sources';

jest.mock('./connection');
import { getDb } from './connection';

const NORMALIZED_SCHEMA = `
  CREATE TABLE shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, slug TEXT NOT NULL,
    is_gmc INTEGER DEFAULT 0, is_extant INTEGER DEFAULT 1, show_on_web INTEGER DEFAULT 0,
    created TEXT, updated TEXT
  );
  CREATE TABLE sources (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    type             TEXT NOT NULL DEFAULT 'other',
    author           TEXT NOT NULL DEFAULT '',
    title            TEXT NOT NULL DEFAULT '',
    container_title  TEXT NOT NULL DEFAULT '',
    editor           TEXT NOT NULL DEFAULT '',
    edition          TEXT NOT NULL DEFAULT '',
    volume           TEXT NOT NULL DEFAULT '',
    issue            TEXT NOT NULL DEFAULT '',
    pages            TEXT NOT NULL DEFAULT '',
    publisher        TEXT NOT NULL DEFAULT '',
    place            TEXT NOT NULL DEFAULT '',
    year             INTEGER,
    date             TEXT NOT NULL DEFAULT '',
    url              TEXT NOT NULL DEFAULT '',
    access_date      TEXT NOT NULL DEFAULT '',
    archive          TEXT NOT NULL DEFAULT '',
    archive_location TEXT NOT NULL DEFAULT '',
    created          TEXT NOT NULL DEFAULT (date('now')),
    updated          TEXT NOT NULL DEFAULT (date('now'))
  );
  CREATE TABLE shelter_sources (
    shelter_id  INTEGER NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
    source_id   INTEGER NOT NULL REFERENCES sources(id)  ON DELETE CASCADE,
    include_in_history INTEGER NOT NULL DEFAULT 0,
    annotation  TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    quote       TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (shelter_id, source_id)
  );
`;

describe('db/sources', () => {
  let db: Database.Database;
  let shelterId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(NORMALIZED_SCHEMA);
    (getDb as jest.Mock).mockReturnValue(db);
    db.pragma('foreign_keys = OFF');
    db.exec(`INSERT INTO shelters (name, slug, created, updated) VALUES ('S', 's', '2020-01-01', '2020-01-01')`);
    shelterId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  });

  afterEach(() => db.close());

  const blank = {
    shelter_id: 0, type: 'book' as const,
    include_in_history: false,
    author: '', title: '', container_title: '', editor: '', edition: '',
    volume: '', issue: '', pages: '', publisher: '', place: '',
    year: null, date: '', url: '', access_date: '', archive: '',
    archive_location: '', annotation: '', notes: '', quote: '',
  };

  it('getSourcesByShelter returns empty array when no sources', () => {
    expect(getSourcesByShelter(shelterId)).toEqual([]);
  });

  it('getAllSources returns every bibliographic source across shelters, no association fields', () => {
    createSource({ ...blank, shelter_id: shelterId, title: 'Beta', author: 'Yale' });
    createSource({ ...blank, shelter_id: shelterId, title: 'Alpha', author: 'Adams' });
    const all = getAllSources();
    expect(all.map((s) => s.title)).toEqual(['Alpha', 'Beta']); // ORDER BY author
    expect(all[0]).not.toHaveProperty('shelter_id');
    expect(all[0]).not.toHaveProperty('annotation');
  });

  it('createSource inserts and returns source', () => {
    const s = createSource({ ...blank, shelter_id: shelterId, author: 'Doe', title: 'A Book', type: 'book' });
    expect(s.author).toBe('Doe');
    expect(s.title).toBe('A Book');
    expect(s.shelter_id).toBe(shelterId);
    expect(s.include_in_history).toBe(false);
  });

  it('getSourcesByShelter returns created sources', () => {
    createSource({ ...blank, shelter_id: shelterId, title: 'X', type: 'book' });
    createSource({ ...blank, shelter_id: shelterId, title: 'Y', type: 'journal' });
    expect(getSourcesByShelter(shelterId)).toHaveLength(2);
  });

  it('updateSource updates fields', () => {
    const s = createSource({ ...blank, shelter_id: shelterId, author: 'Old', type: 'book' });
    const updated = updateSource({ ...s, author: 'New Author', year: 1999, include_in_history: true });
    expect(updated.author).toBe('New Author');
    expect(updated.year).toBe(1999);
    expect(updated.include_in_history).toBe(true);
  });

  it('deleteSource removes the source', () => {
    const s = createSource({ ...blank, shelter_id: shelterId, title: 'ToGo', type: 'website' });
    deleteSource(s.id);
    expect(getSourcesByShelter(shelterId)).toHaveLength(0);
  });
});
