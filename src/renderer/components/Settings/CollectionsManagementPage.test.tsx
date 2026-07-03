import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CollectionsManagementPage from './CollectionsManagementPage';
import type { CollectionStatus } from '../../../shared/ipc-types';

const STATUS: CollectionStatus[] = [
  {
    name: 'long-trail-news',
    total: 3,
    added: 2,
    cleaned: 1,
    files: [
      { name: 'a_clean.pdf', status: 'clean' },
      { name: 'b_raw.pdf', status: 'raw' },
      { name: 'c_new.pdf', status: 'missing' },
    ],
  },
];

async function renderPage() {
  (window.api.collections.status as jest.Mock).mockResolvedValue(STATUS);
  render(<CollectionsManagementPage />);
  await waitFor(() => expect(window.api.collections.status).toHaveBeenCalled());
  return screen.findByText('long-trail-news');
}

describe('CollectionsManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('sk-ant-x');
    (window.api.collections.run as jest.Mock).mockResolvedValue(
      { ok: true, converted: 1, cached: 0, failed: 0 });
    (window.api.collections.onProgress as jest.Mock).mockReturnValue(jest.fn());
  });

  it('shows the Collections Management title and keeps the API key card', async () => {
    await renderPage();
    expect(screen.getByText('§ Settings / Collections Management')).toBeInTheDocument();
    expect(screen.getByLabelText(/anthropic api key/i)).toBeInTheDocument();
  });

  it('shows no stale-index warning when the last build had no skips', async () => {
    (window.api.wiki.indexReport as jest.Mock).mockResolvedValue({ indexed: 40, skipped: 0, builtAt: 'x' });
    await renderPage();
    expect(screen.queryByText(/stale/i)).not.toBeInTheDocument();
  });

  it('warns about stale search entries from the last index build', async () => {
    (window.api.wiki.indexReport as jest.Mock).mockResolvedValue({ indexed: 40, skipped: 3, builtAt: 'x' });
    await renderPage();
    expect(await screen.findByText(/3 stale search entries/i)).toBeInTheDocument();
  });

  it('shows per-collection add/clean counts', async () => {
    await renderPage();
    expect(screen.getByText('1 of 3 to add')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 to clean')).toBeInTheDocument();
  });

  it('expanding a collection lists files with their status', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    expect(screen.getByText('a_clean.pdf')).toBeInTheDocument();
    expect(screen.getByText('cleaned')).toBeInTheDocument();
    expect(screen.getByText('needs cleanup')).toBeInTheDocument();
    expect(screen.getByText('needs addition')).toBeInTheDocument();
  });

  it('runs addition immediately when only pending files are selected', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /c_new\.pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to wiki \(1\)/i }));
    await waitFor(() => {
      expect(window.api.collections.run).toHaveBeenCalledWith({
        mode: 'add',
        files: ['collections/long-trail-news/c_new.pdf'],
        force: false,
      });
    });
  });

  it('collection checkbox selects every file and re-add asks for confirmation', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /select long-trail-news/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to wiki \(3\)/i }));

    // 2 of 3 are already added → confirm dialog
    expect(await screen.findByText(/2 of 3 selected files are already added/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /only the 1 pending/i }));
    await waitFor(() => {
      expect(window.api.collections.run).toHaveBeenCalledWith({
        mode: 'add',
        files: ['collections/long-trail-news/c_new.pdf'],
        force: false,
      });
    });
  });

  it('re-run all forces reconversion of everything selected', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /select long-trail-news/i }));
    fireEvent.click(screen.getByRole('button', { name: /clean up \(3\)/i }));

    expect(await screen.findByText(/1 of 3 selected files are already cleaned/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /re-run all 3/i }));
    await waitFor(() => {
      expect(window.api.collections.run).toHaveBeenCalledWith({
        mode: 'clean',
        files: [
          'collections/long-trail-news/a_clean.pdf',
          'collections/long-trail-news/b_raw.pdf',
          'collections/long-trail-news/c_new.pdf',
        ],
        force: true,
      });
    });
  });

  it('still saves the API key from this page', async () => {
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('');
    await renderPage();
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), {
      target: { value: 'sk-ant-new456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(window.api.ai.setApiKey).toHaveBeenCalledWith('sk-ant-new456');
    });
  });

  it('still rejects a malformed API key', async () => {
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('');
    await renderPage();
    fireEvent.change(screen.getByLabelText(/anthropic api key/i), {
      target: { value: 'not-a-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/should start with/i)).toBeInTheDocument();
    expect(window.api.ai.setApiKey).not.toHaveBeenCalled();
  });

  it('shows a file as cleaning then cleaned as progress events arrive', async () => {
    let resolveRun!: (result: { ok: boolean; converted: number; cached: number; failed: number }) => void;
    (window.api.collections.run as jest.Mock).mockReturnValue(
      new Promise((resolve) => { resolveRun = resolve; }),
    );

    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /b_raw\.pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /clean up \(1\)/i }));
    await waitFor(() => expect(window.api.collections.run).toHaveBeenCalled());

    const onProgress = (window.api.collections.onProgress as jest.Mock).mock.calls[0][0];
    const row = (await screen.findByText('b_raw.pdf')).closest('div')!;

    act(() => onProgress({ kind: 'proc', file: 'b_raw.pdf' }));
    expect(await within(row).findByText('cleaning')).toBeInTheDocument();

    act(() => onProgress({ kind: 'ok', file: 'b_raw.pdf' }));
    expect(await within(row).findByText('cleaned')).toBeInTheDocument();

    await act(async () => resolveRun({ ok: true, converted: 1, cached: 0, failed: 0 }));
  });

  it('shows a file as adding then needing cleanup once added', async () => {
    let resolveRun!: (result: { ok: boolean; converted: number; cached: number; failed: number }) => void;
    (window.api.collections.run as jest.Mock).mockReturnValue(
      new Promise((resolve) => { resolveRun = resolve; }),
    );

    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /c_new\.pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to wiki \(1\)/i }));
    await waitFor(() => expect(window.api.collections.run).toHaveBeenCalled());

    const onProgress = (window.api.collections.onProgress as jest.Mock).mock.calls[0][0];
    const row = (await screen.findByText('c_new.pdf')).closest('div')!;

    act(() => onProgress({ kind: 'proc', file: 'c_new.pdf' }));
    expect(await within(row).findByText('adding')).toBeInTheDocument();

    act(() => onProgress({ kind: 'ok', file: 'c_new.pdf' }));
    expect(await within(row).findByText('needs cleanup')).toBeInTheDocument();

    await act(async () => resolveRun({ ok: true, converted: 1, cached: 0, failed: 0 }));
  });

  it('reverts a failed file back to its prior status label', async () => {
    let resolveRun!: (result: { ok: boolean; converted: number; cached: number; failed: number }) => void;
    (window.api.collections.run as jest.Mock).mockReturnValue(
      new Promise((resolve) => { resolveRun = resolve; }),
    );

    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /b_raw\.pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /clean up \(1\)/i }));
    await waitFor(() => expect(window.api.collections.run).toHaveBeenCalled());

    const onProgress = (window.api.collections.onProgress as jest.Mock).mock.calls[0][0];
    const row = (await screen.findByText('b_raw.pdf')).closest('div')!;

    act(() => onProgress({ kind: 'proc', file: 'b_raw.pdf' }));
    expect(await within(row).findByText('cleaning')).toBeInTheDocument();

    act(() => onProgress({ kind: 'fail', file: 'b_raw.pdf' }));
    expect(await within(row).findByText('needs cleanup')).toBeInTheDocument();

    await act(async () => resolveRun({ ok: true, converted: 0, cached: 0, failed: 1 }));
  });

  it('clicking Edit header on a not-yet-added file warns instead of opening the editor', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('c_new.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /edit header/i }));
    expect(await screen.findByText(/needs to be added to the wiki first/i)).toBeInTheDocument();
    expect(window.api.wiki.getHeader).not.toHaveBeenCalled();
  });

  it('clicking Edit header on an added file opens the header editor with its contents', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue('---\ntype: "Newsletter"\n---\n');
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('a_clean.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /edit header/i }));
    expect(window.api.wiki.getHeader).toHaveBeenCalledWith('collections/long-trail-news/a_clean.pdf');
    expect(await screen.findByRole('textbox')).toHaveValue('---\ntype: "Newsletter"\n---\n');
  });

  it('saves the edited header and closes the modal', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue('---\ntype: "Newsletter"\n---\n');
    (window.api.wiki.saveHeader as jest.Mock).mockResolvedValue({ ok: true });
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('a_clean.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /edit header/i }));
    const textarea = await screen.findByRole('textbox');
    fireEvent.change(textarea, { target: { value: '---\ntype: "Magazine"\n---\n' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(window.api.wiki.saveHeader).toHaveBeenCalledWith(
      'collections/long-trail-news/a_clean.pdf', '---\ntype: "Magazine"\n---\n',
    ));
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('shows an error and keeps the modal open when saving the header fails', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue('---\ntype: "Newsletter"\n---\n');
    (window.api.wiki.saveHeader as jest.Mock).mockResolvedValue({ ok: false, error: 'disk is full' });
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('a_clean.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /edit header/i }));
    await screen.findByRole('textbox');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/disk is full/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('refreshes status after a run completes', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /c_new\.pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /add to wiki/i }));
    await waitFor(() => {
      expect(window.api.collections.status).toHaveBeenCalledTimes(2);
    });
  });
});
