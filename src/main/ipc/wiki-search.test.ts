// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper;
// no jest.mock() here — automocking would strip the mock's instance fields.
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';
import { CHANNELS } from '@shared/ipc-types';
import type { WikiSearchResult } from '@shared/ipc-types';

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

  function writeWikiDoc(resource: string, extra = '') {
    const collection = resource.split('/')[1];
    const stem = path.basename(resource, '.pdf');
    const mdDir = path.join(tmpDir, 'wiki', collection);
    fs.mkdirSync(mdDir, { recursive: true });
    fs.writeFileSync(
      path.join(mdDir, `${stem}.md`),
      `---\ntype: "Newsletter"\ntitle: "Long Trail News"\nresource: "${resource}"\n---\n\n<!-- page: 1 -->\nBody.\n${extra}`,
    );
  }

  it('WIKI_GET_HEADER returns the frontmatter block for an added file', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf');
    register();
    const handler = getHandler(CHANNELS.WIKI_GET_HEADER);
    const header = await handler(null, { resource: 'collections/Long Trail News/1923_04_Apr.pdf' });
    expect(header).toContain('type: "Newsletter"');
    expect(header).toMatch(/^---\n[\s\S]*\n---\n$/);
    expect(header).not.toContain('Body.');
  });

  it('WIKI_GET_HEADER returns null when the file has not been added to the wiki yet', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_GET_HEADER);
    const header = await handler(null, { resource: 'collections/Long Trail News/never-added.pdf' });
    expect(header).toBeNull();
  });

  it('WIKI_SAVE_HEADER rewrites the frontmatter and preserves the body', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf');
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const result = await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      header: '---\ntype: "Magazine"\ntitle: "Long Trail News"\n---\n',
    });
    expect(result).toEqual({ ok: true });
    const saved = fs.readFileSync(
      path.join(tmpDir, 'wiki', 'Long Trail News', '1923_04_Apr.md'), 'utf-8',
    );
    expect(saved).toContain('type: "Magazine"');
    expect(saved).toContain('Body.');
  });

  it('WIKI_SAVE_HEADER fails when the file has not been added to the wiki yet', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const result = await handler(null, {
      resource: 'collections/Long Trail News/never-added.pdf',
      header: '---\ntype: "Magazine"\n---\n',
    });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not been added') });
  });

  it('WIKI_SAVE_HEADER rejects a header missing the --- frontmatter fences', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf');
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const result = (await handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      header: 'type: "Magazine"',
    })) as { ok: boolean };
    expect(result.ok).toBe(false);
  });
});
