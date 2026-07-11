import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import CollectionsManagementPage from './CollectionsManagementPage';
import type { CollectionStatus, WikiHeaderPayload } from '../../../shared/ipc-types';

const MAGAZINE_HEADER: WikiHeaderPayload = {
  citationType: 'magazine',
  fields: {
    title: 'Long Trail News',
    description: 'Long Trail News, December 1922.',
    language: 'en',
    publication_date: '1922-12',
    author: '',
    publisher: 'Green Mountain Club',
    edition: 'December',
    volume: '1922',
    printed_volume: '5',
    printed_issue: '2',
  },
  preserved: {
    type: 'Newsletter',
    resource: 'collections/long-trail-news/a_clean.pdf',
    timestamp: '2026-07-02T00:00:00Z',
    pages: '6',
  },
};

const STATUS: CollectionStatus[] = [
  {
    name: 'long-trail-news',
    total: 3,
    added: 2,
    cleaned: 1,
    citationType: null,
    defaults: { title: '', description: '', language: '', author: '', publisher: '' },
    files: [
      { name: 'a_clean.pdf', status: 'clean' },
      { name: 'b_raw.pdf', status: 'raw' },
      { name: 'c_new.pdf', status: 'missing' },
    ],
  },
];

let onOpenAiSettings: jest.Mock;

async function renderPage() {
  (window.api.collections.status as jest.Mock).mockResolvedValue(STATUS);
  render(<CollectionsManagementPage onOpenAiSettings={onOpenAiSettings} />);
  await waitFor(() => expect(window.api.collections.status).toHaveBeenCalled());
  return screen.findByText('long-trail-news');
}

