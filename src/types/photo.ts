/** Raw row shape of the `photos` table (`SELECT * FROM photos`). */
export interface Photo {
  id: number;
  photographer: string | null;
  fileName: string;
  caption: string | null;
  dateTaken: string | null;
  notes: string | null;
  created: string;
  updated: string;
  shelterId: number;
  altText: string | null;
  title: string | null;
  description: string | null;
  includeInPost: boolean;
  sortOrder: number | null;
}
