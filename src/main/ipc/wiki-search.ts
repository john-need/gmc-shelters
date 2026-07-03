import { ipcMain, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { WikiIndexReport, WikiSearchResult } from '../../shared/ipc-types';
import { CHANNELS } from '../../shared/ipc-types';

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

function wikiMdPath(root: string, resource: string): string {
  const pdfPath = path.resolve(root, resource);
  const collection = path.relative(path.join(root, 'collections'), pdfPath).split(path.sep)[0];
  const stem = path.basename(pdfPath, path.extname(pdfPath));
  return path.join(root, 'wiki', collection, `${stem}.md`);
}

export function registerWikiSearchHandlers(): void {
  ipcMain.handle(CHANNELS.WIKI_SEARCH, (_e, query: string): WikiSearchResult[] => {
    if (!query?.trim()) return [];
    const conn = getDb();
    if (!conn) return [];
    try {
      return conn
        .prepare<[string], WikiSearchResult>(`
          SELECT path, okf_type, title, publisher, volume, edition,
                 printed_volume, printed_issue, resource, citation_type, kind,
                 CAST(page AS INTEGER) AS page, image,
                 snippet(wiki_fts, -1, '<mark>', '</mark>', '…', 40) AS snippet
          FROM wiki_fts
          WHERE wiki_fts MATCH ?
          ORDER BY rank
          LIMIT 50
        `)
        .all(query) as WikiSearchResult[];
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

  ipcMain.handle(CHANNELS.WIKI_GET_HEADER, (_e, { resource }: { resource: string }): string | null => {
    const mdPath = wikiMdPath(app.getAppPath(), resource);
    if (!fs.existsSync(mdPath)) return null;
    const m = FRONTMATTER_RE.exec(fs.readFileSync(mdPath, 'utf-8'));
    return m ? m[1] : null;
  });

  ipcMain.handle(
    CHANNELS.WIKI_SAVE_HEADER,
    (_e, { resource, header }: { resource: string; header: string }): { ok: boolean; error?: string } => {
      const mdPath = wikiMdPath(app.getAppPath(), resource);
      if (!fs.existsSync(mdPath)) {
        return { ok: false, error: 'This file has not been added to the wiki yet.' };
      }
      if (!/^---\n[\s\S]*?\n---\n$/.test(header)) {
        return { ok: false, error: 'Header must be a --- wrapped frontmatter block.' };
      }
      const body = fs.readFileSync(mdPath, 'utf-8').replace(FRONTMATTER_RE, '');
      fs.writeFileSync(mdPath, header + body, 'utf-8');
      return { ok: true };
    },
  );
}
