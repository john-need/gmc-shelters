jest.mock('electron');
jest.mock('../db/sources');
jest.mock('child_process');

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { ipcMain, app } from 'electron';
import * as dbSources from '../db/sources';
import { registerSourceHandlers } from './sources';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

beforeEach(() => {
  jest.clearAllMocks();
  registerSourceHandlers();
});

describe('ipc/sources', () => {
  it('registers all source channels', () => {
    const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
    expect(registered).toContain(CHANNELS.SOURCES_GET_BY_SHELTER);
    expect(registered).toContain(CHANNELS.SOURCES_CREATE);
    expect(registered).toContain(CHANNELS.SOURCES_UPDATE);
    expect(registered).toContain(CHANNELS.SOURCES_DELETE);
  });

  it('SOURCES_GET_BY_SHELTER calls getSourcesByShelter', () => {
    const sources = [{ id: 1, title: 'A Book' }];
    (dbSources.getSourcesByShelter as jest.Mock).mockReturnValue(sources);
    const handler = getHandler(CHANNELS.SOURCES_GET_BY_SHELTER);
    const result = handler(null, { shelterId: 42 });
    expect(dbSources.getSourcesByShelter).toHaveBeenCalledWith(42);
    expect(result).toBe(sources);
  });

  it('SOURCES_CREATE calls createSource', () => {
    const source = { id: 1, title: 'New Book' };
    (dbSources.createSource as jest.Mock).mockReturnValue(source);
    const input = { shelter_id: 1, type: 'book', title: 'New Book', author: '' };
    const handler = getHandler(CHANNELS.SOURCES_CREATE);
    const result = handler(null, input);
    expect(dbSources.createSource).toHaveBeenCalledWith(input);
    expect(result).toBe(source);
  });

  it('SOURCES_UPDATE calls updateSource', () => {
    const source = { id: 5, title: 'Updated' };
    (dbSources.updateSource as jest.Mock).mockReturnValue(source);
    const handler = getHandler(CHANNELS.SOURCES_UPDATE);
    const result = handler(null, source);
    expect(dbSources.updateSource).toHaveBeenCalledWith(source);
    expect(result).toBe(source);
  });

  it('SOURCES_DELETE calls deleteSource with id', () => {
    const handler = getHandler(CHANNELS.SOURCES_DELETE);
    handler(null, { id: 7 });
    expect(dbSources.deleteSource).toHaveBeenCalledWith(7);
  });

  describe('SOURCES_CLEAN_QUOTE', () => {
    let children: FakeChild[];

    beforeEach(() => {
      children = [];
      (app.getAppPath as jest.Mock).mockReturnValue('/repo');
      (spawn as jest.Mock).mockImplementation(() => {
        const child = new FakeChild();
        children.push(child);
        return child;
      });
    });

    it('reads the current quote, spawns clean_quote.py with it, and updates on success', async () => {
      (dbSources.getSourceQuote as jest.Mock).mockReturnValue('messy quote');
      const updated = { id: 1, quote: 'clean quote' };
      (dbSources.updateSourceQuote as jest.Mock).mockReturnValue(updated);

      const handler = getHandler(CHANNELS.SOURCES_CLEAN_QUOTE);
      const promise = handler(null, { id: 1, shelterId: 7 });

      expect(dbSources.getSourceQuote).toHaveBeenCalledWith(7, 1);
      const args = (spawn as jest.Mock).mock.calls[0][1] as string[];
      expect(args).toEqual(expect.arrayContaining(['/repo/scripts/clean_quote.py', 'messy quote']));

      children[0].stdout.emit('data', Buffer.from('clean quote\n'));
      children[0].emit('close', 0);

      const result = await promise;
      expect(dbSources.updateSourceQuote).toHaveBeenCalledWith(7, 1, 'clean quote');
      expect(result).toBe(updated);
    });

    it('rejects with stderr on a non-zero exit and never calls updateSourceQuote', async () => {
      (dbSources.getSourceQuote as jest.Mock).mockReturnValue('messy quote');

      const handler = getHandler(CHANNELS.SOURCES_CLEAN_QUOTE);
      const promise = handler(null, { id: 1, shelterId: 7 });

      children[0].stderr.emit('data', Buffer.from('ANTHROPIC_API_KEY is not set'));
      children[0].emit('close', 1);

      await expect(promise).rejects.toThrow('ANTHROPIC_API_KEY is not set');
      expect(dbSources.updateSourceQuote).not.toHaveBeenCalled();
    });
  });
});
