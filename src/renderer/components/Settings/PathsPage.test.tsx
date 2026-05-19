import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PathsPage from './PathsPage';

describe('PathsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    (window.api.app.browseForDatabasePath as jest.Mock).mockResolvedValue(null);
    (window.api.app.browseForDirectoryPath as jest.Mock).mockResolvedValue(null);
    (window.api.app.validatePath as jest.Mock).mockImplementation(async (input: string) => ({
      input,
      resolvedPath: input.startsWith('/') ? input : `/repo/${input}`,
      exists: true,
      isFile: input.toLowerCase().endsWith('.sqlite'),
      isDirectory: !input.toLowerCase().endsWith('.sqlite'),
    }));
  });

  it('shows only database and shelters root controls', () => {
    render(<PathsPage />);

    expect(screen.getByDisplayValue('database/gmc_shelters.sqlite')).toBeInTheDocument();
    expect(screen.getByDisplayValue('shelters/')).toBeInTheDocument();
    expect(screen.queryByText('PHOTOS_PATH')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /browse for/i })).toHaveLength(2);
  });

  it('updates the database field from the native picker', async () => {
    (window.api.app.browseForDatabasePath as jest.Mock).mockResolvedValue('/Volumes/data/gmc.sqlite3');

    render(<PathsPage />);
    fireEvent.click(screen.getByRole('button', { name: /browse for database/i }));

    await waitFor(() => {
      expect(window.api.app.browseForDatabasePath).toHaveBeenCalledWith('database/gmc_shelters.sqlite');
      expect(screen.getByDisplayValue('/Volumes/data/gmc.sqlite3')).toBeInTheDocument();
    });
  });

  it('blocks save when the database value is not a SQLite-looking filename', async () => {
    render(<PathsPage />);

    fireEvent.change(screen.getByDisplayValue('database/gmc_shelters.sqlite'), {
      target: { value: '/tmp/not-a-database.txt' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save paths/i }));

    expect(await screen.findByText(/database must end in/i)).toBeInTheDocument();
    expect(window.api.app.validatePath).not.toHaveBeenCalled();
    expect(localStorage.getItem('gmc.paths')).toBeNull();
  });

  it('blocks save when shelters root does not resolve to a directory', async () => {
    (window.api.app.validatePath as jest.Mock)
      .mockResolvedValueOnce({
        input: '/tmp/gmc.sqlite',
        resolvedPath: '/tmp/gmc.sqlite',
        exists: true,
        isFile: true,
        isDirectory: false,
      })
      .mockResolvedValueOnce({
        input: '/tmp/not-a-folder',
        resolvedPath: '/tmp/not-a-folder',
        exists: true,
        isFile: true,
        isDirectory: false,
      });

    render(<PathsPage />);

    fireEvent.change(screen.getByDisplayValue('database/gmc_shelters.sqlite'), {
      target: { value: '/tmp/gmc.sqlite' },
    });
    fireEvent.change(screen.getByDisplayValue('shelters/'), {
      target: { value: '/tmp/not-a-folder' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save paths/i }));

    expect(await screen.findByText(/shelters root must point to an existing folder/i)).toBeInTheDocument();
    expect(localStorage.getItem('gmc.paths')).toBeNull();
  });

  it('saves validated database and shelters root values', async () => {
    (window.api.app.validatePath as jest.Mock)
      .mockResolvedValueOnce({
        input: '/tmp/gmc.sqlite3',
        resolvedPath: '/tmp/gmc.sqlite3',
        exists: true,
        isFile: true,
        isDirectory: false,
      })
      .mockResolvedValueOnce({
        input: '/tmp/shelters',
        resolvedPath: '/tmp/shelters',
        exists: true,
        isFile: false,
        isDirectory: true,
      });

    render(<PathsPage />);

    fireEvent.change(screen.getByDisplayValue('database/gmc_shelters.sqlite'), {
      target: { value: '/tmp/gmc.sqlite3' },
    });
    fireEvent.change(screen.getByDisplayValue('shelters/'), {
      target: { value: '/tmp/shelters' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save paths/i }));

    await waitFor(() => {
      expect(localStorage.getItem('gmc.paths')).toBe(
        JSON.stringify({
          DB_PATH: '/tmp/gmc.sqlite3',
          SHELTERS_ROOT: '/tmp/shelters',
        }),
      );
    });
    expect(screen.queryByText(/must point to/i)).not.toBeInTheDocument();
  });
});
