import type { ShelterCategory } from '../types/shelter-category';

/** Raw `categories` row shape, as returned by `SELECT * FROM categories`. */
export interface CategoryRow {
  id: number;
  category_name: string;
  description: string | null;
  created: string;
  updated: string;
}

export function makeShelterCategory(row: CategoryRow): ShelterCategory {
  return {
    id: row.id,
    categoryName: row.category_name,
    description: row.description,
    created: row.created,
    updated: row.updated,
  };
}
