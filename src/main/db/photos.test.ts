import Database from 'better-sqlite3';
import { getPhotosByShelter, updatePhoto, deletePhoto, setDefaultPhoto, insertPhoto, clearDefaultPhoto, reorderPhotos, movePhotoToShelter } from './photos';

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
    shelter_id INTEGER REFERENCES shelters(id), file_name TEXT, title TEXT,
    photographer TEXT DEFAULT '', caption TEXT DEFAULT '',
    date_taken TEXT, notes TEXT DEFAULT '', alt_text TEXT DEFAULT '',
    description TEXT DEFAULT '', include_in_post INTEGER DEFAULT 0, sort_order INTEGER,
    created TEXT, updated TEXT
  );
  CREATE TABLE map_markers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shelter_id INTEGER NOT NULL REFERENCES shelters(id),
    photo_id INTEGER REFERENCES photos(id),
    latitude REAL, longitude REAL, name TEXT,
    start_year INTEGER, end_year INTEGER, change_type TEXT,
    notes TEXT, is_extant INTEGER, created TEXT, updated TEXT
  );
  PRAGMA foreign_keys = ON;
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

  it('reorderPhotos persists shelter photo order', () => {
    const first = insertPhoto(shelterId, 'a.jpg');
    const second = insertPhoto(shelterId, 'b.jpg');
    const third = insertPhoto(shelterId, 'c.jpg');

    reorderPhotos(shelterId, [third.id, first.id, second.id]);

    expect(getPhotosByShelter(shelterId).map((photo) => photo.id)).toEqual([
      third.id,
      first.id,
      second.id,
    ]);
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

  it('updatePhoto preserves year-only date_taken values', () => {
    const created = insertPhoto(shelterId, 'year-only.jpg', 'Old Title');
    updatePhoto({
      id: created.id, shelter_id: shelterId,
      title: 'New Title', photographer: 'Jane',
      caption: 'A caption', date_taken: '1984',
      notes: 'some notes', alt_text: 'alt', description: 'desc',
      include_in_post: true, updated: '2020-01-01',
    });
    const photos = getPhotosByShelter(shelterId);
    const updated = photos.find((p) => p.id === created.id)!;
    expect(updated.date_taken).toBe('1984');
  });

  it('deletePhoto removes the photo', () => {
    const photo = insertPhoto(shelterId, 'del.jpg');
    deletePhoto(photo.id);
    expect(getPhotosByShelter(shelterId)).toHaveLength(0);
  });

  it('deletePhoto nulls map_markers.photo_id referencing the deleted photo', () => {
    const photo = insertPhoto(shelterId, 'marker-ref.jpg');
    db.prepare(
      `INSERT INTO map_markers (shelter_id, photo_id, latitude, longitude, name, start_year, change_type, notes, is_extant, created, updated)
       VALUES (?, ?, 44.0, -72.0, 'Test Marker', 1930, 'Original', '', 1, '2020-01-01', '2020-01-01')`,
    ).run(shelterId, photo.id);
    deletePhoto(photo.id);
    const marker = db.prepare('SELECT photo_id FROM map_markers WHERE shelter_id = ?').get(shelterId) as { photo_id: number | null };
    expect(marker.photo_id).toBeNull();
  });

  it('deletePhoto nulls shelters.default_photo_id when it references the deleted photo', () => {
    const photo = insertPhoto(shelterId, 'default-ref.jpg');
    db.prepare('UPDATE shelters SET default_photo_id = ? WHERE id = ?').run(photo.id, shelterId);
    deletePhoto(photo.id);
    const shelter = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number | null };
    expect(shelter.default_photo_id).toBeNull();
  });

  it('deletePhoto succeeds when the photo file is missing (Orphaned Photo Record)', () => {
    const photo = insertPhoto(shelterId, 'orphan.jpg');
    expect(() => deletePhoto(photo.id)).not.toThrow();
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

  describe('movePhotoToShelter', () => {
    let targetShelterId: number;

    beforeEach(() => {
      db.exec(`INSERT INTO shelters (name, slug, created, updated) VALUES ('Target', 'target', '2020-01-01', '2020-01-01')`);
      targetShelterId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;
    });

    it('updates shelter_id and file_name on the photo and returns the updated Photo', () => {
      const photo = insertPhoto(shelterId, 'test/photos/move-me.jpg');
      const returned = movePhotoToShelter(photo.id, targetShelterId, 'target/photos/move-me.jpg');
      expect(returned.id).toBe(photo.id);
      expect(returned.shelter_id).toBe(targetShelterId);
      expect(returned.file_name).toBe('target/photos/move-me.jpg');

      const moved = getPhotosByShelter(targetShelterId)[0];
      expect(moved.id).toBe(photo.id);
      expect(getPhotosByShelter(shelterId)).toHaveLength(0);
    });

    it('clears the source shelter default_photo_id when it referenced the moved photo', () => {
      const photo = insertPhoto(shelterId, 'default.jpg');
      setDefaultPhoto(shelterId, photo.id);
      movePhotoToShelter(photo.id, targetShelterId, 'target/photos/default.jpg');
      const shelter = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number | null };
      expect(shelter.default_photo_id).toBeNull();
    });

    it('does not touch the source default_photo_id when it referenced a different photo', () => {
      const keep = insertPhoto(shelterId, 'keep.jpg');
      const moving = insertPhoto(shelterId, 'moving.jpg');
      setDefaultPhoto(shelterId, keep.id);
      movePhotoToShelter(moving.id, targetShelterId, 'target/photos/moving.jpg');
      const shelter = db.prepare('SELECT default_photo_id FROM shelters WHERE id = ?').get(shelterId) as { default_photo_id: number | null };
      expect(shelter.default_photo_id).toBe(keep.id);
    });

    it('clears map_markers.photo_id referencing the moved photo', () => {
      const photo = insertPhoto(shelterId, 'marker.jpg');
      db.prepare(
        `INSERT INTO map_markers (shelter_id, photo_id, latitude, longitude, name, start_year, change_type, notes, is_extant, created, updated)
         VALUES (?, ?, 44.0, -72.0, 'Test Marker', 1930, 'Original', '', 1, '2020-01-01', '2020-01-01')`,
      ).run(shelterId, photo.id);
      movePhotoToShelter(photo.id, targetShelterId, 'target/photos/marker.jpg');
      const marker = db.prepare('SELECT photo_id FROM map_markers WHERE shelter_id = ?').get(shelterId) as { photo_id: number | null };
      expect(marker.photo_id).toBeNull();
    });

    it('runs as a single transaction: a failure leaves shelter_id unchanged', () => {
      const photo = insertPhoto(shelterId, 'atomic.jpg');
      expect(() => movePhotoToShelter(photo.id, 999999, 'target/photos/atomic.jpg')).toThrow();
      const unchanged = db.prepare('SELECT shelter_id FROM photos WHERE id = ?').get(photo.id) as { shelter_id: number };
      expect(unchanged.shelter_id).toBe(shelterId);
    });
  });
});
