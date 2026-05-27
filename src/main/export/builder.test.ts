import { stripMarkdown, buildManifest } from './builder';
import path from 'path';
import os from 'os';
import fs from 'fs';
import Database from 'better-sqlite3';

jest.mock('../db/connection');

const { getDb } = jest.requireMock('../db/connection') as { getDb: jest.Mock };

// Minimal schema needed for builder tests
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS shelters (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    start_year INTEGER,
    end_year INTEGER,
    description TEXT DEFAULT '',
    default_photo_id INTEGER,
    is_gmc INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created TEXT DEFAULT '',
    updated TEXT DEFAULT '',
    is_extant INTEGER DEFAULT 1,
    show_on_web INTEGER DEFAULT 0,
    architecture_id INTEGER,
    category_id INTEGER,
    builder_id INTEGER,
    history TEXT
  );
  CREATE TABLE IF NOT EXISTS architectures (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    category_name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS builders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY,
    photographer TEXT DEFAULT '',
    file_name TEXT NOT NULL,
    caption TEXT DEFAULT '',
    date_taken TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created TEXT DEFAULT '',
    updated TEXT DEFAULT '',
    shelter_id INTEGER NOT NULL,
    alt_text TEXT DEFAULT '',
    title TEXT DEFAULT '',
    description TEXT DEFAULT '',
    include_in_post INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS map_markers (
    id INTEGER PRIMARY KEY,
    shelter_id INTEGER NOT NULL,
    latitude REAL,
    longitude REAL,
    name TEXT DEFAULT '',
    start_year INTEGER,
    end_year INTEGER,
    change_type TEXT DEFAULT 'Original',
    is_extant INTEGER DEFAULT 1,
    notes TEXT DEFAULT ''
  );
`;

describe('stripMarkdown', () => {
  it('strips headings', () => {
    expect(stripMarkdown('### Title')).toBe('Title');
    expect(stripMarkdown('## Section')).toBe('Section');
    expect(stripMarkdown('# H1')).toBe('H1');
  });

  it('strips bold and italic', () => {
    expect(stripMarkdown('**bold**')).toBe('bold');
    expect(stripMarkdown('*italic*')).toBe('italic');
    expect(stripMarkdown('__bold__')).toBe('bold');
    expect(stripMarkdown('_italic_')).toBe('italic');
  });

  it('strips bullet list markers', () => {
    expect(stripMarkdown('- item')).toBe('item');
    expect(stripMarkdown('* item')).toBe('item');
  });

  it('extracts link text', () => {
    expect(stripMarkdown('[text](url)')).toBe('text');
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here');
  });

  it('removes inline citations like [GB 9th Edition]', () => {
    expect(stripMarkdown('[GB 9th Edition]')).toBe('');
    expect(stripMarkdown('See [USFS Report]')).toBe('See');
  });

  it('passes plain text through unchanged', () => {
    expect(stripMarkdown('plain text')).toBe('plain text');
    expect(stripMarkdown('')).toBe('');
  });

  it('handles multi-line markdown', () => {
    const input = '# Title\n\nSome **bold** text.\n\n- item one\n- item two';
    const output = stripMarkdown(input);
    expect(output).toContain('Title');
    expect(output).toContain('bold');
    expect(output).not.toContain('#');
    expect(output).not.toContain('**');
  });
});

describe('buildManifest', () => {
  let db: ReturnType<typeof Database>;
  let tmpDir: string;
  let repoRoot: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    getDb.mockReturnValue(db);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-test-'));
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  function insertShelter(overrides: Record<string, unknown> = {}) {
    const slug = (overrides.slug as string) ?? 'test-shelter';
    const defaults = {
      name: 'Test Shelter',
      slug,
      start_year: 1970,
      end_year: null,
      description: 'A shelter',
      default_photo_id: null,
      is_gmc: 1,
      notes: '',
      created: '2024-01-01',
      updated: '2026-01-01',
      is_extant: 1,
      show_on_web: 1,
      architecture_id: null,
      category_id: null,
      builder_id: null,
      history: `${slug}/${slug}.md`,
      ...overrides,
    };
    db.prepare(`INSERT INTO shelters (name,slug,start_year,end_year,description,default_photo_id,is_gmc,notes,created,updated,is_extant,show_on_web,architecture_id,category_id,builder_id,history)
      VALUES (@name,@slug,@start_year,@end_year,@description,@default_photo_id,@is_gmc,@notes,@created,@updated,@is_extant,@show_on_web,@architecture_id,@category_id,@builder_id,@history)`).run(defaults);
    return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  }

  function insertPhoto(shelterId: number, overrides: Record<string, unknown> = {}) {
    const defaults = {
      photographer: '',
      file_name: 'photo.jpg',
      caption: '',
      date_taken: '',
      notes: '',
      created: '2024-01-01',
      updated: '2026-01-01',
      shelter_id: shelterId,
      alt_text: '',
      title: '',
      description: '',
      include_in_post: 1,
      ...overrides,
    };
    db.prepare(`INSERT INTO photos (photographer,file_name,caption,date_taken,notes,created,updated,shelter_id,alt_text,title,description,include_in_post)
      VALUES (@photographer,@file_name,@caption,@date_taken,@notes,@created,@updated,@shelter_id,@alt_text,@title,@description,@include_in_post)`).run(defaults);
  }

  function insertMapMarker(shelterId: number, overrides: Record<string, unknown> = {}) {
    const defaults = {
      shelter_id: shelterId,
      latitude: 43.0,
      longitude: -72.0,
      name: 'Test Shelter',
      start_year: 1970,
      end_year: null,
      change_type: 'Original',
      is_extant: 1,
      notes: '',
      ...overrides,
    };
    db.prepare(`INSERT INTO map_markers (shelter_id,latitude,longitude,name,start_year,end_year,change_type,is_extant,notes)
      VALUES (@shelter_id,@latitude,@longitude,@name,@start_year,@end_year,@change_type,@is_extant,@notes)`).run(defaults);
  }

  it('excludes shelters with show_on_web=0', async () => {
    insertShelter({ show_on_web: 0 });
    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters).toHaveLength(0);
    expect(result.shelterCount).toBe(0);
  });

  it('includes shelters with show_on_web=1 with camelCase fields', async () => {
    insertShelter({ show_on_web: 1, name: 'My Shelter', slug: 'my-shelter' });
    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters).toHaveLength(1);
    expect(result.shelterCount).toBe(1);
    const s = result.manifest.shelters[0];
    expect(s.name).toBe('My Shelter');
    expect(s.slug).toBe('my-shelter');
    expect(s.startYear).toBeDefined();
    expect(s.isGmc).toBeDefined();
    expect(s.isExtant).toBeDefined();
  });

  it('includes photo with include_in_post=1 and file on disk', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'photo.jpg', include_in_post: 1, updated: '2026-05-01' });

    // Create the shelter dir and photo file on disk
    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'photo.jpg'), 'fake');

    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos).toHaveLength(1);
    expect(result.photoCount).toBe(1);
    expect(result.manifest.shelters[0].photos[0].updated).toBe('2026-05-01');
  });

  it('excludes photo with include_in_post=0 even if file exists', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'photo.jpg', include_in_post: 0 });

    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'photo.jpg'), 'fake');

    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos).toHaveLength(0);
  });

  it('skips photo with include_in_post=1 but absent from disk', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'missing.jpg', include_in_post: 1 });

    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos).toHaveLength(0);
    expect(result.skippedPhotos).toBe(1);
  });

  it('sets history, historyFile and historyUpdated when .md exists', async () => {
    insertShelter({ slug: 'test-shelter' });

    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    const mdPath = path.join(shelterDir, 'test-shelter.md');
    fs.writeFileSync(mdPath, '# History');

    const result = await buildManifest(repoRoot, tmpDir);
    const s = result.manifest.shelters[0];
    expect(s.history).toBe('test-shelter/test-shelter.md');
    expect(s.historyFile).toBe('test-shelter/test-shelter.md');
    expect(s.historyUpdated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('sets historyFile and historyUpdated to null when .md absent', async () => {
    insertShelter({ slug: 'test-shelter' });
    const result = await buildManifest(repoRoot, tmpDir);
    const s = result.manifest.shelters[0];
    expect(s.history).toBe('test-shelter/test-shelter.md');
    expect(s.historyFile).toBeNull();
    expect(s.historyUpdated).toBeNull();
  });

  it('includes shelter.updated from DB', async () => {
    insertShelter({ slug: 'test-shelter', updated: '2026-03-15' });
    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].updated).toBe('2026-03-15');
  });

  it('sources map markers from map_markers table', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertMapMarker(shelterId, { latitude: 44.0, longitude: -73.0 });
    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].mapMarkers).toHaveLength(1);
    expect(result.manifest.shelters[0].mapMarkers[0].latitude).toBe(44.0);
  });

  it('includes created ISO 8601 timestamp at manifest top level', async () => {
    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('denormalises slug and defaultPhotoId from shelter into MapMarkerEntry', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter', default_photo_id: 99 });
    insertMapMarker(shelterId);
    const result = await buildManifest(repoRoot, tmpDir);
    const marker = result.manifest.shelters[0].mapMarkers[0];
    expect(marker.slug).toBe('test-shelter');
    expect(marker.defaultPhotoId).toBe(99);
  });
});
