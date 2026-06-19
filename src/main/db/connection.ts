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
  const sourceTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sources'")
    .all() as { name: string }[];

  if (sourceTables.length === 0) {
    const migrationPath = path.join(migrationsDir, '002-add-sources-table.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 002-add-sources-table.sql');
    }
  }

  // Apply 003-add-map-markers-table.sql if map_markers table doesn't exist
  const markerTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='map_markers'")
    .all() as { name: string }[];

  if (markerTables.length === 0) {
    const migrationPath = path.join(migrationsDir, '003-add-map-markers-table.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 003-add-map-markers-table.sql');
    }
  }

  // Apply 004-5nf-normalisation.sql if builders table doesn't exist
  const builderTables = database
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='builders'")
    .all() as { name: string }[];

  if (builderTables.length === 0) {
    const migrationPath = path.join(migrationsDir, '004-5nf-normalisation.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 004-5nf-normalisation.sql');
    }
  }

  // Apply 005-add-quote-to-shelter-sources.sql if quote column doesn't exist on shelter_sources
  const quoteCol = database
    .prepare("SELECT COUNT(*) AS n FROM pragma_table_info('shelter_sources') WHERE name='quote'")
    .get() as { n: number };

  if (quoteCol.n === 0) {
    const migrationPath = path.join(migrationsDir, '005-add-quote-to-shelter-sources.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 005-add-quote-to-shelter-sources.sql');
    }
  }

  // Apply 006-move-quote-to-shelter-sources.sql if sources.quote column still exists
  const sourcesQuoteCol = database
    .prepare("SELECT COUNT(*) AS n FROM pragma_table_info('sources') WHERE name='quote'")
    .get() as { n: number };

  if (sourcesQuoteCol.n > 0) {
    const migrationPath = path.join(migrationsDir, '006-move-quote-to-shelter-sources.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 006-move-quote-to-shelter-sources.sql');
    }
  }

  // Apply 007-add-shelter-history-column.sql if shelters.history column doesn't exist
  const shelterHistoryCol = database
    .prepare("SELECT COUNT(*) AS n FROM pragma_table_info('shelters') WHERE name='history'")
    .get() as { n: number };

  if (shelterHistoryCol.n === 0) {
    const migrationPath = path.join(migrationsDir, '007-add-shelter-history-column.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 007-add-shelter-history-column.sql');
    }
  }

  // Apply 008-add-include-in-history-to-shelter-sources.sql if column doesn't exist
  const includeInHistoryCol = database
    .prepare("SELECT COUNT(*) AS n FROM pragma_table_info('shelter_sources') WHERE name='include_in_history'")
    .get() as { n: number };

  if (includeInHistoryCol.n === 0) {
    const migrationPath = path.join(migrationsDir, '008-add-include-in-history-to-shelter-sources.sql');
    if (fs.existsSync(migrationPath)) {
      const sql = fs.readFileSync(migrationPath, 'utf8');
      database.exec(sql);
      log.info('Applied migration: 008-add-include-in-history-to-shelter-sources.sql');
    }
  }
}
