// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper;
// no jest.mock() here — automocking would strip the mock's instance fields.
jest.mock('child_process');

import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { CHANNELS } from '@shared/ipc-types';
import type { WikiSearchResult, WikiHeaderPayload } from '@shared/ipc-types';
import { parseFrontmatter, serializeFrontmatter, paragraphSnippet } from './wiki-search';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

type ElectronMock = {
  ipcMain: { handle: jest.Mock };
  app: { getAppPath: jest.Mock };
  BrowserWindow: { instances: Array<{ loadURL: jest.Mock }> };
  shell: { openPath: jest.Mock };
};

function buildFixtureDb(dir: string) {
  fs.mkdirSync(path.join(dir, 'wiki'), { recursive: true });
  const db = new Database(path.join(dir, 'wiki', 'search.db'));
  db.exec(`
    CREATE VIRTUAL TABLE wiki_fts USING fts5(
      path UNINDEXED, okf_type UNINDEXED, title, publisher UNINDEXED,
      volume UNINDEXED, edition UNINDEXED, printed_volume UNINDEXED,
      printed_issue UNINDEXED, author UNINDEXED, publication_date UNINDEXED,
      resource UNINDEXED, citation_type UNINDEXED,
      kind UNINDEXED, page UNINDEXED, image UNINDEXED, body,
      tokenize = "porter unicode61"
    )
  `);
  const insert = db.prepare('INSERT INTO wiki_fts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  insert.run(
    'long-trail-news/1922_12_Dec.md', 'Newsletter', 'Long Trail News',
    'Green Mountain Club', '1922', 'December', '5', '2',
    'Green Mountain Club', '1922-12',
    'collections/long-trail-news/1922_12_Dec.pdf', 'magazine', 'page', '2', '',
    'Monroe Lodge will be built on Camels Hump next year.',
  );
  insert.run(
    'long-trail-news/1922_12_Dec.md', 'Newsletter', 'Long Trail News',
    'Green Mountain Club', '1922', 'December', '5', '2',
    'Green Mountain Club', '1922-12',
    'collections/long-trail-news/1922_12_Dec.pdf', 'magazine', 'illustration', '2',
    'long-trail-news/images/1922_12_Dec_p2_0.png',
    'Monroe Lodge under construction',
  );
  insert.run(
    'long-trail-news/1923_04_Apr.md', 'Newsletter', 'Long Trail News',
    'Green Mountain Club', '1923', 'April', '6', '1',
    'Green Mountain Club', '1923-04',
    'collections/long-trail-news/1923_04_Apr.pdf', 'magazine', 'page', '3', '',
    [
      'The annual meeting was held on a fine autumn day.',
      'Killington Peak drew a record crowd of hikers this season.',
      'Refreshments were served afterward on the porch.',
    ].join('\n\n'),
  );
  insert.run(
    'trail-guide/1930_Guide.md', 'Guidebook', 'Trail Guide',
    'Green Mountain Club', '1930', '', '', '',
    'Green Mountain Club', '1930',
    'collections/trail-guide/1930_Guide.pdf', 'book', 'page', '1', '',
    'Wildflowers bloom along the ridge trail every June.',
  );
  db.close();
}

