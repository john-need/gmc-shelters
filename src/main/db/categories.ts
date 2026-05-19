import { getDb } from './connection';
import type { Category, CategoryInput } from '../../shared/ipc-types';

interface CategoryRow {
  id: number;
  category_name: string;
  description: string | null;
  created: string;
  updated: string;
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.category_name,
    description: row.description ?? '',
    created: row.created,
    updated: row.updated,
  };
}

export function getAllCategories(): Category[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM categories ORDER BY category_name ASC').all() as CategoryRow[];
  return rows.map(rowToCategory);
}

export function createCategory(input: CategoryInput): Category {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare(
      'INSERT INTO categories (category_name, description, created, updated) VALUES (?, ?, ?, ?)',
    )
    .run(input.name, input.description, today, today);
  const row = db
    .prepare('SELECT * FROM categories WHERE id = ?')
    .get(result.lastInsertRowid) as CategoryRow;
  return rowToCategory(row);
}

export function updateCategory(cat: Category): Category {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    'UPDATE categories SET category_name = ?, description = ?, updated = ? WHERE id = ?',
  ).run(cat.name, cat.description, today, cat.id);
  // No text cascade needed — shelters reference categories via category_id FK
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(cat.id) as CategoryRow;
  return rowToCategory(row);
}

export function deleteCategory(id: number, reassignTo?: string): void {
  const db = getDb();
  if (reassignTo) {
    const target = db
      .prepare('SELECT id FROM categories WHERE category_name = ?')
      .get(reassignTo) as { id: number } | undefined;
    if (target) {
      db.prepare('UPDATE shelters SET category_id = ? WHERE category_id = ?').run(target.id, id);
    } else {
      db.prepare('UPDATE shelters SET category_id = NULL WHERE category_id = ?').run(id);
    }
  } else {
    db.prepare('UPDATE shelters SET category_id = NULL WHERE category_id = ?').run(id);
  }
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}
