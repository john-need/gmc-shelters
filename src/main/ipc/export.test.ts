import { ipcMain, BrowserWindow } from 'electron';
import { CHANNELS } from '@shared/ipc-types';

jest.mock('electron');
jest.mock('../export/index');

import { registerExportHandlers } from './export';
import { runExport } from '../export/index';

const mockRunExport = runExport as jest.Mock;
const mockIpcMain = ipcMain as jest.Mocked<typeof ipcMain>;

describe('registerExportHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunExport.mockResolvedValue({ cancelled: false, savedTo: '/tmp/out.zip', shelterCount: 1, photoCount: 2, skippedPhotos: 0 });
  });

  it('registers ipcMain.handle for EXPORT_BUILD channel', () => {
    registerExportHandlers();
    expect(mockIpcMain.handle).toHaveBeenCalledWith(CHANNELS.EXPORT_BUILD, expect.any(Function));
  });

  it('calls runExport when the handler is invoked', async () => {
    const fakeWindow = {};
    const bw = BrowserWindow as unknown as { fromWebContents: jest.Mock };
    bw.fromWebContents = jest.fn().mockReturnValue(fakeWindow);

    registerExportHandlers();
    const [[, handler]] = mockIpcMain.handle.mock.calls;
    const fakeEvent = { sender: {} } as Electron.IpcMainInvokeEvent;
    await handler(fakeEvent);
    expect(mockRunExport).toHaveBeenCalledTimes(1);
  });
});
