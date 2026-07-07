import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import sourcesReducer from '../../../store/sourcesSlice';
import uiReducer from '../../../store/uiSlice';
import researchReducer from '../../../store/researchSlice';
import ResearchTab from './ResearchTab';
import type { CollectionStatus, Shelter, WikiSearchResult } from '../../../../shared/ipc-types';

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

  it('opens the source PDF at the hit page', async () => {
    await renderWithResults([PAGE_HIT]);
    fireEvent.click(await screen.findByRole('button', { name: /open pdf at page 2/i }));
    expect(window.api.wiki.openPdf).toHaveBeenCalledWith(
      'collections/long-trail-news/1922_12_Dec.pdf', 2,
    );
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
    fireEvent.click(await screen.findByRole('button', { name: /open pdf at page 2/i }));
    expect(await screen.findByText(/pdf.*not found/i)).toBeInTheDocument();
  });

  describe('collection filter', () => {
    beforeEach(() => {
      (window.api.collections.status as jest.Mock).mockResolvedValue([COLLECTION_A, COLLECTION_B]);
    });

    it('lists every collection, all checked by default', async () => {
      await renderWithResults([PAGE_HIT]);
      const a = await screen.findByRole('checkbox', { name: 'long-trail-news' });
      const b = screen.getByRole('checkbox', { name: 'trail-guide' });
      expect(a).toBeChecked();
      expect(b).toBeChecked();
      expect(window.api.wiki.search).toHaveBeenCalledWith('Monroe');
    });

    it('searches only the checked collections once one is unchecked', async () => {
      await renderWithResults([PAGE_HIT]);
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
      expect(screen.getByText('Collections').parentElement?.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument();

      resolveStatus([COLLECTION_A]);
      expect(await screen.findByRole('button', { name: 'All' })).toBeInTheDocument();
      expect(screen.getByText('Collections').parentElement?.querySelector('svg')).not.toBeInTheDocument();
    });

    it('None unchecks every collection and All rechecks them', async () => {
      await renderWithResults([PAGE_HIT]);
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
});
