import type { Builder } from '../types/builder';

/** Raw `builders` row shape, as returned by `SELECT * FROM builders`. */
export interface BuilderRow {
  id: number;
  name: string;
  type: string;
  notes: string;
  created: string;
  updated: string;
}

export function makeBuilder(row: BuilderRow): Builder {
  return { ...row };
}
