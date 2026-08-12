import { ipcMain, BrowserWindow } from 'electron';
import { CHANNELS } from '@shared/ipc-types';

jest.mock('electron');
jest.mock('../export/index');

import { registerExportHandlers } from './export';
import { runExport } from '../export/index';

const mockRunExport = runExport as jest.Mock;
const mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>;

function getHandler(channel: string): (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown> {
  const call = mockIpcMain.handle.mock.calls.find(([ch]) => ch === channel);
  if (!call) throw new Error(`No handler registered for ${channel}`);
  return call[1] as (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>;
}

describe('registerExportHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunExport.mockResolvedValue({ cancelled: false, savedTo: '/tmp/out.zip', shelterCount: 1, photoCount: 2, skippedPhotos: 0 });

    const bw = BrowserWindow as unknown as { fromWebContents: jest.Mock };
    bw.fromWebContents = jest.fn().mockReturnValue({});
  });

  it('registers ipcMain.handle for EXPORT_BUILD channel', () => {
    registerExportHandlers();
    expect(mockIpcMain.handle).toHaveBeenCalledWith(CHANNELS.EXPORT_BUILD, expect.any(Function));
  });

  it('registers ipcMain.handle for EXPORT_CANCEL channel', () => {
    registerExportHandlers();
    expect(mockIpcMain.handle).toHaveBeenCalledWith(CHANNELS.EXPORT_CANCEL, expect.any(Function));
  });

  it('calls runExport when the handler is invoked', async () => {
    registerExportHandlers();
    const fakeEvent = { sender: {} } as Electron.IpcMainInvokeEvent;
    await getHandler(CHANNELS.EXPORT_BUILD)(fakeEvent);
    expect(mockRunExport).toHaveBeenCalledTimes(1);
  });

  it('passes an onProgress callback that sends EXPORT_PROGRESS to the invoking sender', async () => {
    registerExportHandlers();
    const send = jest.fn();
    const fakeEvent = { sender: { send } } as unknown as Electron.IpcMainInvokeEvent;
    await getHandler(CHANNELS.EXPORT_BUILD)(fakeEvent);

    const onProgress = mockRunExport.mock.calls[0][2] as (p: unknown) => void;
    onProgress({ stage: 'building', current: 1, total: 2 });
    expect(send).toHaveBeenCalledWith(CHANNELS.EXPORT_PROGRESS, { stage: 'building', current: 1, total: 2 });
  });

  it('passes an isCancelled callback that flips to true once EXPORT_CANCEL is invoked', async () => {
    registerExportHandlers();
    const fakeEvent = { sender: {} } as Electron.IpcMainInvokeEvent;

    const buildPromise = getHandler(CHANNELS.EXPORT_BUILD)(fakeEvent);
    const isCancelled = mockRunExport.mock.calls[0][3] as () => boolean;
    expect(isCancelled()).toBe(false);

    await getHandler(CHANNELS.EXPORT_CANCEL)(fakeEvent);
    expect(isCancelled()).toBe(true);

    await buildPromise;
  });

  it('resets cancellation state at the start of each new EXPORT_BUILD call', async () => {
    registerExportHandlers();
    const fakeEvent = { sender: {} } as Electron.IpcMainInvokeEvent;

    await getHandler(CHANNELS.EXPORT_BUILD)(fakeEvent);
    await getHandler(CHANNELS.EXPORT_CANCEL)(fakeEvent);

    await getHandler(CHANNELS.EXPORT_BUILD)(fakeEvent);
    const secondIsCancelled = mockRunExport.mock.calls[1][3] as () => boolean;
    expect(secondIsCancelled()).toBe(false);
  });
});
