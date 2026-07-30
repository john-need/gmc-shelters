/** Raw row shape of the `shelters` table (`SELECT * FROM shelters`). */
export interface Shelter {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  description: string | null;
  slug: string;
  default_photo_id: number | null;
  is_gmc: number;
  architecture_id: number | null;
  builder_id: number | null;
  notes: string | null;
  created: string;
  updated: string;
  is_extant: number;
  category_id: number | null;
  show_on_web: number;
  history: string | null;
}
