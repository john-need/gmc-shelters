jest.mock('./server', () => ({
  startMcpServer: jest.fn(() => ({ close: jest.fn((cb?: () => void) => cb?.()) })),
  stopMcpServer: jest.fn((server: { close: (cb?: () => void) => void }) => new Promise<void>((resolve) => server.close(() => resolve()))),
}));

import { startMcpServer, stopMcpServer } from './server';
import { setMcpServerRunning, isMcpServerRunning } from './manager';

describe('mcp/manager', () => {
  beforeEach(async () => {
    // drain any server left running by a previous test, before resetting mock call counts
    if (isMcpServerRunning()) await setMcpServerRunning(false);
    jest.clearAllMocks();
  });

  it('starts the server when turned on, and reports running', async () => {
    await setMcpServerRunning(true);
    expect(startMcpServer).toHaveBeenCalledTimes(1);
    expect(isMcpServerRunning()).toBe(true);
  });

  it('stops the server when turned off, and reports not running', async () => {
    await setMcpServerRunning(true);
    await setMcpServerRunning(false);
    expect(stopMcpServer).toHaveBeenCalledTimes(1);
    expect(isMcpServerRunning()).toBe(false);
  });

  it('is idempotent — turning on twice only starts one server', async () => {
    await setMcpServerRunning(true);
    await setMcpServerRunning(true);
    expect(startMcpServer).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — turning off twice without starting does nothing', async () => {
    await setMcpServerRunning(false);
    expect(stopMcpServer).not.toHaveBeenCalled();
  });
});
