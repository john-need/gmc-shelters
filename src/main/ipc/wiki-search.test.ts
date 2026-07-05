// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper;
// no jest.mock() here — automocking would strip the mock's instance fields.
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { CHANNELS } from '@shared/ipc-types';
import type { WikiSearchResult, WikiHeaderPayload } from '@shared/ipc-types';
import { parseFrontmatter, serializeFrontmatter } from './wiki-search';

type ElectronMock = {
  ipcMain: { handle: jest.Mock };
  app: { getAppPath: jest.Mock };
  BrowserWindow: { instances: Array<{ loadURL: jest.Mock }> };
};

function buildFixtureDb(dir: string) {
  fs.mkdirSync(path.join(dir, 'wiki'), { recursive: true });
  const db = new Database(path.join(dir, 'wiki', 'search.db'));
  db.exec(`
    CREATE VIRTUAL TABLE wiki_fts USING fts5(
      path UNINDEXED, okf_type UNINDEXED, title, publisher UNINDEXED,
      volume UNINDEXED, edition UNINDEXED, printed_volume UNINDEXED,
      printed_issue UNINDEXED, resource UNINDEXED, citation_type UNINDEXED,
      kind UNINDEXED, page UNINDEXED, image UNINDEXED, body,
      tokenize = "porter unicode61"
    )
  `);
  const insert = db.prepare('INSERT INTO wiki_fts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  insert.run(
    'long-trail-news/1922_12_Dec.md', 'Newsletter', 'Long Trail News',
    'Green Mountain Club', '1922', 'December', '5', '2',
    'collections/long-trail-news/1922_12_Dec.pdf', 'magazine', 'page', '2', '',
    'Monroe Lodge will be built on Camels Hump next year.',
  );
  insert.run(
    'long-trail-news/1922_12_Dec.md', 'Newsletter', 'Long Trail News',
    'Green Mountain Club', '1922', 'December', '5', '2',
    'collections/long-trail-news/1922_12_Dec.pdf', 'magazine', 'illustration', '2',
    'long-trail-news/images/1922_12_Dec_p2_0.png',
    'Monroe Lodge under construction',
  );
  db.close();
}