describe('CollectionsManagementPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    onOpenAiSettings = jest.fn();
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('sk-ant-x');
    (window.api.collections.run as jest.Mock).mockResolvedValue(
      { ok: true, converted: 1, cached: 0, failed: 0 });
    (window.api.collections.onProgress as jest.Mock).mockReturnValue(jest.fn());
  });

  it('shows a loading spinner until collections have loaded, then the list', async () => {
    let resolveStatus!: (data: CollectionStatus[]) => void;
    (window.api.collections.status as jest.Mock).mockReturnValue(
      new Promise((resolve) => { resolveStatus = resolve; }),
    );
    render(<CollectionsManagementPage />);
    expect(screen.getByText(/loading collections/i)).toBeInTheDocument();
    expect(screen.queryByText('long-trail-news')).not.toBeInTheDocument();

    await act(async () => resolveStatus(STATUS));
    expect(screen.queryByText(/loading collections/i)).not.toBeInTheDocument();
    expect(screen.getByText('long-trail-news')).toBeInTheDocument();
  });

  it('shows the Collections title and no longer embeds the API key field', async () => {
    await renderPage();
    expect(screen.getByText('§ Settings / Collections')).toBeInTheDocument();
    expect(screen.queryByLabelText(/anthropic api key/i)).not.toBeInTheDocument();
  });

  it('shows a link-back note pointing to AI Settings in place of the key field', async () => {
    await renderPage();
    expect(screen.getByText(/anthropic api key/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ai settings/i }));
    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);
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

  it('clicking Open PDF opens the source PDF for that exact file', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('b_raw.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /open pdf/i }));
    await waitFor(() => {
      expect(window.api.wiki.openPdf).toHaveBeenCalledWith('collections/long-trail-news/b_raw.pdf');
    });
  });

  it('shows an error message when the PDF for that file is missing on disk', async () => {
    (window.api.wiki.openPdf as jest.Mock).mockResolvedValue({ ok: false });
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('b_raw.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /open pdf/i }));
    expect(await screen.findByText(/collections\/long-trail-news\/b_raw\.pdf is missing on disk/i)).toBeInTheDocument();
  });

  async function openCollectionDefaults() {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /edit collection defaults/i }));
  }

  it('opens a collection-defaults modal pre-filled from the collection\'s citation type and defaults', async () => {
    (window.api.collections.status as jest.Mock).mockResolvedValue([
      {
        ...STATUS[0],
        citationType: 'magazine',
        defaults: { title: 'Long Trail News', description: '', language: 'en', author: '', publisher: 'GMC' },
      },
    ]);
    render(<CollectionsManagementPage />);
    await screen.findByText('long-trail-news');
    fireEvent.click(screen.getByRole('button', { name: /edit collection defaults/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/citation type/i)).toHaveValue('magazine');
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Long Trail News');
    expect(screen.getByLabelText(/^publisher/i)).toHaveValue('GMC');
  });

  it('hides fields not applicable to the selected citation type', async () => {
    await openCollectionDefaults();
    fireEvent.change(screen.getByLabelText(/citation type/i), { target: { value: 'manuscript' } });
    expect(screen.queryByLabelText(/^publisher/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^author/i)).toBeInTheDocument();
  });

  it('saves citation type and defaults together, then refreshes', async () => {
    (window.api.collections.setDefaults as jest.Mock).mockResolvedValue({ ok: true, updated: 2 });
    await openCollectionDefaults();
    fireEvent.change(screen.getByLabelText(/citation type/i), { target: { value: 'magazine' } });
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Long Trail News' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(window.api.collections.setDefaults).toHaveBeenCalledWith({
      name: 'long-trail-news',
      oldCitationType: '',
      citationType: 'magazine',
      oldDefaults: { title: '', description: '', language: '', author: '', publisher: '' },
      defaults: { title: 'Long Trail News', description: '', language: '', author: '', publisher: '' },
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.api.collections.status).toHaveBeenCalledTimes(2);
  });

  it('shows an error and keeps the modal open when saving collection defaults fails', async () => {
    (window.api.collections.setDefaults as jest.Mock).mockResolvedValue({ ok: false, updated: 0, error: 'disk is full' });
    await openCollectionDefaults();
    fireEvent.change(screen.getByLabelText(/citation type/i), { target: { value: 'magazine' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/disk is full/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Add collection button opens a create dialog with an empty folder-name field', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add collection/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByLabelText(/folder name/i)).toHaveValue('');
  });

  it('rejects a duplicate or invalid folder name and blocks Create', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add collection/i }));
    fireEvent.change(screen.getByLabelText(/folder name/i), { target: { value: 'long-trail-news' } });
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/citation type/i), { target: { value: 'magazine' } });
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('creates a new collection, calling setDefaults with the typed name and no cascade', async () => {
    (window.api.collections.setDefaults as jest.Mock).mockResolvedValue({ ok: true, updated: 0 });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add collection/i }));
    fireEvent.change(screen.getByLabelText(/folder name/i), { target: { value: 'camels-hump-notes' } });
    fireEvent.change(screen.getByLabelText(/citation type/i), { target: { value: 'manuscript' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /create/i }));
    await waitFor(() => expect(window.api.collections.setDefaults).toHaveBeenCalledWith({
      name: 'camels-hump-notes',
      oldCitationType: '',
      citationType: 'manuscript',
      oldDefaults: {},
      defaults: { title: '', description: '', language: '', author: '', publisher: '' },
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.api.collections.status).toHaveBeenCalledTimes(2);
  });

  it('deletes a file after confirming, then refreshes', async () => {
    (window.api.collections.deleteFile as jest.Mock).mockResolvedValue({ ok: true });
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('b_raw.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /delete file/i }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(window.api.collections.deleteFile).toHaveBeenCalledWith({
      collection: 'long-trail-news', file: 'b_raw.pdf',
    }));
    expect(window.api.collections.status).toHaveBeenCalledTimes(2);
  });

  it('deletes a non-empty collection after a warning, then refreshes', async () => {
    (window.api.collections.delete as jest.Mock).mockResolvedValue({ ok: true });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /delete collection/i }));
    expect(await screen.findByText(/3 files?/i)).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^delete$/i }));
    await waitFor(() => expect(window.api.collections.delete).toHaveBeenCalledWith({ name: 'long-trail-news' }));
    expect(window.api.collections.status).toHaveBeenCalledTimes(2);
  });

  it('drops PDFs onto a collection, resolving real paths and calling addFiles', async () => {
    (window.api.app.getFilePath as jest.Mock)
      .mockReturnValueOnce('/Users/john/Desktop/new-issue.pdf')
      .mockReturnValueOnce('/Users/john/Desktop/photo.jpg');
    (window.api.collections.addFiles as jest.Mock).mockResolvedValue({ added: ['new-issue.pdf'], skipped: [] });
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const dropZone = await screen.findByText(/drag pdfs here/i);
    const file1 = new File(['a'], 'new-issue.pdf', { type: 'application/pdf' });
    const file2 = new File(['b'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.drop(dropZone, { dataTransfer: { files: [file1, file2] } });
    await waitFor(() => expect(window.api.collections.addFiles).toHaveBeenCalledWith({
      collection: 'long-trail-news',
      sourcePaths: ['/Users/john/Desktop/new-issue.pdf'],
    }));
    expect(window.api.collections.status).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/only pdfs are accepted/i)).toBeInTheDocument();
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

  it('prompts for a key with a link to AI Settings when cleaning up without one configured', async () => {
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('');
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    fireEvent.click(screen.getByRole('checkbox', { name: /select long-trail-news/i }));
    fireEvent.click(screen.getByRole('button', { name: /clean up \(3\)/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByText(/add it below/i)).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /ai settings/i }));
    expect(onOpenAiSettings).toHaveBeenCalledTimes(1);
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

  async function openHeaderEditor() {
    await renderPage();
    fireEvent.click(screen.getByText('long-trail-news'));
    const row = (await screen.findByText('a_clean.pdf')).closest('div')!;
    fireEvent.click(within(row).getByRole('button', { name: /edit header/i }));
  }

  it('renders one labeled control per applicable header property instead of a single text block', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    expect(window.api.wiki.getHeader).toHaveBeenCalledWith('collections/long-trail-news/a_clean.pdf');
    expect(await screen.findByLabelText(/^title/i)).toHaveValue('Long Trail News');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Long Trail News, December 1922.');
    expect(screen.getByLabelText(/^publisher/i)).toHaveValue('Green Mountain Club');
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(1);
    // preserved/system-derived fields are shown as text, not editable controls
    expect(screen.getByText(/collections\/long-trail-news\/a_clean\.pdf/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^resource$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^type$/i)).not.toBeInTheDocument();
  });

  it('renders language as a select with English pinned first', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    const languageSelect = await screen.findByLabelText(/^language/i);
    expect(languageSelect.tagName).toBe('SELECT');
    expect(languageSelect).toHaveValue('en');
    expect(within(languageSelect as HTMLElement).getAllByRole('option')[0]).toHaveTextContent('English');
  });

  it('renders publication date as a text field with a format hint', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    expect(await screen.findByLabelText(/publication date/i)).toHaveValue('1922-12');
  });

  it('blocks Save when publication date does not match an accepted format', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    fireEvent.change(await screen.findByLabelText(/publication date/i), { target: { value: 'not a date' } });
    expect(await screen.findByText(/publication_date.*must be a date/i)).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('still opens and flags an unrecognized on-disk citation type instead of erroring', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue({
      ...MAGAZINE_HEADER,
      citationType: 'not-a-real-type',
    });
    await openHeaderEditor();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/unrecognized/i);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('blocks Save when a required field is cleared', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    fireEvent.change(await screen.findByLabelText(/^publisher/i), { target: { value: '' } });
    const saveButton = within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    expect(window.api.wiki.saveHeader).not.toHaveBeenCalled();
  });

  it('blocks Save when a number field holds a non-numeric value', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    fireEvent.change(await screen.findByLabelText(/printed volume/i), { target: { value: 'not-a-number' } });
    expect(await screen.findByText(/printed_volume.*must be a number/i)).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('saves exactly the schema-applicable fields and closes the modal', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    (window.api.wiki.saveHeader as jest.Mock).mockResolvedValue({ ok: true });
    await openHeaderEditor();
    fireEvent.change(await screen.findByLabelText(/^title/i), { target: { value: 'Long Trail News (Revised)' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(window.api.wiki.saveHeader).toHaveBeenCalledWith(
      'collections/long-trail-news/a_clean.pdf',
      { citationType: 'magazine', fields: { ...MAGAZINE_HEADER.fields, title: 'Long Trail News (Revised)' } },
    ));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows an error and keeps the modal open when saving the header fails', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    (window.api.wiki.saveHeader as jest.Mock).mockResolvedValue({ ok: false, error: 'disk is full' });
    await openHeaderEditor();
    await screen.findByLabelText(/^title/i);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/disk is full/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('hides fields not applicable to a newly selected citation type', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    await screen.findByLabelText(/^title/i);
    expect(screen.getByLabelText(/^volume/i)).toBeInTheDocument();
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/citation type/i), { target: { value: 'map' } });
    expect(screen.queryByLabelText(/^volume/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/printed volume/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/printed issue/i)).not.toBeInTheDocument();
  });

  it('retains a value in a field shared between the old and new citation type', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    await openHeaderEditor();
    await screen.findByLabelText(/^title/i);
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/citation type/i), { target: { value: 'map' } });
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Long Trail News');
  });

  it('does not send a value from a field the newly selected citation type marks n/a', async () => {
    (window.api.wiki.getHeader as jest.Mock).mockResolvedValue(MAGAZINE_HEADER);
    (window.api.wiki.saveHeader as jest.Mock).mockResolvedValue({ ok: true });
    await openHeaderEditor();
    await screen.findByLabelText(/^title/i);
    fireEvent.change(within(screen.getByRole('dialog')).getByLabelText(/citation type/i), { target: { value: 'map' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(window.api.wiki.saveHeader).toHaveBeenCalled());
    const [, payload] = (window.api.wiki.saveHeader as jest.Mock).mock.calls[0];
    expect(payload.fields.volume).toBeUndefined();
    expect(payload.fields.printed_volume).toBeUndefined();
    expect(payload.fields.printed_issue).toBeUndefined();
    expect(payload.fields.title).toBe('Long Trail News');
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
