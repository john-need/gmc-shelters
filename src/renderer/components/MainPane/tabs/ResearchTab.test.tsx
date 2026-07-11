import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import sourcesReducer from '../../../store/sourcesSlice';
import uiReducer from '../../../store/uiSlice';
import researchReducer from '../../../store/researchSlice';
import ResearchTab from './ResearchTab';
import type { CollectionStatus, Shelter, WikiSearchResult, WebSearchResponse } from '../../../../shared/ipc-types';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const COLLECTION_A: CollectionStatus = {
  name: 'long-trail-news', total: 1, added: 1, cleaned: 1, files: [], citationType: null, defaults: {},
};
const COLLECTION_B: CollectionStatus = {
  name: 'trail-guide', total: 1, added: 1, cleaned: 1, files: [], citationType: null, defaults: {},
};

const SHELTER = {
  id: 7,
  name: 'Aeolus View Camp',
  slug: 'aeolus-view-camp',
} as Shelter;

const PAGE_HIT: WikiSearchResult = {
  path: 'long-trail-news/1922_12_Dec.md',
  okf_type: 'Newsletter',
  title: 'Long Trail News',
  publisher: 'Green Mountain Club',
  volume: '1922',
  edition: 'December',
  printed_volume: '5',
  printed_issue: '2',
  author: '',
  publication_date: '1922-12',
  resource: 'collections/long-trail-news/1922_12_Dec.pdf',
  citation_type: 'magazine',
  kind: 'page',
  page: 2,
  image: '',
  snippet: '<mark>Monroe Lodge</mark> will be built next year',
};

const BOOK_HIT: WikiSearchResult = {
  path: 'books/Long Trail System Shelter History.md',
  okf_type: 'Book',
  title: 'Long Trail System Shelter History',
  publisher: 'Green Mountain Club',
  volume: '',
  edition: '2nd',
  printed_volume: '',
  printed_issue: '',
  author: 'Woodward, Paul & Joanne',
  publication_date: '1999-09-29',
  resource: 'collections/Books/Long Trail System Shelter History.pdf',
  citation_type: 'book',
  kind: 'page',
  page: 42,
  image: '',
  snippet: '<mark>Monroe</mark> Lodge shelter history',
};

// Reproduces a real indexed document whose OKF header is missing author and
// publication_date, and whose title equals its own collection folder name
// ("Long Trail News") — both are legitimate, not signs of a missing title.
const AUGUST_1946_HIT: WikiSearchResult = {
  path: 'Long Trail News/1946_08_Aug.md',
  okf_type: 'Newsletter',
  title: 'Long Trail News',
  publisher: 'Green Mountain Club',
  volume: '1946',
  edition: 'August',
  printed_volume: '',
  printed_issue: '',
  author: '',
  publication_date: '',
  resource: 'collections/Long Trail News/1946_08_Aug.pdf',
  citation_type: 'magazine',
  kind: 'page',
  page: 5,
  image: '',
  snippet: 'Kandahar Lodge is especially desirable to folks',
};

const ILLUSTRATION_HIT: WikiSearchResult = {
  ...PAGE_HIT,
  kind: 'illustration',
  page: 3,
  image: 'long-trail-news/images/1922_12_Dec_p3_0.png',
  snippet: '<mark>Monroe Lodge</mark> under construction',
};

function makeStore() {
  return configureStore({
    reducer: {
      shelters: sheltersReducer, sources: sourcesReducer, ui: uiReducer, research: researchReducer,
    },
    preloadedState: {
      shelters: {
        list: [SHELTER], selectedId: 7, editBuffer: SHELTER,
        loading: false, saving: false, dirty: false,
        historyContent: '', historyOriginal: '', historyDirty: false, historyMissing: false,
      },
    },
  });
}

async function renderWithResults(results: WikiSearchResult[]) {
  (window.api.wiki.search as jest.Mock).mockResolvedValue(results);
  render(
    <Provider store={makeStore()}>
      <ResearchTab />
    </Provider>,
  );
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Monroe' } });
  await waitFor(() => expect(window.api.wiki.search).toHaveBeenCalledWith('Monroe'));
}

