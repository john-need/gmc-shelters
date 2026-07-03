-- Migration 010: add created/updated columns to categories.
-- The original categories table was created without these columns,
-- causing INSERT in createCategory() to throw and silently fail.
ALTER TABLE categories ADD COLUMN created TEXT;
ALTER TABLE categories ADD COLUMN updated TEXT;
UPDATE categories SET created = date('now'), updated = date('now') WHERE created IS NULL;
