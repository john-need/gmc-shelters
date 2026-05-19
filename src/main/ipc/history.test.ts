jest.mock('electron');
jest.mock('../fs/history');

import { ipcMain } from 'electron';
import * as fsHistory from '../fs/history';
import { registerHistoryHandlers } from './history';
import { CHANNELS } from '@shared/ipc-types';

function getHandler(channel: string) {
  const call = (ipcMain.handle as jest.Mock).mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (...args: unknown[]) => unknown;
}

beforeEach(() => {
  jest.clearAllMocks();
  registerHistoryHandlers();
});

describe('ipc/history', () => {
  it('registers HISTORY_READ and HISTORY_WRITE channels', () => {
    const registered = (ipcMain.handle as jest.Mock).mock.calls.map(([ch]) => ch);
    expect(registered).toContain(CHANNELS.HISTORY_READ);
    expect(registered).toContain(CHANNELS.HISTORY_WRITE);
  });

  it('HISTORY_READ calls readHistory with slug', async () => {
    (fsHistory.readHistory as jest.Mock).mockResolvedValue({ content: '# My Shelter', missing: false });
    const handler = getHandler(CHANNELS.HISTORY_READ);
    const result = await handler(null, { slug: 'my-shelter', sheltersRoot: '/custom/shelters' });
    expect(fsHistory.readHistory).toHaveBeenCalledWith('my-shelter', '/custom/shelters');
    expect(result).toEqual({ content: '# My Shelter', missing: false });
  });

  it('HISTORY_WRITE calls writeHistory with slug and content', async () => {
    (fsHistory.writeHistory as jest.Mock).mockResolvedValue(undefined);
    const handler = getHandler(CHANNELS.HISTORY_WRITE);
    await handler(null, { slug: 'my-shelter', content: '# Updated', sheltersRoot: '/custom/shelters' });
    expect(fsHistory.writeHistory).toHaveBeenCalledWith('my-shelter', '# Updated', '/custom/shelters');
  });
});
