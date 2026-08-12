/** Raw row shape of the `categories` table (`SELECT * FROM categories`). */
export interface ShelterCategory {
  id: number;
  categoryName: string;
  description: string | null;
  created: string;
  updated: string;
}
