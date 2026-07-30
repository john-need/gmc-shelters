import type { Architecture } from '../types/architecture';

/** Raw `architectures` row shape, as returned by `SELECT * FROM architectures`. */
export interface ArchitectureRow {
  id: number;
  name: string | null;
  description: string | null;
  created: string;
  updated: string;
}

export function makeArchitecture(row: ArchitectureRow): Architecture {
  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description,
    created: row.created,
    updated: row.updated,
  };
}
