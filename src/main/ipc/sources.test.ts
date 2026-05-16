jest.mock('electron');
jest.mock('../db/sources');

import { ipcMain } from 'electron';
import * as dbSources from '../db/sources';
import { registerSourceHandlers } from './sources';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
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
});
