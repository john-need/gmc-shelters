// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
jest.mock('child_process');

import fs from 'fs';
import os from 'os';
import path from 'path';
import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ipcMain, app } from 'electron';
import { registerCollectionsHandlers } from './collections';
import { CHANNELS } from '@shared/ipc-types';
import type { CollectionsRunResult, CollectionDefaultsResult } from '@shared/ipc-types';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn(() => this.emit('close', null));
}

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

function makeEvent() {
  return { sender: { send: jest.fn() } };
}

describe('ipc/collections', () => {
  let children: FakeChild[];

  beforeEach(() => {
    jest.clearAllMocks();
    (app.getAppPath as jest.Mock).mockReturnValue('/repo');
    children = [];
    (spawn as jest.Mock).mockImplementation(() => {
      const child = new FakeChild();
      children.push(child);
      return child;
    });
    registerCollectionsHandlers();
  });

  afterEach(async () => {
    // Drain the module-level active-child slot: closing the converter child
    // spawns the index-rebuild child, so keep closing until nothing new appears.
    for (let i = 0; i < 4; i++) {
      children.forEach((c) => c.emit('close', 0));
      await Promise.resolve();
      await Promise.resolve();
    }
  });

  it('COLLECTIONS_STATUS parses the status CLI JSON output', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_STATUS);
    const promise = handler(makeEvent());
    const payload = [{ name: 'books', total: 3, added: 3, cleaned: 1, files: [] }];
    children[0].stdout.emit('data', Buffer.from(JSON.stringify(payload)));
    children[0].emit('close', 0);
    await expect(promise).resolves.toEqual(payload);
    expect((spawn as jest.Mock).mock.calls[0][1]).toContain('/repo/scripts/collection_status.py');
  });

  it('add mode runs the converter offline with the selected files', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_RUN);
    const promise = handler(makeEvent(), {
      mode: 'add',
      files: ['collections/books/a.pdf'],
      force: false,
    });
    const convertArgs = (spawn as jest.Mock).mock.calls[0][1] as string[];
    expect(convertArgs).toEqual(expect.arrayContaining([
      '/repo/scripts/ocr_to_markdown.py', '--no-clean', '--no-images',
      '--files', 'collections/books/a.pdf',
    ]));
    expect(convertArgs).not.toContain('--force');

    children[0].stdout.emit('data', Buffer.from('Audit: 1 converted, 0 cached, 0 failed.\n'));
    children[0].emit('close', 0);
    // successful run triggers the index rebuild
    await Promise.resolve();
    children[1].emit('close', 0);

    const result = (await promise) as CollectionsRunResult;
    expect(result).toMatchObject({ ok: true, converted: 1, cached: 0, failed: 0 });
    expect((spawn as jest.Mock).mock.calls[1][1]).toContain('/repo/scripts/build_wiki_index.py');
  });

  it('clean mode uses the full pipeline and honors force', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_RUN);
    void handler(makeEvent(), { mode: 'clean', files: ['collections/books/a.pdf'], force: true });
    const args = (spawn as jest.Mock).mock.calls[0][1] as string[];
    expect(args).not.toContain('--no-clean');
    expect(args).not.toContain('--no-images');
    expect(args).toContain('--force');
  });

  it('streams per-file progress events to the sender', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_RUN);
    const event = makeEvent();
    void handler(event, { mode: 'add', files: [], force: false });
    children[0].stdout.emit('data', Buffer.from('  proc  a.pdf\n  ok    a.pdf\n'));
    expect(event.sender.send).toHaveBeenCalledWith(
      CHANNELS.COLLECTIONS_PROGRESS, { kind: 'proc', file: 'a.pdf' });
    expect(event.sender.send).toHaveBeenCalledWith(
      CHANNELS.COLLECTIONS_PROGRESS, { kind: 'ok', file: 'a.pdf' });
  });

  it('rejects a second run while one is active', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_RUN);
    void handler(makeEvent(), { mode: 'add', files: [], force: false });
    const second = (await handler(makeEvent(), { mode: 'add', files: [], force: false })) as CollectionsRunResult;
    expect(second.ok).toBe(false);
    expect(second.error).toMatch(/already running/i);
  });

  it('cancel kills the child and reports canceled', async () => {
    const run = getHandler(CHANNELS.COLLECTIONS_RUN);
    const cancel = getHandler(CHANNELS.COLLECTIONS_CANCEL);
    const promise = run(makeEvent(), { mode: 'clean', files: [], force: false });
    await cancel(makeEvent());
    expect(children[0].kill).toHaveBeenCalled();
    const result = (await promise) as CollectionsRunResult;
    expect(result.canceled).toBe(true);
    expect(result.ok).toBe(false);
  });

  it('nonzero exit reports failure with stderr', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_RUN);
    const promise = handler(makeEvent(), { mode: 'add', files: [], force: false });
    children[0].stderr.emit('data', Buffer.from('boom'));
    children[0].emit('close', 1);
    const result = (await promise) as CollectionsRunResult;
    expect(result.ok).toBe(false);
    expect(result.error).toContain('boom');
  });

  describe('COLLECTIONS_SET_DEFAULTS', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-defaults-test-'));
      (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeCollectionPdf(name: string, file: string) {
      const dir = path.join(tmpDir, 'collections', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, file), 'fake pdf bytes');
    }

    function writeWikiDoc(name: string, file: string, frontmatter: string) {
      const stem = path.basename(file, '.pdf');
      const dir = path.join(tmpDir, 'wiki', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${stem}.md`), `${frontmatter}\nBody.\n`);
    }

    function readWikiDoc(name: string, file: string): string {
      const stem = path.basename(file, '.pdf');
      return fs.readFileSync(path.join(tmpDir, 'wiki', name, `${stem}.md`), 'utf-8');
    }

    it('spawns the setter script with citation_type and defaults as JSON', async () => {
      writeCollectionPdf('long-trail-news', 'a.pdf');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'long-trail-news',
        oldCitationType: '',
        citationType: 'magazine',
        oldDefaults: { title: '', description: '', language: '', author: '', publisher: '' },
        defaults: { title: 'Long Trail News', description: '', language: 'en', author: '', publisher: 'GMC' },
      });
      children[0].emit('close', 0);
      const result = (await promise) as CollectionDefaultsResult;
      expect(result.ok).toBe(true);
      const args = (spawn as jest.Mock).mock.calls[0][1] as string[];
      expect(args[0]).toBe(path.join(tmpDir, 'scripts', 'set_collection_defaults.py'));
      expect(args[1]).toBe('long-trail-news');
      expect(JSON.parse(args[2])).toEqual({
        citation_type: 'magazine', title: 'Long Trail News', description: '', language: 'en', author: '', publisher: 'GMC',
      });
    });

    it('reports failure without throwing when the setter script exits nonzero', async () => {
      writeCollectionPdf('long-trail-news', 'a.pdf');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'missing-collection',
        oldCitationType: '',
        citationType: 'magazine',
        oldDefaults: {},
        defaults: {},
      });
      children[0].stderr.emit('data', Buffer.from('no such collection'));
      children[0].emit('close', 1);
      const result = (await promise) as CollectionDefaultsResult;
      expect(result.ok).toBe(false);
      expect(result.error).toContain('no such collection');
    });

    it('cascades a changed default onto a document whose field is blank', async () => {
      writeCollectionPdf('long-trail-news', 'a.pdf');
      writeWikiDoc('long-trail-news', 'a.pdf', '---\ncitation_type: "magazine"\ntitle: ""\n---');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'long-trail-news',
        oldCitationType: 'magazine',
        citationType: 'magazine',
        oldDefaults: { title: '', description: '', language: '', author: '', publisher: '' },
        defaults: { title: 'Long Trail News', description: '', language: '', author: '', publisher: '' },
      });
      children[0].emit('close', 0);
      const result = (await promise) as CollectionDefaultsResult;
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(1);
      expect(readWikiDoc('long-trail-news', 'a.pdf')).toContain('title: "Long Trail News"');
    });

    it('cascades a changed default onto a document whose field equals the old default', async () => {
      writeCollectionPdf('long-trail-news', 'a.pdf');
      writeWikiDoc('long-trail-news', 'a.pdf', '---\ncitation_type: "magazine"\ntitle: "Old Title"\n---');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'long-trail-news',
        oldCitationType: 'magazine',
        citationType: 'magazine',
        oldDefaults: { title: 'Old Title', description: '', language: '', author: '', publisher: '' },
        defaults: { title: 'New Title', description: '', language: '', author: '', publisher: '' },
      });
      children[0].emit('close', 0);
      await promise;
      expect(readWikiDoc('long-trail-news', 'a.pdf')).toContain('title: "New Title"');
    });

    it('does not touch a document whose field was customized away from the old default', async () => {
      writeCollectionPdf('long-trail-news', 'a.pdf');
      writeWikiDoc('long-trail-news', 'a.pdf', '---\ncitation_type: "magazine"\ntitle: "Custom Title"\n---');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'long-trail-news',
        oldCitationType: 'magazine',
        citationType: 'magazine',
        oldDefaults: { title: 'Old Title', description: '', language: '', author: '', publisher: '' },
        defaults: { title: 'New Title', description: '', language: '', author: '', publisher: '' },
      });
      children[0].emit('close', 0);
      const result = (await promise) as CollectionDefaultsResult;
      expect(result.updated).toBe(0);
      expect(readWikiDoc('long-trail-news', 'a.pdf')).toContain('title: "Custom Title"');
    });

    it('does not touch a document that has not been added to the wiki yet', async () => {
      writeCollectionPdf('long-trail-news', 'never-added.pdf');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'long-trail-news',
        oldCitationType: '',
        citationType: 'magazine',
        oldDefaults: { title: '', description: '', language: '', author: '', publisher: '' },
        defaults: { title: 'New Title', description: '', language: '', author: '', publisher: '' },
      });
      children[0].emit('close', 0);
      const result = (await promise) as CollectionDefaultsResult;
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(0);
    });

    it('cascades citation type under the same blank-or-old rule', async () => {
      writeCollectionPdf('long-trail-news', 'a.pdf');
      writeWikiDoc('long-trail-news', 'a.pdf', '---\ncitation_type: "magazine"\ntitle: "Kept"\n---');
      const handler = getHandler(CHANNELS.COLLECTIONS_SET_DEFAULTS);
      const promise = handler(makeEvent(), {
        name: 'long-trail-news',
        oldCitationType: 'magazine',
        citationType: 'newspaper',
        oldDefaults: { title: '', description: '', language: '', author: '', publisher: '' },
        defaults: { title: '', description: '', language: '', author: '', publisher: '' },
      });
      children[0].emit('close', 0);
      await promise;
      const doc = readWikiDoc('long-trail-news', 'a.pdf');
      expect(doc).toContain('citation_type: "newspaper"');
      expect(doc).toContain('title: "Kept"');
    });
  });

  describe('COLLECTIONS_ADD_FILES', () => {
    let tmpDir: string;
    let sourceDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-addfiles-test-'));
      sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-addfiles-src-'));
      (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.rmSync(sourceDir, { recursive: true, force: true });
    });

    it('copies a dropped PDF into the collection folder', async () => {
      const src = path.join(sourceDir, 'new-issue.pdf');
      fs.writeFileSync(src, 'fake pdf bytes');
      const handler = getHandler(CHANNELS.COLLECTIONS_ADD_FILES);
      const result = await handler(makeEvent(), { collection: 'long-trail-news', sourcePaths: [src] });
      expect(result).toEqual({ added: ['new-issue.pdf'], skipped: [] });
      expect(fs.readFileSync(path.join(tmpDir, 'collections', 'long-trail-news', 'new-issue.pdf'), 'utf-8'))
        .toBe('fake pdf bytes');
    });

    it('skips a file whose name already exists in the collection', async () => {
      fs.mkdirSync(path.join(tmpDir, 'collections', 'long-trail-news'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'collections', 'long-trail-news', 'a.pdf'), 'original bytes');
      const src = path.join(sourceDir, 'a.pdf');
      fs.writeFileSync(src, 'incoming bytes');
      const handler = getHandler(CHANNELS.COLLECTIONS_ADD_FILES);
      const result = await handler(makeEvent(), { collection: 'long-trail-news', sourcePaths: [src] });
      expect(result).toEqual({ added: [], skipped: ['a.pdf'] });
      expect(fs.readFileSync(path.join(tmpDir, 'collections', 'long-trail-news', 'a.pdf'), 'utf-8'))
        .toBe('original bytes');
    });
  });

  describe('COLLECTIONS_DELETE_FILE', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-deletefile-test-'));
      (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('removes the file from the collection folder', async () => {
      const dir = path.join(tmpDir, 'collections', 'long-trail-news');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.pdf'), 'bytes');
      const handler = getHandler(CHANNELS.COLLECTIONS_DELETE_FILE);
      const result = await handler(makeEvent(), { collection: 'long-trail-news', file: 'a.pdf' });
      expect(result).toEqual({ ok: true });
      expect(fs.existsSync(path.join(dir, 'a.pdf'))).toBe(false);
    });

    it('rejects a path that escapes the collections folder', async () => {
      const handler = getHandler(CHANNELS.COLLECTIONS_DELETE_FILE);
      const result = await handler(makeEvent(), { collection: '..', file: '../../etc/passwd' });
      expect(result).toEqual({ ok: false });
    });
  });

  describe('COLLECTIONS_DELETE', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-delete-test-'));
      (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('removes the whole collection folder, files included', async () => {
      const dir = path.join(tmpDir, 'collections', 'long-trail-news');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.pdf'), 'bytes');
      const handler = getHandler(CHANNELS.COLLECTIONS_DELETE);
      const result = await handler(makeEvent(), { name: 'long-trail-news' });
      expect(result).toEqual({ ok: true });
      expect(fs.existsSync(dir)).toBe(false);
    });
  });
});
