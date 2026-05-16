describe('logger', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('exports log.info as a function', async () => {
    const { log } = await import('./logger');
    expect(typeof log.info).toBe('function');
  });

  it('exports log.warn as a function', async () => {
    const { log } = await import('./logger');
    expect(typeof log.warn).toBe('function');
  });

  it('exports log.error as a function', async () => {
    const { log } = await import('./logger');
    expect(typeof log.error).toBe('function');
  });

  it('log.info does not throw', async () => {
    const { log } = await import('./logger');
    expect(() => log.info('test message')).not.toThrow();
  });

  it('log.transports.file.level is set to info', async () => {
    const { log } = await import('./logger');
    expect(log.transports.file.level).toBe('info');
  });

  it('log.transports.console.level is debug when app.isPackaged is false', async () => {
    const { app } = await import('electron');
    Object.defineProperty(app, 'isPackaged', { value: false, configurable: true });
    const { log } = await import('./logger');
    expect(log.transports.console.level).toBe('debug');
  });
});
