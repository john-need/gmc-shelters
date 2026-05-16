import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { log } from '../logger';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const repoRoot = app.getAppPath();
  const dbPath = path.join(repoRoot, 'database', 'gmc_shelters.sqlite');

  log.info(`[db] opening: ${dbPath}`);

  try {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    applyMigrations(db, repoRoot);
    log.info(`[db] opened OK, repoRoot=${repoRoot}`);
  } catch (err) {
    log.error(`[db] failed to open: ${err}`);
    throw err;
  }

  return db;
}

function applyMigrations(database: Database.Database, repoRoot: string): void {
  const migrationsDir = path.join(repoRoot, 'database', 'migrations');
  if (!fs.existsSync(migrationsDir)) return;

  // Apply 002-add-sources-table.sql if sources table doesn't exist
  const tables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'")
    .all() as { name: string }[];

  if (tables.length === 0) {
    const migrationPath = path.join(migrationsDir, '002-add-sources-table.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 002-add-sources-table.sql');
    }
  }
}
