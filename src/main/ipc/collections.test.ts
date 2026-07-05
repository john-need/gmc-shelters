// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
jest.mock('child_process');

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ipcMain, app } from 'electron';
import { registerCollectionsHandlers } from './collections';
import { CHANNELS } from '@shared/ipc-types';
import type { CollectionsRunResult } from '@shared/ipc-types';

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
      '/repo/collections/ocr_to_markdown.py', '--no-clean', '--no-images',
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

  it('COLLECTIONS_SET_CITATION_TYPE spawns the setter script and reports success', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_SET_CITATION_TYPE);
    const promise = handler(makeEvent(), { name: 'long-trail-news', citationType: 'magazine' });
    children[0].emit('close', 0);
    const result = (await promise) as { ok: boolean; error?: string };
    expect(result).toEqual({ ok: true });
    const args = (spawn as jest.Mock).mock.calls[0][1] as string[];
    expect(args).toEqual([
      '/repo/scripts/set_collection_citation_type.py', 'long-trail-news', 'magazine',
    ]);
  });

  it('COLLECTIONS_SET_CITATION_TYPE reports failure without throwing on a nonzero exit', async () => {
    const handler = getHandler(CHANNELS.COLLECTIONS_SET_CITATION_TYPE);
    const promise = handler(makeEvent(), { name: 'missing-collection', citationType: 'magazine' });
    children[0].stderr.emit('data', Buffer.from('no such collection'));
    children[0].emit('close', 1);
    const result = (await promise) as { ok: boolean; error?: string };
    expect(result.ok).toBe(false);
    expect(result.error).toContain('no such collection');
  });
});
