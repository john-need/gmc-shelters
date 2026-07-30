/** Raw row shape of the `architectures` table (`SELECT * FROM architectures`). */
export interface Architecture {
  id: number;
  name: string;
  description: string | null;
  created: string;
  updated: string;
}
