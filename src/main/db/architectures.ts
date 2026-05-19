import { getDb } from './connection';
import type { Architecture, ArchitectureInput } from '../../shared/ipc-types';

interface ArchRow {
  id: number;
  name: string;
  description: string | null;
  created: string;
  updated: string;
}

function rowToArch(row: ArchRow): Architecture {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    created: row.created,
    updated: row.updated,
  };
}

export function getAllArchitectures(): Architecture[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM architectures ORDER BY name ASC').all() as ArchRow[];
  return rows.map(rowToArch);
}

export function createArchitecture(input: ArchitectureInput): Architecture {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const result = db
    .prepare(
      'INSERT INTO architectures (name, description, created, updated) VALUES (?, ?, ?, ?)',
    )
    .run(input.name, input.description, today, today);
  const row = db
    .prepare('SELECT * FROM architectures WHERE id = ?')
    .get(result.lastInsertRowid) as ArchRow;
  return rowToArch(row);
}

export function updateArchitecture(arch: Architecture): Architecture {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const old = db
    .prepare('SELECT name FROM architectures WHERE id = ?')
    .get(arch.id) as { name: string } | undefined;

  db.prepare(
    'UPDATE architectures SET name = ?, description = ?, updated = ? WHERE id = ?',
  ).run(arch.name, arch.description, today, arch.id);

  // Cascade rename to shelters
  if (old && old.name !== arch.name) {
    db.prepare("UPDATE shelters SET architecture = ? WHERE architecture = ?").run(
      arch.name,
      old.name,
    );
  }

  const row = db
    .prepare('SELECT * FROM architectures WHERE id = ?')
    .get(arch.id) as ArchRow;
  return rowToArch(row);
}

export function deleteArchitecture(id: number, reassignTo?: string): void {
  const db = getDb();
  if (reassignTo) {
    const old = db
      .prepare('SELECT name FROM architectures WHERE id = ?')
      .get(id) as { name: string } | undefined;
    if (old) {
      db.prepare("UPDATE shelters SET architecture = ? WHERE architecture = ?").run(
        reassignTo,
        old.name,
      );
    }
  }
  db.prepare('DELETE FROM architectures WHERE id = ?').run(id);
}
