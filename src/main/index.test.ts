// Main process tests — electron APIs mocked via jest.config.cjs moduleNameMapper

jest.mock('fs');
jest.mock('./fs/thumbnails', () => ({
  getThumbnailPath: jest.fn(),
}));

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

  it('registers a View menu item with the macOS DevTools shortcut', async () => {
    const electron = await import('electron');
    await import('./index');
    const readyCalls = (electron.app.on as jest.Mock).mock.calls as Array<[string, () => void]>;
    const readyCall = readyCalls.find(([event]) => event === 'ready');
    if (readyCall) await readyCall[1]();

    expect(electron.Menu.buildFromTemplate).toHaveBeenCalled();
    const [template] = (electron.Menu.buildFromTemplate as jest.Mock).mock.calls[0] as [Array<{
      label: string;
      submenu?: Array<{ role?: string; accelerator?: string } | { type: string }>;
    }>];
    const viewMenu = template.find((item) => item.label === 'View');

    expect(viewMenu).toBeDefined();
    expect(viewMenu?.submenu).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'toggleDevTools', accelerator: 'Alt+Command+I' }),
    ]));
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

describe('shelter:// protocol handler — thumbnail size routing', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  async function getHandler() {
    const electron = await import('electron');
    await import('./index');
    const readyCalls = (electron.app.on as jest.Mock).mock.calls as Array<[string, () => void | Promise<void>]>;
    const readyCall = readyCalls.find(([event]) => event === 'ready');
    if (readyCall) await readyCall[1]();
    const handleCalls = (electron.protocol.handle as jest.Mock).mock.calls as Array<
      [string, (request: Request) => Promise<Response>]
    >;
    const shelterCall = handleCalls.find(([scheme]) => scheme === 'shelter');
    return shelterCall?.[1];
  }

  it('serves the original file when no size param is present', async () => {
    const fs = (await import('fs')).default;
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('original'));
    const { getThumbnailPath } = await import('./fs/thumbnails');

    const handler = await getHandler();
    const response = await handler!(new Request('shelter:///shelters/foo/photos/bar.jpg'));

    expect(getThumbnailPath).not.toHaveBeenCalled();
    expect(fs.readFileSync).toHaveBeenCalledWith('/shelters/foo/photos/bar.jpg');
    expect(response.status).not.toBe(404);
  });

  it('serves the cached thumbnail when ?size=grid resolves', async () => {
    const fs = (await import('fs')).default;
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('thumb'));
    const { getThumbnailPath } = await import('./fs/thumbnails');
    (getThumbnailPath as jest.Mock).mockResolvedValue('/userdata/photo-thumbnails/grid/bar-1.png');

    const handler = await getHandler();
    const response = await handler!(new Request('shelter:///shelters/foo/photos/bar.jpg?size=grid'));

    expect(getThumbnailPath).toHaveBeenCalledWith('/shelters/foo/photos/bar.jpg', 'grid');
    expect(fs.readFileSync).toHaveBeenCalledWith('/userdata/photo-thumbnails/grid/bar-1.png');
    expect(response.status).not.toBe(404);
  });

  it('falls back to the original file when thumbnail generation returns null', async () => {
    const fs = (await import('fs')).default;
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('original'));
    const { getThumbnailPath } = await import('./fs/thumbnails');
    (getThumbnailPath as jest.Mock).mockResolvedValue(null);

    const handler = await getHandler();
    const response = await handler!(new Request('shelter:///shelters/foo/photos/bar.jpg?size=preview'));

    expect(getThumbnailPath).toHaveBeenCalledWith('/shelters/foo/photos/bar.jpg', 'preview');
    expect(fs.readFileSync).toHaveBeenCalledWith('/shelters/foo/photos/bar.jpg');
    expect(response.status).not.toBe(404);
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
