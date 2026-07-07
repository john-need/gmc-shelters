import { ipcMain, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { WikiHeaderPayload, WikiIndexReport, WikiSaveHeaderResult, WikiSearchResult } from '../../shared/ipc-types';
import { CHANNELS } from '../../shared/ipc-types';
import { HEADER_PROPERTIES, validateHeader } from '../../shared/wiki-header-schema';

// ponytail: lazy-open, never close — app lifetime matches DB lifetime
let db: ReturnType<typeof openDb> | null = null;

function openDb() {
  const dbPath = path.resolve(app.getAppPath(), 'wiki', 'search.db');
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3');
    return new Database(dbPath, { readonly: true });
  } catch {
    return null;
  }
}

function getDb() {
  if (!db) db = openDb();
  return db;
}

const FRONTMATTER_RE = /^(---\n[\s\S]*?\n---\n)/;
const FRONTMATTER_BLOCK_RE = /^---\n([\s\S]*?)\n---\n/;
const FRONTMATTER_LINE_RE = /^([A-Za-z_]+):\s*"((?:[^"\\]|\\.)*)"\s*$/;

export function wikiMdPath(root: string, resource: string): string {
  const pdfPath = path.resolve(root, resource);
  const collection = path.relative(path.join(root, 'collections'), pdfPath).split(path.sep)[0];
  const stem = path.basename(pdfPath, path.extname(pdfPath));
  return path.join(root, 'wiki', collection, `${stem}.md`);
}

