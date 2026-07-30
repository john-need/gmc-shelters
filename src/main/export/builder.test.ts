import { stripMarkdown, buildManifest, buildSheltersJson } from './builder';
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
    name TEXT NOT NULL,
    description TEXT,
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    category_name TEXT NOT NULL,
    description TEXT,
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS builders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'organization',
    notes TEXT DEFAULT '',
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY,
    type TEXT DEFAULT 'other',
    author TEXT DEFAULT '',
    title TEXT DEFAULT '',
    container_title TEXT DEFAULT '',
    container_author TEXT DEFAULT '',
    editor TEXT DEFAULT '',
    edition TEXT DEFAULT '',
    volume TEXT DEFAULT '',
    issue TEXT DEFAULT '',
    pages TEXT DEFAULT '',
    publisher TEXT DEFAULT '',
    place TEXT DEFAULT '',
    year INTEGER,
    date TEXT DEFAULT '',
    url TEXT DEFAULT '',
    access_date TEXT DEFAULT '',
    archive TEXT DEFAULT '',
    archive_location TEXT DEFAULT '',
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS shelter_sources (
    shelter_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    annotation TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    quote TEXT DEFAULT '',
    include_in_history INTEGER DEFAULT 0
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
    include_in_post INTEGER DEFAULT 0,
    sort_order INTEGER
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
    notes TEXT DEFAULT '',
    photo_id INTEGER,
    created TEXT DEFAULT '',
    updated TEXT DEFAULT ''
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
      sort_order: 1,
      ...overrides,
    };
    db.prepare(`INSERT INTO photos (photographer,file_name,caption,date_taken,notes,created,updated,shelter_id,alt_text,title,description,include_in_post,sort_order)
     VALUES (@photographer,@file_name,@caption,@date_taken,@notes,@created,@updated,@shelter_id,@alt_text,@title,@description,@include_in_post,@sort_order)`).run(defaults);
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
    insertPhoto(shelterId, { file_name: 'test-shelter/photo.jpg', include_in_post: 1, updated: '2026-05-01' });

    // Create the shelter dir and photo file on disk
    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'photo.jpg'), 'fake');

    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos).toHaveLength(1);
    expect(result.photoCount).toBe(1);
    expect(result.manifest.shelters[0].photos[0].updated).toBe('2026-05-01');
  });

  it('orders manifest photos by shelter photo order', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'test-shelter/third.jpg', include_in_post: 1, sort_order: 3 });
    insertPhoto(shelterId, { file_name: 'test-shelter/first.jpg', include_in_post: 1, sort_order: 1 });
    insertPhoto(shelterId, { file_name: 'test-shelter/second.jpg', include_in_post: 1, sort_order: 2 });

    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'first.jpg'), 'first');
    fs.writeFileSync(path.join(shelterDir, 'second.jpg'), 'second');
    fs.writeFileSync(path.join(shelterDir, 'third.jpg'), 'third');

    const result = await buildManifest(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos.map((photo) => photo.fileName)).toEqual([
      'test-shelter/first.jpg',
      'test-shelter/second.jpg',
      'test-shelter/third.jpg',
    ]);
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

  it('sets history with filePath and updated when .md exists', async () => {
    insertShelter({ slug: 'test-shelter' });

    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    const mdPath = path.join(shelterDir, 'test-shelter.md');
    fs.writeFileSync(mdPath, '# History');

    const result = await buildManifest(repoRoot, tmpDir);
    const s = result.manifest.shelters[0];
    expect(s.history).not.toBeNull();
    expect(s.history!.filePath).toBe('test-shelter/test-shelter.md');
    expect(s.history!.updated).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(s.history!.driveFileId).toBeNull();
  });

  it('sets history to null when .md absent', async () => {
    insertShelter({ slug: 'test-shelter' });
    const result = await buildManifest(repoRoot, tmpDir);
    const s = result.manifest.shelters[0];
    expect(s.history).toBeNull();
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

  // T030: contract test — driveFileId is present and nullable on each PhotoEntry
  it('manifest contract: PhotoEntry has driveFileId (null on first build)', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'test-shelter/photo.jpg', include_in_post: 1 });

    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'photo.jpg'), 'fake');

    const result = await buildManifest(repoRoot, tmpDir);
    const photo = result.manifest.shelters[0].photos[0];

    // driveFileId must be present as an own property and must be null before first publish
    expect(Object.prototype.hasOwnProperty.call(photo, 'driveFileId')).toBe(true);
    expect(photo.driveFileId).toBeNull();
  });

  it('manifest contract: required fields are present on ShelterEntry', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter', is_extant: 1 });
    insertMapMarker(shelterId);
    const result = await buildManifest(repoRoot, tmpDir);
    const s = result.manifest.shelters[0];

    expect(s).toHaveProperty('id');
    expect(s).toHaveProperty('name');
    expect(s).toHaveProperty('slug');
    expect(s).toHaveProperty('startYear');
    expect(s).toHaveProperty('isExtant');
    expect(s).toHaveProperty('photos');
    expect(s).toHaveProperty('mapMarkers');
    expect(result.manifest).toHaveProperty('created');
  });
});