describe('ipc/wiki-search', () => {
  let tmpDir: string;
  let electron: ElectronMock;

  beforeEach(() => {
    // resetModules gives wiki-search.ts fresh module state (its cached db handle)
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-search-test-'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    electron = require('electron') as ElectronMock;
    electron.app.getAppPath.mockReturnValue(tmpDir);
    electron.BrowserWindow.instances.length = 0;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function register() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerWikiSearchHandlers } = require('./wiki-search');
    registerWikiSearchHandlers();
  }

  function getHandler(channel: string) {
    const call = electron.ipcMain.handle.mock.calls.find(([ch]) => ch === channel);
    if (!call) throw new Error(`No handler registered for ${channel}`);
    return call[1] as (...args: unknown[]) => unknown;
  }

  it('search results carry page number and publication metadata', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    const results = (await handler(null, 'Monroe Lodge')) as WikiSearchResult[];
    const pageHit = results.find((r) => r.kind === 'page');
    expect(pageHit).toBeDefined();
    expect(pageHit!.page).toBe(2);
    expect(pageHit!.publisher).toBe('Green Mountain Club');
    expect(pageHit!.volume).toBe('1922');
    expect(pageHit!.edition).toBe('December');
    expect(pageHit!.printed_volume).toBe('5');
    expect(pageHit!.printed_issue).toBe('2');
    expect(pageHit!.resource).toBe('collections/long-trail-news/1922_12_Dec.pdf');
    expect(pageHit!.citation_type).toBe('magazine');
    expect(pageHit!.snippet).toContain('<mark>');
  });

  it('illustration results carry kind and image path', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    const results = (await handler(null, 'construction')) as WikiSearchResult[];
    const ill = results.find((r) => r.kind === 'illustration');
    expect(ill).toBeDefined();
    expect(ill!.image).toBe('long-trail-news/images/1922_12_Dec_p2_0.png');
    expect(ill!.page).toBe(2);
  });

  it('returns empty list for blank query and missing index', async () => {
    register(); // no db built
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    expect(await handler(null, '')).toEqual([]);
    expect(await handler(null, 'anything')).toEqual([]);
  });

  it('WIKI_OPEN_PDF opens a window at the requested page', async () => {
    register();
    const pdfPath = path.join(tmpDir, 'collections', 'long-trail-news', '1922_12_Dec.pdf');
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.writeFileSync(pdfPath, 'fake pdf bytes');
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: 'collections/long-trail-news/1922_12_Dec.pdf', page: 3 });
    expect(result).toEqual({ ok: true });
    const instances = electron.BrowserWindow.instances;
    expect(instances).toHaveLength(1);
    const url = instances[0].loadURL.mock.calls[0][0] as string;
    expect(url).toMatch(/^file:\/\//);
    expect(url).toContain('1922_12_Dec.pdf#page=3');
  });

  it('WIKI_OPEN_PDF returns ok:false and opens no window when the PDF is missing on disk', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: 'collections/long-trail-news/does-not-exist.pdf', page: 1 });
    expect(result).toEqual({ ok: false });
    expect(electron.BrowserWindow.instances).toHaveLength(0);
  });

  it('WIKI_OPEN_PDF rejects paths outside the collections folder', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: '../../etc/passwd', page: 1 });
    expect(result).toEqual({ ok: false });
    const instances = electron.BrowserWindow.instances;
    expect(instances).toHaveLength(0);
  });

  it('WIKI_INDEX_REPORT reads the last build report', async () => {
    fs.mkdirSync(path.join(tmpDir, 'wiki'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'wiki', 'index-report.json'),
      JSON.stringify({ indexed: 40, skipped: 3, builtAt: '2026-07-02T00:00:00Z' }),
    );
    register();
    const handler = getHandler(CHANNELS.WIKI_INDEX_REPORT);
    expect(await handler(null)).toEqual({ indexed: 40, skipped: 3, builtAt: '2026-07-02T00:00:00Z' });
  });

  it('WIKI_INDEX_REPORT returns null when no report has been built yet', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_INDEX_REPORT);
    expect(await handler(null)).toBeNull();
  });

  function writeWikiDoc(resource: string, frontmatter: string, extra = '') {
    const collection = resource.split('/')[1];
    const stem = path.basename(resource, '.pdf');
    const mdDir = path.join(tmpDir, 'wiki', collection);
    fs.mkdirSync(mdDir, { recursive: true });
    fs.writeFileSync(
      path.join(mdDir, `${stem}.md`),
      `${frontmatter}\n<!-- page: 1 -->\nBody.\n${extra}`,
    );
  }

  const FULL_HEADER = [
    '---',
    'type: "Newsletter"',
    'citation_type: "magazine"',
    'title: "Long Trail News"',
    'description: "Long Trail News, April 1923."',
    'resource: "collections/Long Trail News/1923_04_Apr.pdf"',
    'timestamp: "2026-07-02T00:00:00Z"',
    'publisher: "Green Mountain Club"',
    'pages: "8"',
    'language: "en"',
    '---',
    '',
  ].join('\n');

  describe('parseFrontmatter / serializeFrontmatter', () => {
    it('parses a fenced frontmatter block into fields, stripping quotes', () => {
      const { fields } = parseFrontmatter('---\ntitle: "Hello"\npages: "3"\n---\nbody text');
      expect(fields).toEqual({ title: 'Hello', pages: '3' });
    });

    it('returns no fields for text with no frontmatter fences', () => {
      expect(parseFrontmatter('just a body, no fences').fields).toEqual({});
    });

    it('serializes fields into a fenced block with one key/value line each', () => {
      const block = serializeFrontmatter({ title: 'Hello', pages: '3' });
      expect(block).toBe('---\ntitle: "Hello"\npages: "3"\n---\n');
    });

    it('round-trips values containing embedded quotes', () => {
      const fields = { title: 'A "Quoted" Title' };
      expect(parseFrontmatter(serializeFrontmatter(fields)).fields).toEqual(fields);
    });
  });

  it('WIKI_GET_HEADER returns a structured payload for an added file', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', FULL_HEADER);
    register();
    const handler = getHandler(CHANNELS.WIKI_GET_HEADER);
    const payload = (await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
    })) as WikiHeaderPayload;
    expect(payload.citationType).toBe('magazine');
    expect(payload.fields.title).toBe('Long Trail News');
    expect(payload.fields.publisher).toBe('Green Mountain Club');
    expect(payload.preserved).toEqual({
      type: 'Newsletter',
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      timestamp: '2026-07-02T00:00:00Z',
      pages: '8',
    });
  });

  it('WIKI_GET_HEADER returns null when the file has not been added to the wiki yet', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_GET_HEADER);
    const payload = await handler(null, { resource: 'collections/Long Trail News/never-added.pdf' });
    expect(payload).toBeNull();
  });

  it('WIKI_GET_HEADER still returns a payload when the on-disk citation type is unrecognized', async () => {
    const header = FULL_HEADER.replace('citation_type: "magazine"', 'citation_type: "not-a-real-type"');
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', header);
    register();
    const handler = getHandler(CHANNELS.WIKI_GET_HEADER);
    const payload = (await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
    })) as WikiHeaderPayload;
    expect(payload.citationType).toBe('not-a-real-type');
    expect(payload.fields.title).toBe('Long Trail News');
  });

  it('WIKI_GET_HEADER returns an empty string for a property missing from the on-disk header', async () => {
    const header = FULL_HEADER.split('\n').filter((l) => !l.startsWith('publisher:')).join('\n');
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', header);
    register();
    const handler = getHandler(CHANNELS.WIKI_GET_HEADER);
    const payload = (await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
    })) as WikiHeaderPayload;
    expect(payload.fields.publisher).toBe('');
  });

  it('WIKI_SAVE_HEADER validates, rewrites the frontmatter, and preserves the body', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', FULL_HEADER);
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const result = await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      citationType: 'magazine',
      fields: {
        title: 'Long Trail News — Revised',
        description: 'Long Trail News, April 1923.',
        language: 'en',
        publisher: 'Green Mountain Club',
      },
    });
    expect(result).toEqual({ ok: true });
    const saved = fs.readFileSync(
      path.join(tmpDir, 'wiki', 'Long Trail News', '1923_04_Apr.md'), 'utf-8',
    );
    expect(saved).toContain('title: "Long Trail News — Revised"');
    // preserved fields round-trip unchanged
    expect(saved).toContain('type: "Newsletter"');
    expect(saved).toContain('resource: "collections/Long Trail News/1923_04_Apr.pdf"');
    expect(saved).toContain('timestamp: "2026-07-02T00:00:00Z"');
    expect(saved).toContain('pages: "8"');
    expect(saved).toContain('Body.');
  });

  it('WIKI_SAVE_HEADER rejects a payload missing a required property and does not modify the file', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', FULL_HEADER);
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const before = fs.readFileSync(
      path.join(tmpDir, 'wiki', 'Long Trail News', '1923_04_Apr.md'), 'utf-8',
    );
    const result = (await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      citationType: 'magazine',
      fields: { title: '', description: 'x', language: 'en', publisher: 'GMC' },
    })) as { ok: boolean; errors?: string[] };
    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
    const after = fs.readFileSync(
      path.join(tmpDir, 'wiki', 'Long Trail News', '1923_04_Apr.md'), 'utf-8',
    );
    expect(after).toBe(before);
  });

  it('WIKI_SAVE_HEADER fails when the file has not been added to the wiki yet', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const result = await handler(null, {
      resource: 'collections/Long Trail News/never-added.pdf',
      citationType: 'magazine',
      fields: { title: 'x', description: 'x', language: 'en' },
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not been added') });
  });
});