/** Parses the flat `key: "value"` frontmatter block this pipeline emits (see scripts/lib/wiki_convert.py). */
export function parseFrontmatter(raw: string): { fields: Record<string, string> } {
  const block = FRONTMATTER_BLOCK_RE.exec(raw);
  const fields: Record<string, string> = {};
  if (!block) return { fields };
  for (const line of block[1].split('\n')) {
    const m = FRONTMATTER_LINE_RE.exec(line);
    if (m) fields[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return { fields };
}

export function serializeFrontmatter(fields: Record<string, string>): string {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`${key}: "${escaped}"`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

// Canonical write order — mirrors scripts/lib/wiki_convert.py's okf_header() field order.
const FRONTMATTER_ORDER = [
  'type', 'citation_type', 'title', 'description', 'resource', 'timestamp',
  'publisher', 'volume', 'edition', 'printed_volume', 'printed_issue', 'author', 'pages', 'language',
  'publication_date',
];

interface PreservedFields {
  type: string;
  resource: string;
  timestamp: string;
  pages: string;
}

function readPreserved(fields: Record<string, string>): PreservedFields {
  return {
    type: fields.type ?? '',
    resource: fields.resource ?? '',
    timestamp: fields.timestamp ?? '',
    pages: fields.pages ?? '',
  };
}

export interface WikiHeaderRead {
  citationType: string;
  fields: Record<string, string>;
  preserved: PreservedFields;
}

/** Reads an OKF header at mdPath, or null if the file hasn't been added to the wiki yet. */
export function readWikiHeader(mdPath: string): WikiHeaderRead | null {
  if (!fs.existsSync(mdPath)) return null;
  const { fields: all } = parseFrontmatter(fs.readFileSync(mdPath, 'utf-8'));
  const fields: Record<string, string> = {};
  for (const prop of HEADER_PROPERTIES) fields[prop] = all[prop] ?? '';
  return { citationType: all.citation_type ?? '', fields, preserved: readPreserved(all) };
}

/** Merges citationType/fields into mdPath's frontmatter, preserving type/resource/timestamp/pages and the body. */
export function writeWikiHeader(mdPath: string, citationType: string, fields: Record<string, string>): void {
  const raw = fs.readFileSync(mdPath, 'utf-8');
  const preserved = readPreserved(parseFrontmatter(raw).fields);
  const merged: Record<string, string> = {
    ...(preserved.type ? { type: preserved.type } : {}),
    citation_type: citationType,
    ...fields,
    ...(preserved.resource ? { resource: preserved.resource } : {}),
    ...(preserved.timestamp ? { timestamp: preserved.timestamp } : {}),
    ...(preserved.pages ? { pages: preserved.pages } : {}),
  };
  const out: Record<string, string> = {};
  for (const key of FRONTMATTER_ORDER) {
    if (merged[key]) out[key] = merged[key];
  }
  const body = raw.replace(FRONTMATTER_RE, '');
  fs.writeFileSync(mdPath, serializeFrontmatter(out) + body, 'utf-8');
}

/** Narrows a highlighted page body down to just the paragraph(s) containing a match. */
export function paragraphSnippet(highlightedBody: string): string {
  return highlightedBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.includes('<mark>'))
    .join('\n\n');
}

export function registerWikiSearchHandlers(): void {
  ipcMain.handle(CHANNELS.WIKI_SEARCH, (_e, query: string, collections?: string[]): WikiSearchResult[] => {
    if (!query?.trim()) return [];
    if (collections && collections.length === 0) return []; // every collection deselected
    const conn = getDb();
    if (!conn) return [];
    try {
      // `path` is `<collectionName>/<stem>.md` (see scripts/build_wiki_index.py) — its
      // first segment is the collection, so a prefix match filters by collection.
      const collectionFilter = collections?.length
        ? `AND (${collections.map(() => `path LIKE ? || '/%'`).join(' OR ')})`
        : '';
      const rows = conn
        .prepare<unknown[], WikiSearchResult>(`
          SELECT path, okf_type, title, publisher, volume, edition,
                 printed_volume, printed_issue, author, publication_date,
                 resource, citation_type, kind,
                 CAST(page AS INTEGER) AS page, image,
                 highlight(wiki_fts, 15, '<mark>', '</mark>') AS snippet
          FROM wiki_fts
          WHERE wiki_fts MATCH ?
          ${collectionFilter}
          ORDER BY rank
          LIMIT 50
        `)
        .all(query, ...(collections ?? [])) as WikiSearchResult[];
      return rows.map((r) => ({ ...r, snippet: paragraphSnippet(r.snippet) }));
    } catch {
      return [];
    }
  });

  ipcMain.handle(
    CHANNELS.WIKI_OPEN_PDF,
    (_e, { resource, page }: { resource: string; page: number }): { ok: boolean } => {
      const root = app.getAppPath();
      const pdfPath = path.resolve(root, resource);
      // resources always live under collections/ — reject anything else
      if (!pdfPath.startsWith(path.join(root, 'collections') + path.sep)) return { ok: false };
      // stale search index entry (e.g. a since-renamed collection folder) — don't open a dead window
      if (!fs.existsSync(pdfPath)) return { ok: false };

      // Electron's built-in Chromium PDF viewer honors #page=N
      const win = new BrowserWindow({
        width: 1000,
        height: 850,
        title: path.basename(pdfPath),
      });
      win.loadURL(`${pathToFileURL(pdfPath).href}#page=${Math.max(1, Math.floor(page) || 1)}`);
      return { ok: true };
    },
  );

  ipcMain.handle(CHANNELS.WIKI_INDEX_REPORT, (): WikiIndexReport | null => {
    try {
      const raw = fs.readFileSync(path.join(app.getAppPath(), 'wiki', 'index-report.json'), 'utf-8');
      return JSON.parse(raw) as WikiIndexReport;
    } catch {
      return null;
    }
  });

  ipcMain.handle(CHANNELS.WIKI_GET_HEADER, (_e, { resource }: { resource: string }): WikiHeaderPayload | null =>
    readWikiHeader(wikiMdPath(app.getAppPath(), resource)),
  );

  ipcMain.handle(
    CHANNELS.WIKI_SAVE_HEADER,
    (
      _e,
      { resource, citationType, fields }: { resource: string; citationType: string; fields: Record<string, string> },
    ): WikiSaveHeaderResult => {
      const mdPath = wikiMdPath(app.getAppPath(), resource);
      if (!fs.existsSync(mdPath)) {
        return { ok: false, error: 'This file has not been added to the wiki yet.' };
      }
      const validated = validateHeader(citationType, fields);
      if (!validated.ok) return { ok: false, errors: validated.errors };

      writeWikiHeader(mdPath, citationType, validated.fields);
      return { ok: true };
    },
  );
}
