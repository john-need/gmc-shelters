-- Add history column to shelters: relative path to the shelter's markdown history file.
-- Populated with the conventional {slug}/{slug}.md for all existing rows.
ALTER TABLE shelters ADD COLUMN history TEXT;
UPDATE shelters SET history = slug || '/' || slug || '.md';
