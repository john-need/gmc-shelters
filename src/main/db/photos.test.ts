import Database from 'better-sqlite3';
import { getPhotosByShelter, updatePhoto, deletePhoto, setDefaultPhoto, insertPhoto, clearDefaultPhoto } from './photos';

jest.mock('./connection');
import { getDb } from './connection';

const SCHEMA = `
  CREATE TABLE shelters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, slug TEXT NOT NULL, is_gmc INTEGER DEFAULT 0,
    is_extant INTEGER DEFAULT 1, show_on_web INTEGER DEFAULT 0,
    default_photo_id INTEGER, created TEXT, updated TEXT
  );
  CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shelter_id INTEGER, file_name TEXT, title TEXT,
    photographer TEXT DEFAULT '', caption TEXT DEFAULT '',
    date_taken TEXT, notes TEXT DEFAULT '', alt_text TEXT DEFAULT '',
    description TEXT DEFAULT '', include_in_post INTEGER DEFAULT 0,
    created TEXT, updated TEXT
  );
`;

describe('db/photos', () => {
  let db: Database.Database;
  let shelterId: number;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    (getDb as jest.Mock).mockReturnValue(db);
    db.exec(`INSERT INTO shelters (name, slug, created, updated) VALUES ('Test', 'test', '2020-01-01', '2020-01-01')`);
    shelterId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
  });

  afterEach(() => db.close());

  it('getPhotosByShelter returns empty array when no photos', () => {
    expect(getPhotosByShelter(shelterId)).toEqual([]);
  });

  it('insertPhoto creates a photo record', () => {
    const photo = insertPhoto(shelterId, 'shot.jpg', 'Test Title');
    expect(photo.file_name).toBe('shot.jpg');
    expect(photo.title).toBe('Test Title');
    expect(photo.shelter_id).toBe(shelterId);
  });

  it('getPhotosByShelter returns inserted photos', () => {
    insertPhoto(shelterId, 'a.jpg');
    insertPhoto(shelterId, 'b.jpg');
    expect(getPhotosByShelter(shelterId)).toHaveLength(2);
  });

  it('insertPhoto converts include_in_post to boolean', () => {
    const photo = insertPhoto(shelterId, 'c.jpg');
    expect(typeof photo.include_in_post).toBe('boolean');
  });

  it('updatePhoto updates metadata fields', () => {
    const created = insertPhoto(shelterId, 'd.jpg', 'Old Title');
    updatePhoto({
      id: created.id, shelter_id: shelterId,
      title: 'New Title', photographer: 'Jane',
      caption: 'A caption', date_taken: '2020-06-01',
      notes: 'some notes', alt_text: 'alt', description: 'desc',
      include_in_post: true, updated: '2020-01-01',
    });
    const photos = getPhotosByShelter(shelterId);
    const updated = photos.find((p) => p.id === created.id)!;
    expect(updated.title).toBe('New Title');
    expect(updated.photographer).toBe('Jane');
    expect(updated.caption).toBe('A caption');
  });

  it('deletePhoto removes the photo', () => {
    const photo = insertPhoto(shelterId, 'del.jpg');
    deletePhoto(photo.id);
    expect(getPhotosByShelter(shelterId)).toHaveLength(0);
  });

  it('setDefaultPhoto updates shelter default_photo_id', () => {
    const photo = insertPhoto(shelterId, 'def.jpg');
    setDefaultPhoto(shelterId, photo.id);
    const row = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number };
    expect(row.default_photo_id).toBe(photo.id);
  });

  describe('clearDefaultPhoto', () => {
    it('clears default_photo_id when it matches the given photoId', () => {
      const photo = insertPhoto(shelterId, 'clear-me.jpg');
      setDefaultPhoto(shelterId, photo.id);
      clearDefaultPhoto(shelterId, photo.id);
      const row = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number | null };
      expect(row.default_photo_id).toBeNull();
    });

    it('does not clear default_photo_id when photoId does not match', () => {
      const photo = insertPhoto(shelterId, 'keep-default.jpg');
      setDefaultPhoto(shelterId, photo.id);
      clearDefaultPhoto(shelterId, photo.id + 999);
      const row = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number | null };
      expect(row.default_photo_id).toBe(photo.id);
    });

    it('is a no-op when default_photo_id is already null', () => {
      clearDefaultPhoto(shelterId, 42);
      const row = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number | null };
      expect(row.default_photo_id).toBeNull();
    });
  });
});
