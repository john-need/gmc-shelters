// Red-phase gate for T019 (preload bridge)

describe('preload contextBridge', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('calls contextBridge.exposeInMainWorld with "api"', async () => {
    const { contextBridge } = await import('electron');
    await import('./preload');
    expect(contextBridge.exposeInMainWorld).toHaveBeenCalledWith('api', expect.any(Object));
  });

  it('exposed api has the correct top-level namespaces', async () => {
    const { contextBridge } = await import('electron');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as [string, Record<string, unknown>];
    const keys = Object.keys(api).sort();
    expect(keys).toEqual(['ai', 'app', 'architectures', 'categories', 'collections', 'export', 'history', 'mapMarkers', 'photos', 'publish', 'research', 'shell', 'shelters', 'sources', 'wiki']);
  });

  it('shelters.getAll is a function', async () => {
    const { contextBridge } = await import('electron');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as [string, Record<string, Record<string, unknown>>];
    expect(typeof api.shelters.getAll).toBe('function');
  });

  it('app window controls are exposed as functions', async () => {
    const { contextBridge } = await import('electron');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as [string, Record<string, Record<string, unknown>>];
    expect(typeof api.app.browseForDatabasePath).toBe('function');
    expect(typeof api.app.browseForDirectoryPath).toBe('function');
    expect(typeof api.app.validatePath).toBe('function');
    expect(typeof api.app.closeWindow).toBe('function');
    expect(typeof api.app.minimizeWindow).toBe('function');
    expect(typeof api.app.toggleFullscreen).toBe('function');
    expect(typeof api.app.isFullscreen).toBe('function');
  });

  it('photos.reorder is exposed as a function', async () => {
    const { contextBridge } = await import('electron');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as [string, Record<string, Record<string, unknown>>];
    expect(typeof api.photos.reorder).toBe('function');
  });

  it('photos.move forwards to CHANNELS.PHOTOS_MOVE with the right payload', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { photos: { move: (photoId: number, targetShelterId: number, sheltersRoot: string) => Promise<unknown> } }];

    expect(typeof api.photos.move).toBe('function');
    await api.photos.move(10, 3, '/base/shelters');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.PHOTOS_MOVE, { photoId: 10, targetShelterId: 3, sheltersRoot: '/base/shelters' });
  });

  it('photos.moveToUnidentified forwards to CHANNELS.PHOTOS_MOVE_TO_UNIDENTIFIED with the right payload', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { photos: { moveToUnidentified: (photoId: number, sheltersRoot: string) => Promise<unknown> } }];

    expect(typeof api.photos.moveToUnidentified).toBe('function');
    await api.photos.moveToUnidentified(10, '/base/shelters');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.PHOTOS_MOVE_TO_UNIDENTIFIED, { photoId: 10, sheltersRoot: '/base/shelters' });
  });

  it('photos.openFolder forwards to CHANNELS.PHOTOS_OPEN_FOLDER with slug and sheltersRoot', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { photos: { openFolder: (slug: string, sheltersRoot: string) => Promise<unknown> } }];

    expect(typeof api.photos.openFolder).toBe('function');
    await api.photos.openFolder('test-shelter', '/base/shelters');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.PHOTOS_OPEN_FOLDER, { slug: 'test-shelter', sheltersRoot: '/base/shelters' });
  });

  it('research.webSearch is exposed as a function that invokes CHANNELS.RESEARCH_WEB_SEARCH with the query and an optional context', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { research: { webSearch: (query: string, context?: string) => Promise<unknown> } }];

    expect(typeof api.research.webSearch).toBe('function');
    await api.research.webSearch('Aeolus View Camp', 'Shelter: Aeolus View Camp');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.RESEARCH_WEB_SEARCH, 'Aeolus View Camp', 'Shelter: Aeolus View Camp');
  });

  it('history.generate is exposed as a function that invokes CHANNELS.HISTORY_GENERATE with the given request', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { history: { generate: (request: unknown) => Promise<unknown> } }];

    expect(typeof api.history.generate).toBe('function');
    const req = { shelter: { name: 'Aeolus View Camp' }, citations: [], currentHistory: '' };
    await api.history.generate(req);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.HISTORY_GENERATE, req);
  });
});
