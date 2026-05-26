-- Migration: 005-add-quote-to-shelter-sources.sql
-- Adds per-citation verbatim quote to the shelter_sources join table.
-- See ADR 0002 and CONTEXT.md for rationale.

ALTER TABLE shelter_sources ADD COLUMN quote TEXT NOT NULL DEFAULT '';
