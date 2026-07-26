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
    expect(keys).toEqual(['ai', 'app', 'architectures', 'categories', 'collections', 'export', 'history', 'mapMarkers', 'mcp', 'photos', 'publish', 'research', 'shell', 'shelters', 'sources', 'wiki']);
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

  it('history.onGenerateProgress subscribes/unsubscribes on CHANNELS.HISTORY_GENERATE_PROGRESS', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { history: { onGenerateProgress: (cb: (evt: unknown) => void) => () => void } }];

    const callback = jest.fn();
    const unsubscribe = api.history.onGenerateProgress(callback);
    expect(ipcRenderer.on).toHaveBeenCalledWith(CHANNELS.HISTORY_GENERATE_PROGRESS, expect.any(Function));

    const handler = (ipcRenderer.on as jest.Mock).mock.calls[0][1];
    handler(null, { type: 'text', text: 'hi' });
    expect(callback).toHaveBeenCalledWith({ type: 'text', text: 'hi' });

    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(CHANNELS.HISTORY_GENERATE_PROGRESS, handler);
  });

  it('shelters.generateDescription is exposed as a function that invokes CHANNELS.SHELTER_GENERATE_DESCRIPTION with the request', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { shelters: { generateDescription: (request: unknown) => Promise<unknown> } }];

    expect(typeof api.shelters.generateDescription).toBe('function');
    const req = { shelter: { name: 'Aeolus View Camp' }, historyContent: '' };
    await api.shelters.generateDescription(req);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.SHELTER_GENERATE_DESCRIPTION, req);
  });

  it('wiki.findResource forwards the criteria to CHANNELS.WIKI_FIND_RESOURCE', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { wiki: { findResource: (criteria: unknown) => Promise<string | null> } }];

    const criteria = { title: 'Long Trail News', date: '1963-08', year: 1963 };
    await api.wiki.findResource(criteria);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.WIKI_FIND_RESOURCE, criteria);
  });

  it('mcp.getEnabled/setEnabled/getConnectionInfo forward to their channels', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { mcp: {
        getEnabled: () => Promise<boolean>;
        setEnabled: (enabled: boolean) => Promise<void>;
        getConnectionInfo: () => Promise<unknown>;
      } }];

    await api.mcp.getEnabled();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.MCP_GET_ENABLED);

    await api.mcp.setEnabled(true);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.MCP_SET_ENABLED, { enabled: true });

    await api.mcp.getConnectionInfo();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.MCP_GET_CONNECTION_INFO);
  });

  it('history.respondToPermission forwards to CHANNELS.HISTORY_GENERATE_RESPOND with the requestId and approval', async () => {
    const { contextBridge, ipcRenderer } = await import('electron');
    const { CHANNELS } = await import('@shared/ipc-types');
    await import('./preload');
    const [, api] = (contextBridge.exposeInMainWorld as jest.Mock).mock.calls[0] as
      [string, { history: { respondToPermission: (requestId: string, approved: boolean) => Promise<void> } }];

    await api.history.respondToPermission('tool_1', true);
    expect(ipcRenderer.invoke).toHaveBeenCalledWith(CHANNELS.HISTORY_GENERATE_RESPOND, { requestId: 'tool_1', approved: true });
  });
});
