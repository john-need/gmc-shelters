jest.mock('better-sqlite3');
jest.mock('electron');
jest.mock('fs');

describe('db/connection', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('calls app.getAppPath to locate the database', async () => {
    const { app } = await import('electron');
    (app.getAppPath as jest.Mock).mockReturnValue('/tmp/app');
    const { default: Database } = await import('better-sqlite3');
    const fs = (await import('fs')).default;
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const mockDb = {
      pragma: jest.fn(),
      prepare: jest.fn().mockReturnValue({ all: jest.fn().mockReturnValue([]) }),
    };
    (Database as jest.Mock).mockReturnValue(mockDb);

    const { getDb } = await import('./connection');
    getDb();

    expect(app.getAppPath).toHaveBeenCalled();
    expect(Database).toHaveBeenCalledWith(expect.stringContaining('gmc_shelters.sqlite'));
  });

  it('returns the same instance on repeated calls (singleton)', async () => {
    const { app } = await import('electron');
    (app.getAppPath as jest.Mock).mockReturnValue('/tmp/app');
    const { default: Database } = await import('better-sqlite3');
    const fs = (await import('fs')).default;
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const mockDb = {
      pragma: jest.fn(),
      prepare: jest.fn().mockReturnValue({ all: jest.fn().mockReturnValue([]) }),
    };
    (Database as jest.Mock).mockReturnValue(mockDb);

    const { getDb } = await import('./connection');
    const a = getDb();
    const b = getDb();

    expect(a).toBe(b);
    expect(Database).toHaveBeenCalledTimes(1);
  });

  it('sets WAL journal mode', async () => {
    const { app } = await import('electron');
    (app.getAppPath as jest.Mock).mockReturnValue('/tmp/app');
    const { default: Database } = await import('better-sqlite3');
    const fs = (await import('fs')).default;
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const mockDb = {
      pragma: jest.fn(),
      prepare: jest.fn().mockReturnValue({ all: jest.fn().mockReturnValue([]) }),
    };
    (Database as jest.Mock).mockReturnValue(mockDb);

    const { getDb } = await import('./connection');
    getDb();

    expect(mockDb.pragma).toHaveBeenCalledWith('journal_mode = WAL');
    expect(mockDb.pragma).toHaveBeenCalledWith('foreign_keys = ON');
  });
});
