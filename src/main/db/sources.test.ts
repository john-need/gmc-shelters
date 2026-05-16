import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { getSourcesByShelter, createSource, updateSource, deleteSource } from './sources';

jest.mock('./connection');
import { getDb } from './connection';

const MIGRATION = path.join(__dirname, '../../../database/migrations/002-add-sources-table.sql');
const SHELTERS_SCHEMA = `
  CREATE TABLE shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, slug TEXT NOT NULL,
    is_gmc INTEGER DEFAULT 0, is_extant INTEGER DEFAULT 1, show_on_web INTEGER DEFAULT 0,
    created TEXT, updated TEXT
  );
`;

describe('db/sources', () => {
  let db: Database.Database;
  let shelterId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SHELTERS_SCHEMA);
    db.exec(fs.readFileSync(MIGRATION, 'utf8'));
    (getDb as jest.Mock).mockReturnValue(db);
    db.pragma('foreign_keys = OFF');
    db.exec(`INSERT INTO shelters (name, slug, created, updated) VALUES ('S', 's', '2020-01-01', '2020-01-01')`);
    shelterId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  });

  afterEach(() => db.close());

  const blank = {
    shelter_id: 0, type: 'book' as const,
    author: '', title: '', container_title: '', editor: '', edition: '',
    volume: '', issue: '', pages: '', publisher: '', place: '',
    year: null, date: '', url: '', access_date: '', archive: '',
    archive_location: '', annotation: '', notes: '',
  };

  it('getSourcesByShelter returns empty array when no sources', () => {
    expect(getSourcesByShelter(shelterId)).toEqual([]);
  });

  it('createSource inserts and returns source', () => {
    const s = createSource({ ...blank, shelter_id: shelterId, author: 'Doe', title: 'A Book', type: 'book' });
    expect(s.author).toBe('Doe');
    expect(s.title).toBe('A Book');
    expect(s.shelter_id).toBe(shelterId);
  });

  it('getSourcesByShelter returns created sources', () => {
    createSource({ ...blank, shelter_id: shelterId, title: 'X', type: 'book' });
    createSource({ ...blank, shelter_id: shelterId, title: 'Y', type: 'journal' });
    expect(getSourcesByShelter(shelterId)).toHaveLength(2);
  });

  it('updateSource updates fields', () => {
    const s = createSource({ ...blank, shelter_id: shelterId, author: 'Old', type: 'book' });
    const updated = updateSource({ ...s, author: 'New Author', year: 1999 });
    expect(updated.author).toBe('New Author');
    expect(updated.year).toBe(1999);
  });

  it('deleteSource removes the source', () => {
    const s = createSource({ ...blank, shelter_id: shelterId, title: 'ToGo', type: 'website' });
    deleteSource(s.id);
    expect(getSourcesByShelter(shelterId)).toHaveLength(0);
  });
});
