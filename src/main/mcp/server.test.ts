// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import { app } from 'electron';
import { startMcpServer, stopMcpServer } from './server';

// getDb() is a module-level singleton (opens once, caches forever) — mocking it lets
// each test in the "shelters database" describe below inject its own fresh in-memory DB
// instead of fighting the singleton across tests.
jest.mock('../db/connection', () => ({ getDb: jest.fn() }));
import { getDb } from '../db/connection';

async function rpc(port: number, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2025-06-18',
      Connection: 'close',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  // Streamable HTTP may reply as a single SSE `data:` frame instead of plain JSON.
  const jsonText = text.startsWith('event:') || text.startsWith('data:')
    ? text.split('\n').find((l) => l.startsWith('data:'))!.slice(5).trim()
    : text;
  return { status: res.status, json: jsonText ? JSON.parse(jsonText) : undefined };
}

describe('mcp/server', () => {
  let tmpDir: string;
  let server: ReturnType<typeof startMcpServer>;
  let port: number;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-server-test-'));
    (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    server = startMcpServer(0); // OS-assigned port avoids clashing with a real running app
    await new Promise((resolve) => server.once('listening', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await stopMcpServer(server);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists every registered tool after initializing, under the gmc-shelters server name', async () => {
    const init = await rpc(port, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    expect(init.status).toBe(200);
    const initResult = (init.json as { result: { serverInfo: { name: string } } }).result;
    expect(initResult.serverInfo.name).toBe('gmc-shelters');
    await rpc(port, { jsonrpc: '2.0', method: 'notifications/initialized' });

    const list = await rpc(port, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const names = (list.json as { result: { tools: { name: string }[] } }).result.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining([
      'search_collections', 'download_document',
      'list_shelters', 'get_shelter', 'list_sources', 'list_photos',
      'download_history', 'download_photo',
    ]));
  });

  it('search_collections returns matching results from wiki/search.db', async () => {
    fs.mkdirSync(path.join(tmpDir, 'wiki'), { recursive: true });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
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
      'long-trail-news/1922_12_Dec.md', 'Newsletter', 'Long Trail News',
      'Green Mountain Club', '1922', 'December', '5', '2', 'Green Mountain Club', '1922-12',
      'collections/long-trail-news/1922_12_Dec.pdf', 'magazine', 'page', '2', '',
      'Monroe Lodge will be built next year.',
    );
    db.close();

    await rpc(port, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    const call = await rpc(port, {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'search_collections', arguments: { query: 'Monroe Lodge' } },
    });
    const text = (call.json as { result: { content: { type: string; text: string }[] } }).result.content[0].text;
    const results = JSON.parse(text) as { title: string }[];
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Long Trail News');
  });

  it('download_document returns the file contents base64-encoded', async () => {
    fs.mkdirSync(path.join(tmpDir, 'collections', 'long-trail-news'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'collections', 'long-trail-news', '1922_12_Dec.pdf'), 'fake pdf bytes');

    await rpc(port, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    const call = await rpc(port, {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'download_document', arguments: { resource: 'collections/long-trail-news/1922_12_Dec.pdf' } },
    });
    const resource = (call.json as {
      result: { content: { type: string; resource: { mimeType: string; blob: string } }[] };
    }).result.content[0].resource;
    expect(resource.mimeType).toBe('application/pdf');
    expect(Buffer.from(resource.blob, 'base64').toString()).toBe('fake pdf bytes');
  });
});

describe('mcp/server — shelters database + file tools', () => {
  let tmpDir: string;
  let server: ReturnType<typeof startMcpServer>;
  let port: number;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  let fixtureDb: InstanceType<typeof Database>;

  const SCHEMA = `
    CREATE TABLE architectures (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE categories (id INTEGER PRIMARY KEY AUTOINCREMENT, category_name TEXT NOT NULL);
    CREATE TABLE builders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE shelters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT, start_year INTEGER, end_year INTEGER,
      description TEXT, slug TEXT NOT NULL UNIQUE,
      default_photo_id INTEGER, is_gmc INTEGER DEFAULT 0,
      architecture_id INTEGER REFERENCES architectures(id),
      builder_id INTEGER REFERENCES builders(id),
      notes TEXT, created TEXT, updated TEXT,
      is_extant INTEGER DEFAULT 1,
      category_id INTEGER REFERENCES categories(id),
      show_on_web INTEGER DEFAULT 0, history TEXT
    );
    CREATE TABLE photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shelter_id INTEGER, file_name TEXT, title TEXT,
      photographer TEXT, caption TEXT, date_taken TEXT,
      alt_text TEXT, description TEXT, notes TEXT,
      include_in_post INTEGER DEFAULT 1, created TEXT, updated TEXT
    );
    CREATE TABLE sources (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, author TEXT, title TEXT);
    CREATE TABLE shelter_sources (
      shelter_id INTEGER, source_id INTEGER,
      include_in_history INTEGER DEFAULT 0, annotation TEXT, notes TEXT, quote TEXT
    );
  `;

  async function init() {
    await rpc(port, {
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
    });
    await rpc(port, { jsonrpc: '2.0', method: 'notifications/initialized' });
  }

  async function callTool(name: string, args: Record<string, unknown>) {
    return rpc(port, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name, arguments: args } });
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-server-shelters-test-'));
    (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);

    fixtureDb = new Database(':memory:');
    fixtureDb.exec(SCHEMA);
    fixtureDb.prepare(
      `INSERT INTO shelters (id, name, start_year, slug, is_gmc, notes, created, updated, is_extant, show_on_web, history)
       VALUES (7, 'Birch Glen Lodge', 1932, 'birch-glen-lodge', 1, '', '2020-01-01', '2020-01-02', 1, 1, 'birch-glen-lodge/birch-glen-lodge.md')`,
    ).run();
    fixtureDb.prepare(
      `INSERT INTO photos (id, shelter_id, file_name, title, photographer, caption, date_taken, alt_text, description, notes, include_in_post, created, updated)
       VALUES (3, 7, 'birch-glen-lodge/photos/view.jpg', '', '', '', '', '', '', '', 1, '2020-01-01', '2020-01-02')`,
    ).run();
    (getDb as jest.Mock).mockReturnValue(fixtureDb);

    fs.mkdirSync(path.join(tmpDir, 'shelters', 'birch-glen-lodge', 'photos'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'shelters', 'birch-glen-lodge', 'birch-glen-lodge.md'),
      '# Birch Glen Lodge\n\nBuilt in 1932.',
    );
    fs.writeFileSync(
      path.join(tmpDir, 'shelters', 'birch-glen-lodge', 'photos', 'view.jpg'),
      'fake jpeg bytes',
    );

    server = startMcpServer(0);
    await new Promise((resolve) => server.once('listening', resolve));
    port = (server.address() as AddressInfo).port;
    await init();
  });

  afterEach(async () => {
    await stopMcpServer(server);
    fixtureDb.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('list_shelters returns the shelter row', async () => {
    const result = await callTool('list_shelters', {});
    const text = (result.json as { result: { content: { type: string; text: string }[] } }).result.content[0].text;
    const shelters = JSON.parse(text) as { slug: string }[];
    expect(shelters).toHaveLength(1);
    expect(shelters[0].slug).toBe('birch-glen-lodge');
  });

  it('get_shelter returns isError for an unknown id', async () => {
    const result = await callTool('get_shelter', { shelterId: 999 });
    const body = (result.json as { result: { isError?: boolean } }).result;
    expect(body.isError).toBe(true);
  });

  it('list_sources returns an empty array for a shelter with no sources', async () => {
    const result = await callTool('list_sources', { shelterId: 7 });
    const text = (result.json as { result: { content: { type: string; text: string }[] } }).result.content[0].text;
    expect(JSON.parse(text)).toEqual([]);
  });

  it('list_photos returns the photo row for the shelter', async () => {
    const result = await callTool('list_photos', { shelterId: 7 });
    const text = (result.json as { result: { content: { type: string; text: string }[] } }).result.content[0].text;
    const photos = JSON.parse(text) as { id: number }[];
    expect(photos).toHaveLength(1);
    expect(photos[0].id).toBe(3);
  });

  it('download_history returns the markdown file contents as text', async () => {
    const result = await callTool('download_history', { shelterId: 7 });
    const text = (result.json as { result: { content: { type: string; text: string }[] } }).result.content[0].text;
    expect(text).toBe('# Birch Glen Lodge\n\nBuilt in 1932.');
  });

  it('download_photo returns the image bytes as a base64 resource', async () => {
    const result = await callTool('download_photo', { shelterId: 7, photoId: 3 });
    const resource = (result.json as {
      result: { content: { type: string; resource: { mimeType: string; blob: string } }[] };
    }).result.content[0].resource;
    expect(resource.mimeType).toBe('image/jpeg');
    expect(Buffer.from(resource.blob, 'base64').toString()).toBe('fake jpeg bytes');
  });
});
