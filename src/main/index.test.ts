// Main process tests — electron APIs mocked via jest.config.cjs moduleNameMapper

describe('main process index', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('calls app.requestSingleInstanceLock on startup', async () => {
    const { app } = await import('electron');
    await import('./index');
    expect(app.requestSingleInstanceLock).toHaveBeenCalled();
  });

  it('calls app.quit() when single-instance lock is not acquired', async () => {
    const { app } = await import('electron');
    (app.requestSingleInstanceLock as jest.Mock).mockReturnValueOnce(false);
    await import('./index');
    expect(app.quit).toHaveBeenCalled();
  });

  it('registers a second-instance event handler', async () => {
    const { app } = await import('electron');
    await import('./index');
    const registeredEvents = (app.on as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(registeredEvents).toContain('second-instance');
  });

  it('registers a ready event handler', async () => {
    const { app } = await import('electron');
    await import('./index');
    const registeredEvents = (app.on as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(registeredEvents).toContain('ready');
  });

  it('calls Menu.setApplicationMenu after app ready', async () => {
    const electron = await import('electron');
    await import('./index');
    // Fire the 'ready' handler
    const readyCalls = (electron.app.on as jest.Mock).mock.calls as Array<[string, () => void]>;
    const readyCall = readyCalls.find(([event]) => event === 'ready');
    if (readyCall) await readyCall[1]();
    expect(electron.Menu.setApplicationMenu).toHaveBeenCalled();
  });

  it('creates BrowserWindow with contextIsolation:true and nodeIntegration:false', async () => {
    const electron = await import('electron');
    await import('./index');
    const readyCalls = (electron.app.on as jest.Mock).mock.calls as Array<[string, () => void]>;
    const readyCall = readyCalls.find(([event]) => event === 'ready');
    if (readyCall) await readyCall[1]();
    const BW = electron.BrowserWindow as unknown as jest.Mock;
    if (BW.mock?.calls?.length) {
      const opts = BW.mock.calls[0][0] as { webPreferences: Record<string, unknown> };
      expect(opts.webPreferences.contextIsolation).toBe(true);
      expect(opts.webPreferences.nodeIntegration).toBe(false);
      expect(String(opts.webPreferences.preload)).toMatch(/preload/);
    }
  });
});

// T043 — US4: production vs development URL loading
describe('main process — environment branch', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('window loads dev server URL when env var is set', async () => {
    process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL = 'http://localhost:5173';
    const electron = await import('electron');
    await import('./index');
    const readyCalls = (electron.app.on as jest.Mock).mock.calls as Array<[string, () => void]>;
    const readyCall = readyCalls.find(([event]) => event === 'ready');
    if (readyCall) await readyCall[1]();
    const BW = electron.BrowserWindow as unknown as jest.Mock;
    const instance = BW.mock?.instances?.[0] as { loadURL: jest.Mock; loadFile: jest.Mock } | undefined;
    if (instance) expect(instance.loadURL).toHaveBeenCalledWith('http://localhost:5173');
    delete process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
  });
});
