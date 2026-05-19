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
    expect(keys).toEqual(['app', 'architectures', 'categories', 'history', 'mapMarkers', 'photos', 'shell', 'shelters', 'sources']);
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
    expect(typeof api.app.closeWindow).toBe('function');
    expect(typeof api.app.minimizeWindow).toBe('function');
    expect(typeof api.app.toggleFullscreen).toBe('function');
    expect(typeof api.app.isFullscreen).toBe('function');
  });
});
