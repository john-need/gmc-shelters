/** Raw row shape of the `builders` table (`SELECT * FROM builders`). */
export interface Builder {
  id: number;
  name: string;
  type: string;
  notes: string;
  created: string;
  updated: string;
}
