import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.join(__dirname, '../../../../database/migrations/009-add-photo-sort-order.sql');

describe('migration 009-add-photo-sort-order', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE photos (
        id INTEGER PRIMARY KEY,
        shelter_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        created TEXT,
        updated TEXT
      );
    `);
    db.prepare('INSERT INTO photos (id, shelter_id, file_name, created, updated) VALUES (?, ?, ?, ?, ?)')
      .run(1, 10, 'third.jpg', '2024-01-03', '2024-01-03');
    db.prepare('INSERT INTO photos (id, shelter_id, file_name, created, updated) VALUES (?, ?, ?, ?, ?)')
      .run(2, 10, 'first.jpg', '2024-01-01', '2024-01-01');
    db.prepare('INSERT INTO photos (id, shelter_id, file_name, created, updated) VALUES (?, ?, ?, ?, ?)')
      .run(3, 10, 'second.jpg', '2024-01-02', '2024-01-02');
    db.prepare('INSERT INTO photos (id, shelter_id, file_name, created, updated) VALUES (?, ?, ?, ?, ?)')
      .run(4, 11, 'other-shelter.jpg', '2024-01-01', '2024-01-01');

    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    db.exec(sql);
  });

  afterEach(() => {
    db.close();
  });

  it('adds the sort_order column', () => {
    const columns = db.pragma('table_info(photos)') as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain('sort_order');
  });

  it('backfills sort order per shelter from created date', () => {
    const rows = db.prepare('SELECT id, sort_order FROM photos WHERE shelter_id = ? ORDER BY sort_order').all(10) as Array<{ id: number; sort_order: number }>;
    expect(rows).toEqual([
      { id: 2, sort_order: 1 },
      { id: 3, sort_order: 2 },
      { id: 1, sort_order: 3 },
    ]);
  });

  it('restarts numbering for each shelter', () => {
    const row = db.prepare('SELECT sort_order FROM photos WHERE id = ?').get(4) as { sort_order: number };
    expect(row.sort_order).toBe(1);
  });
});
