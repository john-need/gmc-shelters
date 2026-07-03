import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.join(__dirname, '../../../../database/migrations/010-add-categories-timestamps.sql');

describe('migration 010-add-categories-timestamps', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE categories (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        category_name TEXT NOT NULL,
        description   TEXT
      );
    `);
    db.prepare('INSERT INTO categories (category_name, description) VALUES (?, ?)').run('Lean-to', 'A lean-to shelter');

    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    db.exec(sql);
  });

  afterEach(() => {
    db.close();
  });

  it('adds created and updated columns', () => {
    const cols = (db.pragma('table_info(categories)') as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('created');
    expect(cols).toContain('updated');
  });

  it('backfills existing rows with a non-null date', () => {
    const row = db.prepare('SELECT created, updated FROM categories WHERE category_name = ?').get('Lean-to') as { created: string; updated: string };
    expect(row.created).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(row.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('allows INSERT with created and updated after migration', () => {
    expect(() => {
      db.prepare('INSERT INTO categories (category_name, description, created, updated) VALUES (?, ?, ?, ?)').run('Lodge', '', '2026-01-01', '2026-01-01');
    }).not.toThrow();
  });
});
