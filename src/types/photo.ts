/** Raw row shape of the `photos` table (`SELECT * FROM photos`). */
export interface Photo {
  id: number;
  photographer: string | null;
  file_name: string;
  caption: string | null;
  date_taken: string | null;
  notes: string | null;
  created: string;
  updated: string;
  shelter_id: number;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  include_in_post: number;
  sort_order: number | null;
}