describe('ResearchTab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows a no-active-search message in Collections before any query is typed', () => {
    render(<Provider store={makeStore()}><ResearchTab /></Provider>);
    expect(screen.getByText(/no active search/i)).toBeInTheDocument();
  });

  it('replaces the no-active-search message with "no results" once a query returns nothing', async () => {
    (window.api.wiki.search as jest.Mock).mockResolvedValue([]);
    render(<Provider store={makeStore()}><ResearchTab /></Provider>);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'xyzzy' } });
    await waitFor(() => expect(window.api.wiki.search).toHaveBeenCalledWith('xyzzy'));
    expect(await screen.findByText(/no results for/i)).toBeInTheDocument();
    expect(screen.queryByText(/no active search/i)).not.toBeInTheDocument();
  });

  it('shows title, edition, and date on line one and author/publisher/pages on line two', async () => {
    await renderWithResults([PAGE_HIT]);
    expect(await screen.findByText(/monroe lodge/i)).toBeInTheDocument();
    expect(screen.getByText('Long Trail News')).toBeInTheDocument();
    expect(screen.getByText('ed. December (1922-12)')).toBeInTheDocument();
    expect(screen.getByText('Green Mountain Club, Pp. 2')).toBeInTheDocument();
  });

  it('starts line two with the author and shows the book\'s own title on line one', async () => {
    await renderWithResults([BOOK_HIT]);
    expect(screen.getByText('Long Trail System Shelter History')).toBeInTheDocument();
    expect(screen.getByText('ed. 2nd (1999-09-29)')).toBeInTheDocument();
    expect(screen.getByText('Woodward, Paul & Joanne, Green Mountain Club, Pp. 42')).toBeInTheDocument();
  });

  it('still shows a periodical\'s title even when it equals the collection folder name, and does not repeat the edition when publication_date is blank', async () => {
    await renderWithResults([AUGUST_1946_HIT]);
    expect(screen.getByText('Long Trail News')).toBeInTheDocument();
    expect(screen.getByText('ed. August (1946)')).toBeInTheDocument();
    expect(screen.getByText('Green Mountain Club, Pp. 5')).toBeInTheDocument();
  });

  it('persists the search query and results across unmount/remount (tab switch)', async () => {
    (window.api.wiki.search as jest.Mock).mockResolvedValue([PAGE_HIT]);
    const store = makeStore();
    const { unmount } = render(
      <Provider store={store}>
        <ResearchTab />
      </Provider>,
    );
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Monroe' } });
    await waitFor(() => expect(window.api.wiki.search).toHaveBeenCalledWith('Monroe'));
    await screen.findByText(/monroe lodge/i);
    unmount();

    render(
      <Provider store={store}>
        <ResearchTab />
      </Provider>,
    );
    expect(screen.getByRole('searchbox')).toHaveValue('Monroe');
    expect(screen.getByText(/monroe lodge/i)).toBeInTheDocument();
  });

  it('opens the source PDF in the OS default viewer, noting the hit page in the button title', async () => {
    await renderWithResults([PAGE_HIT]);
    const button = await screen.findByRole('button', { name: /open pdf.*page 2/i });
    fireEvent.click(button);
    expect(window.api.wiki.openPdf).toHaveBeenCalledWith('collections/long-trail-news/1922_12_Dec.pdf');
  });

  it('labels illustration hits as photos', async () => {
    await renderWithResults([ILLUSTRATION_HIT]);
    expect(await screen.findByText(/illustration/i)).toBeInTheDocument();
  });

  it('styles the result title like a Sources tab title, and the edition/date like its publication year', async () => {
    await renderWithResults([PAGE_HIT]);
    expect(await screen.findByText('Long Trail News')).toHaveClass('source-title');
    expect(screen.getByText('ed. December (1922-12)')).toHaveClass('source-pubdate');
  });

  it('shows the citation type badge, like the Sources tab', async () => {
    await renderWithResults([PAGE_HIT]);
    await screen.findByText(/monroe lodge/i);
    expect(document.querySelector('.source-type-badge.magazine')).toBeInTheDocument();
    expect(document.querySelector('.source-type-badge .label')).toHaveTextContent('Magazine article');
  });

  it('highlights the matched term within a quote-styled snippet, like the Sources tab', async () => {
    await renderWithResults([PAGE_HIT]);
    const quote = await screen.findByText((_, el) => el?.className === 'source-quote');
    expect(quote.querySelector('mark')).toHaveTextContent('Monroe Lodge');
  });

  it('shows an inline error when the PDF is missing on disk', async () => {
    (window.api.wiki.openPdf as jest.Mock).mockResolvedValue({ ok: false });
    await renderWithResults([PAGE_HIT]);
    fireEvent.click(await screen.findByRole('button', { name: /open pdf.*page 2/i }));
    expect(await screen.findByText(/pdf.*not found/i)).toBeInTheDocument();
  });

  describe('collection filter', () => {
    beforeEach(() => {
      (window.api.collections.status as jest.Mock).mockResolvedValue([COLLECTION_A, COLLECTION_B]);
    });

    function openFilters() {
      fireEvent.click(screen.getByRole('button', { name: 'Collection filters' }));
    }

    it('is collapsed by default, and the toggle button reveals it', async () => {
      await renderWithResults([PAGE_HIT]);
      expect(screen.queryByRole('checkbox', { name: 'long-trail-news' })).not.toBeInTheDocument();
      openFilters();
      expect(await screen.findByRole('checkbox', { name: 'long-trail-news' })).toBeInTheDocument();
    });

    it('lists every collection, all checked by default', async () => {
      await renderWithResults([PAGE_HIT]);
      openFilters();
      const a = await screen.findByRole('checkbox', { name: 'long-trail-news' });
      const b = screen.getByRole('checkbox', { name: 'trail-guide' });
      expect(a).toBeChecked();
      expect(b).toBeChecked();
      expect(window.api.wiki.search).toHaveBeenCalledWith('Monroe');
    });

    it('searches only the checked collections once one is unchecked', async () => {
      await renderWithResults([PAGE_HIT]);
      openFilters();
      fireEvent.click(await screen.findByRole('checkbox', { name: 'trail-guide' }));
      await waitFor(() =>
        expect(window.api.wiki.search).toHaveBeenLastCalledWith('Monroe', ['long-trail-news']),
      );
    });

    it('shows a spinner while collections are loading, then the All/None controls', async () => {
      let resolveStatus!: (v: CollectionStatus[]) => void;
      (window.api.collections.status as jest.Mock).mockReturnValue(
        new Promise<CollectionStatus[]>((resolve) => { resolveStatus = resolve; }),
      );
      render(
        <Provider store={makeStore()}>
          <ResearchTab />
        </Provider>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Collection filters' }));
      expect(screen.getByText('Collections').parentElement?.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();

      resolveStatus([COLLECTION_A]);
      expect(await screen.findByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByText('Collections').parentElement?.querySelector('svg')).not.toBeInTheDocument();
    });

    it('None unchecks every collection and All rechecks them', async () => {
      await renderWithResults([PAGE_HIT]);
      openFilters();
      fireEvent.click(screen.getByRole('button', { name: 'None' }));
      const a = await screen.findByRole('checkbox', { name: 'long-trail-news' });
      const b = screen.getByRole('checkbox', { name: 'trail-guide' });
      expect(a).not.toBeChecked();
      expect(b).not.toBeChecked();
      await waitFor(() => expect(window.api.wiki.search).toHaveBeenLastCalledWith('Monroe', []));

      fireEvent.click(screen.getByRole('button', { name: 'All' }));
      expect(a).toBeChecked();
      expect(b).toBeChecked();
      await waitFor(() => expect(window.api.wiki.search).toHaveBeenLastCalledWith('Monroe'));
    });
  });

  describe('web search', () => {
    function checkAndType(query: string) {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } });
    }
    function clickSearchWeb() {
      fireEvent.click(screen.getByRole('button', { name: 'Research w/AI' }));
    }

    it('never calls research.webSearch from editing the query alone', async () => {
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      await waitFor(() => expect(window.api.wiki.search).toHaveBeenCalledWith('Monroe'));
      expect(window.api.research.webSearch).not.toHaveBeenCalled();
    });

    it('clicking Search Web calls research.webSearch with the current query', async () => {
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({ ok: true, results: [] });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      await waitFor(() => expect(window.api.research.webSearch).toHaveBeenCalledWith('Monroe', expect.anything()));
    });

    it('sends shelter info and local collection results as context alongside the query', async () => {
      (window.api.wiki.search as jest.Mock).mockResolvedValue([PAGE_HIT]);
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({ ok: true, results: [] });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      await screen.findByText(/monroe lodge/i);
      clickSearchWeb();

      await waitFor(() => expect(window.api.research.webSearch).toHaveBeenCalled());
      const context = (window.api.research.webSearch as jest.Mock).mock.calls[0][1];
      expect(context).toContain('Aeolus View Camp');
      expect(context).toContain('Long Trail News');
      expect(context).toContain('Monroe Lodge will be built next year');
      expect(context).not.toContain('<mark>');
    });

    it('shows a loading indicator while in flight, disables the button, and a second click is inert', async () => {
      const { promise, resolve } = deferred<WebSearchResponse>();
      (window.api.research.webSearch as jest.Mock).mockReturnValue(promise);
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();

      expect(await screen.findByText(/searching the web/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Research w/AI' })).toBeDisabled();

      clickSearchWeb(); // second click while disabled
      expect(window.api.research.webSearch).toHaveBeenCalledTimes(1);

      resolve({ ok: true, results: [] });
      await waitFor(() => expect(screen.getByRole('button', { name: 'Research w/AI' })).not.toBeDisabled());
    });

    it('renders results in the Web Sources tab, auto-switching to it, without disturbing archive results underneath', async () => {
      (window.api.wiki.search as jest.Mock).mockResolvedValue([PAGE_HIT]);
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({
        ok: true,
        results: [{ title: 'NOAA Weather Almanac', url: 'https://example.com/almanac', snippet: 'a great primary source', localImagePath: null }],
      });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      await screen.findByText(/monroe lodge/i);
      clickSearchWeb();

      expect(await screen.findByRole('link', { name: 'NOAA Weather Almanac' })).toHaveAttribute('href', 'https://example.com/almanac');
      expect(screen.getByText('a great primary source')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Web Sources (1)' })).toBeInTheDocument();

      // switching back to Collections shows the archive result is still there, untouched
      fireEvent.click(screen.getByRole('button', { name: 'Collections (1)' }));
      expect(screen.getByText(/monroe lodge/i)).toBeInTheDocument();
    });

    it('persists web search results across unmount/remount (tab switch), same as collection results', async () => {
      (window.api.wiki.search as jest.Mock).mockResolvedValue([]);
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({
        ok: true,
        results: [{ title: 'NOAA Weather Almanac', url: 'https://example.com/almanac', snippet: 'a great primary source', localImagePath: null }],
      });
      const store = makeStore();
      const { unmount } = render(<Provider store={store}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      await screen.findByRole('link', { name: 'NOAA Weather Almanac' });
      unmount();

      render(<Provider store={store}><ResearchTab /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: 'Web Sources (1)' }));
      expect(screen.getByRole('link', { name: 'NOAA Weather Almanac' })).toBeInTheDocument();
      expect(screen.getByText('a great primary source')).toBeInTheDocument();
    });

    it('opens a web result link in the default external browser instead of navigating in-app', async () => {
      (window.api.wiki.search as jest.Mock).mockResolvedValue([]);
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({
        ok: true,
        results: [{ title: 'NOAA Weather Almanac', url: 'https://example.com/almanac', snippet: 'a great primary source', localImagePath: null }],
      });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();

      const link = await screen.findByRole('link', { name: 'NOAA Weather Almanac' });
      fireEvent.click(link);

      expect(window.api.shell.openExternal).toHaveBeenCalledWith('https://example.com/almanac');
    });

    it('renders a message pointing to AI Settings when no API key is configured', async () => {
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({ ok: false, error: 'no_api_key' });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      expect(await screen.findByText(/ai settings/i)).toBeInTheDocument();
    });

    it('renders a distinct "no web results" state, separate from the archive "no results" message', async () => {
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({ ok: true, results: [] });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('xyzzy');
      clickSearchWeb();
      expect(await screen.findByText(/no web sources/i)).toBeInTheDocument();
    });

    it('renders an inline error and re-enables the button on a timeout/network failure', async () => {
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({ ok: false, error: 'timeout' });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      expect(await screen.findByText(/web search failed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Research w/AI' })).not.toBeDisabled();
    });

    it('renders every result with no artificial cap (FR-013)', async () => {
      const many = Array.from({ length: 20 }, (_, i) => ({
        title: `Source ${i}`, url: `https://example.com/${i}`, snippet: `snippet ${i}`, localImagePath: null,
      }));
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({ ok: true, results: many });
      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      await screen.findByRole('button', { name: 'Web Sources (20)' });
      expect(screen.getAllByRole('link', { name: /^Source \d+$/ })).toHaveLength(20);
    });

    it('clicking Add Citation on a web result opens SourceModal pre-filled via webResultToSource and saves through createSource', async () => {
      (window.api.wiki.search as jest.Mock).mockResolvedValue([]);
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({
        ok: true,
        results: [{ title: 'NOAA Weather Almanac', url: 'https://example.com/almanac', snippet: 'a great primary source', localImagePath: null }],
      });
      (window.api.sources.create as jest.Mock).mockResolvedValue({
        id: 99, shelter_id: SHELTER.id, type: 'website', container_title: 'NOAA Weather Almanac',
        url: 'https://example.com/almanac', quote: 'a great primary source',
      });

      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      await screen.findByText('NOAA Weather Almanac');

      fireEvent.click(screen.getByRole('button', { name: /add citation/i }));
      expect(screen.getByText(/add a new source/i)).toBeInTheDocument();

      fireEvent.click(screen.getAllByRole('button', { name: /^add source$|^save$/i })[0]);

      await waitFor(() => {
        expect(window.api.sources.create).toHaveBeenCalledWith(
          expect.objectContaining({
            shelter_id: SHELTER.id,
            type: 'website',
            container_title: 'NOAA Weather Almanac',
            url: 'https://example.com/almanac',
            quote: 'a great primary source',
          }),
        );
      });
    });

    it('renders a thumbnail (via a shelter:// URL) for a result with a localImagePath, and none for a result without one', async () => {
      (window.api.wiki.search as jest.Mock).mockResolvedValue([]);
      (window.api.research.webSearch as jest.Mock).mockResolvedValue({
        ok: true,
        results: [
          { title: 'With Photo', url: 'https://example.com/a', snippet: 'a', localImagePath: '/tmp/userData/research-thumbnails/abc123.jpg' },
          { title: 'Without Photo', url: 'https://example.com/b', snippet: 'b', localImagePath: null },
        ],
      });

      render(<Provider store={makeStore()}><ResearchTab /></Provider>);
      checkAndType('Monroe');
      clickSearchWeb();
      await screen.findByText('With Photo');

      const withPhotoCard = screen.getByRole('link', { name: 'With Photo' }).closest('.research-result')!;
      const img = withPhotoCard.querySelector('img') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toBe('shelter:///tmp/userData/research-thumbnails/abc123.jpg');

      const withoutPhotoCard = screen.getByRole('link', { name: 'Without Photo' }).closest('.research-result')!;
      expect(withoutPhotoCard.querySelector('img')).not.toBeInTheDocument();
    });
  });
});
