import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.join(__dirname, '../../../../database/migrations/002-add-sources-table.sql');

describe('migration 002-add-sources-table', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    db.exec(sql);
  });

  afterEach(() => {
    db.close();
  });

  it('creates the sources table', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'")
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe('sources');
  });

  it('creates the idx_sources_shelter index', () => {
    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sources_shelter'")
      .get() as { name: string } | undefined;
    expect(row).toBeDefined();
    expect(row?.name).toBe('idx_sources_shelter');
  });

  it('sources table has required columns', () => {
    const columns = db.pragma('table_info(sources)') as Array<{ name: string }>;
    const names = columns.map((c) => c.name);
    const required = [
      'id', 'shelter_id', 'type', 'author', 'title', 'container_title',
      'url', 'year', 'annotation', 'notes', 'created', 'updated',
    ];
    for (const col of required) {
      expect(names).toContain(col);
    }
  });

  it('can insert a sources row with FK enforcement disabled', () => {
    // FK enforcement is off by default in SQLite; explicitly ensure it for this isolated test
    db.pragma('foreign_keys = OFF');
    const stmt = db.prepare(`INSERT INTO sources (shelter_id, type) VALUES (?, ?)`);
    expect(() => stmt.run(999, 'book')).not.toThrow();
  });

  it('is idempotent — running migration twice does not throw', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    expect(() => db.exec(sql)).not.toThrow();
  });
});
