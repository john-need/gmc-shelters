jest.mock('fs/promises');
jest.mock('electron');
jest.mock('../logger', () => ({ log: { info: jest.fn(), error: jest.fn() } }));

import * as fsp from 'fs/promises';
import { app } from 'electron';
import { readHistory, writeHistory } from './history';

beforeEach(() => {
  jest.clearAllMocks();
  (app.getAppPath as jest.Mock).mockReturnValue('/base');
});

describe('fs/history', () => {
  describe('readHistory', () => {
    it('returns file content when it exists', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue('# Test Shelter\n\nSome history.');
      const result = await readHistory('test-shelter/test-shelter.md', '/custom/shelters');
      expect(result).toEqual({ content: '# Test Shelter\n\nSome history.', missing: false });
    });

    it('returns a missing result when file does not exist', async () => {
      const error = new Error('ENOENT') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fsp.readFile as jest.Mock).mockRejectedValue(error);
      const result = await readHistory('missing-shelter/missing-shelter.md', '/custom/shelters');
      expect(result).toEqual({ content: '', missing: true });
    });

    it('constructs the path using the provided shelters root and historyRelPath', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue('');
      await readHistory('my-slug/my-slug.md', '/custom/shelters');
      expect(fsp.readFile).toHaveBeenCalledWith(
        '/custom/shelters/my-slug/my-slug.md',
        'utf8',
      );
    });

    it('resolves a relative shelters root against app.getAppPath', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue('');
      await readHistory('my-slug/my-slug.md', 'custom/shelters');
      expect(fsp.readFile).toHaveBeenCalledWith(
        '/base/custom/shelters/my-slug/my-slug.md',
        'utf8',
      );
    });
  });

  describe('writeHistory', () => {
    it('creates directory and writes file', async () => {
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsp.writeFile as jest.Mock).mockResolvedValue(undefined);
      await writeHistory('my-slug/my-slug.md', '# Content', '/custom/shelters');
      expect(fsp.mkdir).toHaveBeenCalledWith('/custom/shelters/my-slug', { recursive: true });
      expect(fsp.writeFile).toHaveBeenCalledWith(
        '/custom/shelters/my-slug/my-slug.md',
        '# Content',
        'utf8',
      );
    });
  });
});