describe('buildSheltersJson', () => {
  let db: ReturnType<typeof Database>;
  let tmpDir: string;
  let repoRoot: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(SCHEMA);
    getDb.mockReturnValue(db);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'export-shelters-json-test-'));
    repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-shelters-json-test-'));
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  function insertShelter(overrides: Record<string, unknown> = {}) {
    const slug = (overrides.slug as string) ?? 'test-shelter';
    const defaults = {
      name: 'Test Shelter', slug, start_year: 1970, end_year: null, description: 'A shelter',
      default_photo_id: null, is_gmc: 1, notes: '', created: '2024-01-01', updated: '2026-01-01',
      is_extant: 1, show_on_web: 1, architecture_id: null, category_id: null, builder_id: null,
      history: `${slug}/${slug}.md`,
      ...overrides,
    };
    db.prepare(`INSERT INTO shelters (name,slug,start_year,end_year,description,default_photo_id,is_gmc,notes,created,updated,is_extant,show_on_web,architecture_id,category_id,builder_id,history)
      VALUES (@name,@slug,@start_year,@end_year,@description,@default_photo_id,@is_gmc,@notes,@created,@updated,@is_extant,@show_on_web,@architecture_id,@category_id,@builder_id,@history)`).run(defaults);
    return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  }

  function insertPhoto(shelterId: number, overrides: Record<string, unknown> = {}) {
    const defaults = {
      photographer: '', file_name: 'photo.jpg', caption: '', date_taken: '', notes: '',
      created: '2024-01-01', updated: '2026-01-01', shelter_id: shelterId, alt_text: '', title: '',
      description: '', include_in_post: 1, sort_order: 1,
      ...overrides,
    };
    db.prepare(`INSERT INTO photos (photographer,file_name,caption,date_taken,notes,created,updated,shelter_id,alt_text,title,description,include_in_post,sort_order)
      VALUES (@photographer,@file_name,@caption,@date_taken,@notes,@created,@updated,@shelter_id,@alt_text,@title,@description,@include_in_post,@sort_order)`).run(defaults);
  }

  function insertMapMarker(shelterId: number, overrides: Record<string, unknown> = {}) {
    const defaults = {
      shelter_id: shelterId, latitude: 43.0, longitude: -72.0, name: 'Test Shelter', start_year: 1970,
      end_year: null, change_type: 'Original', is_extant: 1, notes: '', photo_id: null,
      created: '2024-01-01', updated: '2026-01-01',
      ...overrides,
    };
    db.prepare(`INSERT INTO map_markers (shelter_id,latitude,longitude,name,start_year,end_year,change_type,is_extant,notes,photo_id,created,updated)
      VALUES (@shelter_id,@latitude,@longitude,@name,@start_year,@end_year,@change_type,@is_extant,@notes,@photo_id,@created,@updated)`).run(defaults);
  }

  function insertArchitecture(overrides: Record<string, unknown> = {}) {
    const defaults = { name: 'Log Cabin', description: '', created: '2024-01-01', updated: '2026-01-01', ...overrides };
    db.prepare(`INSERT INTO architectures (name,description,created,updated) VALUES (@name,@description,@created,@updated)`).run(defaults);
    return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  }

  function insertCategory(overrides: Record<string, unknown> = {}) {
    const defaults = { category_name: 'Lodge', description: '', created: '2024-01-01', updated: '2026-01-01', ...overrides };
    db.prepare(`INSERT INTO categories (category_name,description,created,updated) VALUES (@category_name,@description,@created,@updated)`).run(defaults);
    return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  }

  function insertBuilder(overrides: Record<string, unknown> = {}) {
    const defaults = { name: 'GMC', type: 'organization', notes: '', created: '2024-01-01', updated: '2026-01-01', ...overrides };
    db.prepare(`INSERT INTO builders (name,type,notes,created,updated) VALUES (@name,@type,@notes,@created,@updated)`).run(defaults);
    return (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
  }

  function insertSource(shelterId: number, overrides: Record<string, unknown> = {}) {
    const defaults = {
      type: 'book', author: 'Smith, J.', title: 'A Book', container_title: '', container_author: '',
      editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
      year: 1963, date: '', url: '', access_date: '', archive: '', archive_location: '',
      created: '2024-01-01', updated: '2026-01-01',
      ...overrides,
    };
    db.prepare(`INSERT INTO sources (type,author,title,container_title,container_author,editor,edition,volume,issue,pages,publisher,place,year,date,url,access_date,archive,archive_location,created,updated)
      VALUES (@type,@author,@title,@container_title,@container_author,@editor,@edition,@volume,@issue,@pages,@publisher,@place,@year,@date,@url,@access_date,@archive,@archive_location,@created,@updated)`).run(defaults);
    const sourceId = (db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number }).id;
    db.prepare(`INSERT INTO shelter_sources (shelter_id, source_id, annotation, notes, quote, include_in_history) VALUES (?, ?, '', '', '', 0)`)
      .run(shelterId, sourceId);
    return sourceId;
  }

  // FR-001/FR-002: shelters.json with the four top-level arrays, built via makeShelter
  it('writes shelters.json (not shelter-manifest.json) with the four top-level arrays', async () => {
    insertShelter();
    await buildSheltersJson(repoRoot, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'shelters.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'shelter-manifest.json'))).toBe(false);
    const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'shelters.json'), 'utf-8'));
    expect(written).toHaveProperty('shelters');
    expect(written).toHaveProperty('architectures');
    expect(written).toHaveProperty('shelterCategories');
    expect(written).toHaveProperty('builders');
  });

  // FR-004: reference arrays list every record, independent of shelter references
  it('lists every architecture/category/builder even when no shelter references it', async () => {
    insertArchitecture({ name: 'Unreferenced Style' });
    insertCategory({ category_name: 'Unreferenced Category' });
    insertBuilder({ name: 'Unreferenced Builder' });
    insertShelter();

    const result = await buildSheltersJson(repoRoot, tmpDir);
    expect(result.manifest.architectures.map((a) => a.name)).toContain('Unreferenced Style');
    expect(result.manifest.shelterCategories.map((c) => c.categoryName)).toContain('Unreferenced Category');
    expect(result.manifest.builders.map((b) => b.name)).toContain('Unreferenced Builder');
  });

  // FR-006: no show_on_web / include_in_post filtering
  it('includes a shelter with show_on_web=0', async () => {
    insertShelter({ show_on_web: 0 });
    const result = await buildSheltersJson(repoRoot, tmpDir);
    expect(result.manifest.shelters).toHaveLength(1);
  });

  it('includes a photo with include_in_post=0, as long as its file exists on disk', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'test-shelter/photo.jpg', include_in_post: 0 });
    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'photo.jpg'), 'fake');

    const result = await buildSheltersJson(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos).toHaveLength(1);
    expect(result.manifest.shelters[0].photos[0].includeInPost).toBe(false);
  });

  // FR-003: nested photos/sources/mapMarkers via the shared factories; FR-005/SC-003: photo
  // files are physically copied into the shelter's slug-named folder, not just referenced in JSON
  it('nests photos/sources/mapMarkers per shelter and copies photo files into tmpDir/{slug}/', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'test-shelter/photo.jpg' });
    insertSource(shelterId, { author: 'Doe, J.' });
    insertMapMarker(shelterId, { latitude: 44.5 });
    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'photo.jpg'), 'fake-bytes');

    const result = await buildSheltersJson(repoRoot, tmpDir);
    const shelter = result.manifest.shelters[0];

    expect(shelter.photos).toHaveLength(1);
    expect(shelter.photos[0].fileName).toBe('test-shelter/photo.jpg');
    expect(shelter.sources).toHaveLength(1);
    expect(shelter.sources[0].author).toBe('Doe, J.');
    expect(shelter.mapMarkers).toHaveLength(1);
    expect(shelter.mapMarkers[0].latitude).toBe(44.5);

    // the photo FILE itself, not just the JSON reference
    const copiedPhotoPath = path.join(tmpDir, 'test-shelter', 'photo.jpg');
    expect(fs.existsSync(copiedPhotoPath)).toBe(true);
    expect(fs.readFileSync(copiedPhotoPath, 'utf-8')).toBe('fake-bytes');
  });

  // FR-011: history .md file still copied into the shelter's folder
  it('copies the shelter history .md file into tmpDir/{slug}/ and records its path', async () => {
    insertShelter({ slug: 'test-shelter' });
    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'test-shelter.md'), '# History');

    const result = await buildSheltersJson(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].history).toBe('test-shelter/test-shelter.md');
    expect(fs.existsSync(path.join(tmpDir, 'test-shelter', 'test-shelter.md'))).toBe(true);
  });

  it('sets history to null when no .md file exists on disk', async () => {
    insertShelter({ slug: 'test-shelter' });
    const result = await buildSheltersJson(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].history).toBeNull();
  });

  // FR-003/SC-002 (User Story 2): every combination of missing relations/empty lists still
  // produces the same complete field set — null relations, empty-array lists, never omitted
  it('represents every unassigned relation as null and every empty list as [] — never omitted', async () => {
    insertShelter({ slug: 'no-relations', architecture_id: null, category_id: null, builder_id: null });

    const result = await buildSheltersJson(repoRoot, tmpDir);
    const shelter = result.manifest.shelters[0];

    expect(shelter.architecture).toBeNull();
    expect(shelter.builder).toBeNull();
    expect(shelter.category).toBeNull();
    expect(shelter.photos).toEqual([]);
    expect(shelter.sources).toEqual([]);
    expect(shelter.mapMarkers).toEqual([]);
  });

  it('represents assigned architecture/builder/category as nested objects, not just ids', async () => {
    const architectureId = insertArchitecture({ name: 'Post and Beam' });
    const categoryId = insertCategory({ category_name: 'Camp' });
    const builderId = insertBuilder({ name: 'Ansel Guyette' });
    insertShelter({ architecture_id: architectureId, category_id: categoryId, builder_id: builderId });

    const result = await buildSheltersJson(repoRoot, tmpDir);
    const shelter = result.manifest.shelters[0];

    expect(shelter.architecture).toEqual(expect.objectContaining({ name: 'Post and Beam' }));
    expect(shelter.category).toEqual(expect.objectContaining({ categoryName: 'Camp' }));
    expect(shelter.builder).toEqual(expect.objectContaining({ name: 'Ansel Guyette' }));
  });

  // FR-007/SC-004: missing photo file is skipped, export continues, count is accurate
  it('skips a photo whose file is missing from disk and reports the skip count', async () => {
    const shelterId = insertShelter({ slug: 'test-shelter' });
    insertPhoto(shelterId, { file_name: 'test-shelter/missing.jpg' });
    insertPhoto(shelterId, { file_name: 'test-shelter/present.jpg' });
    const shelterDir = path.join(repoRoot, 'shelters', 'test-shelter');
    fs.mkdirSync(shelterDir, { recursive: true });
    fs.writeFileSync(path.join(shelterDir, 'present.jpg'), 'fake');

    const result = await buildSheltersJson(repoRoot, tmpDir);
    expect(result.manifest.shelters[0].photos).toHaveLength(1);
    expect(result.manifest.shelters[0].photos[0].fileName).toBe('test-shelter/present.jpg');
    expect(result.skippedPhotos).toBe(1);
    expect(result.photoCount).toBe(1);
  });
});
