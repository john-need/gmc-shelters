import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from '../../../store/sheltersSlice';
import sourcesReducer from '../../../store/sourcesSlice';
import uiReducer from '../../../store/uiSlice';
import ResearchTab from './ResearchTab';
import type { Shelter, WikiSearchResult } from '../../../../shared/ipc-types';

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
  resource: 'collections/long-trail-news/1922_12_Dec.pdf',
  citation_type: 'magazine',
  kind: 'page',
  page: 2,
  image: '',
  snippet: '<mark>Monroe Lodge</mark> will be built next year',
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
    reducer: { shelters: sheltersReducer, sources: sourcesReducer, ui: uiReducer },
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

  it('shows page number and publication metadata for a hit', async () => {
    await renderWithResults([PAGE_HIT]);
    expect(await screen.findByText('Long Trail News')).toBeInTheDocument();
    expect(
      screen.getByText('Green Mountain Club · Vol. 5 · No. 2 · December 1922 · p. 2'),
    ).toBeInTheDocument();
  });

  it('opens the source PDF at the hit page', async () => {
    await renderWithResults([PAGE_HIT]);
    fireEvent.click(await screen.findByRole('button', { name: /pdf p\. 2/i }));
    expect(window.api.wiki.openPdf).toHaveBeenCalledWith(
      'collections/long-trail-news/1922_12_Dec.pdf', 2,
    );
  });

  it('labels illustration hits as photos', async () => {
    await renderWithResults([ILLUSTRATION_HIT]);
    expect(await screen.findByText(/illustration/i)).toBeInTheDocument();
  });

  it('shows an inline error when the PDF is missing on disk', async () => {
    (window.api.wiki.openPdf as jest.Mock).mockResolvedValue({ ok: false });
    await renderWithResults([PAGE_HIT]);
    fireEvent.click(await screen.findByRole('button', { name: /pdf p\. 2/i }));
    expect(await screen.findByText(/pdf.*not found/i)).toBeInTheDocument();
  });
});
