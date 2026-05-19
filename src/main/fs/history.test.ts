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
      const result = await readHistory('test-shelter');
      expect(result).toBe('# Test Shelter\n\nSome history.');
    });

    it('returns empty string when file does not exist', async () => {
      (fsp.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const result = await readHistory('missing-shelter');
      expect(result).toBe('');
    });

    it('constructs the path using app.getAppPath and slug', async () => {
      (fsp.readFile as jest.Mock).mockResolvedValue('');
      await readHistory('my-slug');
      expect(fsp.readFile).toHaveBeenCalledWith(
        '/base/shelters/my-slug/my-slug.md',
        'utf8',
      );
    });
  });

  describe('writeHistory', () => {
    it('creates directory and writes file', async () => {
      (fsp.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fsp.writeFile as jest.Mock).mockResolvedValue(undefined);
      await writeHistory('my-slug', '# Content');
      expect(fsp.mkdir).toHaveBeenCalledWith('/base/shelters/my-slug', { recursive: true });
      expect(fsp.writeFile).toHaveBeenCalledWith(
        '/base/shelters/my-slug/my-slug.md',
        '# Content',
        'utf8',
      );
    });
  });
});
