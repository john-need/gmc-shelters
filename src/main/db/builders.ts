import { getDb } from './connection';
import type { Builder } from '../../types/builder';

export function getAllBuilders(): Builder[] {
  const db = getDb();
  return db.prepare('SELECT * FROM builders ORDER BY name ASC').all() as Builder[];
}