describe('ipc/wiki-search', () => {
  let tmpDir: string;
  let electron: ElectronMock;
  let spawnedChildren: FakeChild[];

  beforeEach(() => {
    // resetModules gives wiki-search.ts fresh module state (its cached db handle)
    jest.resetModules();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-search-test-'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    electron = require('electron') as ElectronMock;
    electron.app.getAppPath.mockReturnValue(tmpDir);
    electron.BrowserWindow.instances.length = 0;
    electron.shell.openPath.mockReset().mockResolvedValue('');

    spawnedChildren = [];
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cp = require('child_process') as { spawn: jest.Mock };
    cp.spawn.mockImplementation(() => {
      const child = new FakeChild();
      spawnedChildren.push(child);
      return child;
    });
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

  function getWikiPageBodyFn() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getWikiPageBody } = require('./wiki-search');
    return getWikiPageBody as (resource: string, page: number) => string | null;
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
    expect(pageHit!.author).toBe('Green Mountain Club');
    expect(pageHit!.publication_date).toBe('1922-12');
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

  it('requires all bare terms to match (AND), not just any of them (OR)', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    // Only the page row has both "Monroe" and "Hump" ("...Camels Hump next year");
    // the illustration row has "Monroe" but not "Hump".
    const results = (await handler(null, 'Monroe Hump')) as WikiSearchResult[];
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('page');
  });

  it('treats a double-quoted span as an exact phrase, requiring that word order', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    // Both rows contain "Monroe Lodge" in that order.
    const inOrder = (await handler(null, '"Monroe Lodge"')) as WikiSearchResult[];
    expect(inOrder).toHaveLength(2);
    // Neither row contains the words in reverse order, so the phrase shouldn't match,
    // even though the same two bare words (unquoted) match both rows via AND.
    const reversed = (await handler(null, '"Lodge Monroe"')) as WikiSearchResult[];
    expect(reversed).toHaveLength(0);
    const bareReversed = (await handler(null, 'Lodge Monroe')) as WikiSearchResult[];
    expect(bareReversed).toHaveLength(2);
  });

  it('ANDs a bare term with a quoted exact phrase', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    // Only the illustration row has "construction"; both have the "Monroe Lodge" phrase.
    const results = (await handler(null, 'construction "Monroe Lodge"')) as WikiSearchResult[];
    expect(results).toHaveLength(1);
    expect(results[0].kind).toBe('illustration');
  });

  it('returns no results (not an error) for an unterminated quote', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    expect(await handler(null, 'Monroe "Lodge')).toEqual([]);
  });

  it('returns the whole matching paragraph as the quote, not a short fragment', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    const results = (await handler(null, 'Killington')) as WikiSearchResult[];
    expect(results).toHaveLength(1);
    expect(results[0].snippet).toBe(
      '<mark>Killington</mark> Peak drew a record crowd of hikers this season.',
    );
    // the other two paragraphs in the same page don't mention Killington, so they're excluded
    expect(results[0].snippet).not.toContain('annual meeting');
    expect(results[0].snippet).not.toContain('Refreshments');
  });

  it('filters results down to the given collections', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    const unfiltered = (await handler(null, 'Wildflowers')) as WikiSearchResult[];
    expect(unfiltered).toHaveLength(1);

    const wrongCollection = (await handler(null, 'Wildflowers', ['long-trail-news'])) as WikiSearchResult[];
    expect(wrongCollection).toHaveLength(0);

    const rightCollection = (await handler(null, 'Wildflowers', ['trail-guide'])) as WikiSearchResult[];
    expect(rightCollection).toHaveLength(1);
  });

  it('returns no results when every collection is excluded (empty selection)', async () => {
    buildFixtureDb(tmpDir);
    register();
    const handler = getHandler(CHANNELS.WIKI_SEARCH);
    expect(await handler(null, 'Monroe Lodge', [])).toEqual([]);
  });

  it('getWikiPageBody returns the page body text for a matching resource+page', () => {
    buildFixtureDb(tmpDir);
    const getWikiPageBody = getWikiPageBodyFn();
    expect(getWikiPageBody('collections/long-trail-news/1923_04_Apr.pdf', 3)).toContain(
      'Killington Peak drew a record crowd of hikers this season.',
    );
  });

  it('getWikiPageBody returns null for an unknown resource or page', () => {
    buildFixtureDb(tmpDir);
    const getWikiPageBody = getWikiPageBodyFn();
    expect(getWikiPageBody('collections/long-trail-news/1923_04_Apr.pdf', 99)).toBeNull();
    expect(getWikiPageBody('collections/nope.pdf', 1)).toBeNull();
  });

  it('getWikiPageBody returns null when the wiki index is missing', () => {
    const getWikiPageBody = getWikiPageBodyFn(); // no buildFixtureDb this time
    expect(getWikiPageBody('collections/long-trail-news/1923_04_Apr.pdf', 3)).toBeNull();
  });

  it('WIKI_OPEN_PDF opens the PDF in the OS default viewer', async () => {
    register();
    const pdfPath = path.join(tmpDir, 'collections', 'long-trail-news', '1922_12_Dec.pdf');
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.writeFileSync(pdfPath, 'fake pdf bytes');
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: 'collections/long-trail-news/1922_12_Dec.pdf' });
    expect(result).toEqual({ ok: true });
    expect(electron.shell.openPath).toHaveBeenCalledWith(pdfPath);
    expect(electron.BrowserWindow.instances).toHaveLength(0);
  });

  it('WIKI_OPEN_PDF returns ok:false and never calls shell.openPath when the PDF is missing on disk', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: 'collections/long-trail-news/does-not-exist.pdf' });
    expect(result).toEqual({ ok: false });
    expect(electron.shell.openPath).not.toHaveBeenCalled();
  });

  it('WIKI_OPEN_PDF rejects paths outside the collections folder', async () => {
    register();
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: '../../etc/passwd' });
    expect(result).toEqual({ ok: false });
    expect(electron.shell.openPath).not.toHaveBeenCalled();
  });

  it('WIKI_OPEN_PDF returns ok:false when shell.openPath reports an error (e.g. no registered app)', async () => {
    register();
    const pdfPath = path.join(tmpDir, 'collections', 'long-trail-news', '1922_12_Dec.pdf');
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });
    fs.writeFileSync(pdfPath, 'fake pdf bytes');
    electron.shell.openPath.mockResolvedValue('No application is associated with the specified file');
    const handler = getHandler(CHANNELS.WIKI_OPEN_PDF);
    const result = await handler(null, { resource: 'collections/long-trail-news/1922_12_Dec.pdf' });
    expect(result).toEqual({ ok: false });
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

  describe('paragraphSnippet', () => {
    it('keeps only the paragraph(s) containing a highlighted match', () => {
      const body = [
        'First paragraph, no match here.',
        'Second paragraph has the <mark>match</mark> in it.',
        'Third paragraph, also no match.',
      ].join('\n\n');
      expect(paragraphSnippet(body)).toBe('Second paragraph has the <mark>match</mark> in it.');
    });

    it('returns the whole body unchanged when it is a single paragraph', () => {
      const body = 'One <mark>match</mark> in an otherwise unbroken block of OCR text.';
      expect(paragraphSnippet(body)).toBe(body);
    });

    it('joins multiple matching paragraphs when the match spans more than one', () => {
      const body = [
        'No match.',
        'Has a <mark>match</mark>.',
        'Also has a <mark>match</mark>.',
      ].join('\n\n');
      expect(paragraphSnippet(body)).toBe('Has a <mark>match</mark>.\n\nAlso has a <mark>match</mark>.');
    });

    it('returns an empty string when nothing is highlighted', () => {
      expect(paragraphSnippet('No matches anywhere in this text.')).toBe('');
    });
  });

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
    const promise = handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      citationType: 'magazine',
      fields: {
        title: 'Long Trail News — Revised',
        description: 'Long Trail News, April 1923.',
        language: 'en',
        publisher: 'Green Mountain Club',
      },
    });
    spawnedChildren[0].emit('close', 0); // successful save triggers a search-index rebuild
    const result = await promise;
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

  it('WIKI_SAVE_HEADER persists publication_date', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', FULL_HEADER);
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const promise = handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      citationType: 'magazine',
      fields: {
        title: 'Long Trail News',
        description: 'Long Trail News, April 1923.',
        language: 'en',
        publisher: 'Green Mountain Club',
        publication_date: '1923-04',
      },
    });
    spawnedChildren[0].emit('close', 0);
    const result = await promise;
    expect(result).toEqual({ ok: true });
    const saved = fs.readFileSync(
      path.join(tmpDir, 'wiki', 'Long Trail News', '1923_04_Apr.md'), 'utf-8',
    );
    expect(saved).toContain('publication_date: "1923-04"');
    const handlerGet = getHandler(CHANNELS.WIKI_GET_HEADER);
    const payload = (await handlerGet(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
    })) as WikiHeaderPayload;
    expect(payload.fields.publication_date).toBe('1923-04');
  });

  it('WIKI_SAVE_HEADER rebuilds the search index after a successful save', async () => {
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', FULL_HEADER);
    register();
    const handler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const promise = handler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      citationType: 'magazine',
      fields: {
        title: 'Long Trail News', description: 'Long Trail News, April 1923.',
        language: 'en', publisher: 'Green Mountain Club', publication_date: '1923-04',
      },
    });
    expect(spawnedChildren).toHaveLength(1);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const cp = require('child_process') as { spawn: jest.Mock };
    expect(cp.spawn.mock.calls[0][1]).toContain(path.join(tmpDir, 'scripts', 'build_wiki_index.py'));
    spawnedChildren[0].emit('close', 0);
    await promise;
  });

  it('a search made after WIKI_SAVE_HEADER reflects a freshly rebuilt index, not a stale cached connection', async () => {
    buildFixtureDb(tmpDir);
    writeWikiDoc('collections/Long Trail News/1923_04_Apr.pdf', FULL_HEADER);
    register();

    // Warm the module's cached read-only db handle.
    const searchHandler = getHandler(CHANNELS.WIKI_SEARCH);
    await searchHandler(null, 'wildflowers');

    const saveHandler = getHandler(CHANNELS.WIKI_SAVE_HEADER);
    const promise = saveHandler(null, {
      resource: 'collections/Long Trail News/1923_04_Apr.pdf',
      citationType: 'magazine',
      fields: {
        title: 'Long Trail News', description: 'Long Trail News, April 1923.',
        language: 'en', publisher: 'Green Mountain Club',
      },
    });
    spawnedChildren[0].emit('close', 0);
    await promise;

    // Stand in for what the real build_wiki_index.py run (mocked above) would have
    // produced: a rebuilt search.db with different content.
    fs.rmSync(path.join(tmpDir, 'wiki', 'search.db'));
    const db = new Database(path.join(tmpDir, 'wiki', 'search.db'));
    db.exec(`
      CREATE VIRTUAL TABLE wiki_fts USING fts5(
        path UNINDEXED, okf_type UNINDEXED, title, publisher UNINDEXED,
        volume UNINDEXED, edition UNINDEXED, printed_volume UNINDEXED,
        printed_issue UNINDEXED, author UNINDEXED, publication_date UNINDEXED,
        resource UNINDEXED, citation_type UNINDEXED,
        kind UNINDEXED, page UNINDEXED, image UNINDEXED, body,
        tokenize = "porter unicode61"
      )
    `);
    db.prepare('INSERT INTO wiki_fts VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
      'long-trail-news/newly-indexed.md', 'Newsletter', 'Long Trail News',
      'Green Mountain Club', '1950', 'January', '', '',
      'Green Mountain Club', '1950-01',
      'collections/long-trail-news/newly-indexed.pdf', 'magazine', 'page', '1', '',
      'A freshly rebuilt entry only present after reindexing.',
    );
    db.close();

    const results = (await searchHandler(null, 'freshly rebuilt')) as WikiSearchResult[];
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe('long-trail-news/newly-indexed.md');
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
