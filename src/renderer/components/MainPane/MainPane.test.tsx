import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from '../../store';
import { loadShelters, setSelectedId } from '../../store/sheltersSlice';
import { setQuery, setResults } from '../../store/researchSlice';
import MainPane from './MainPane';
import type { Shelter, WikiSearchResult } from '@shared/ipc-types';

const SHELTER_A = { id: 101, name: 'A Camp', slug: 'a-camp' } as Shelter;
const SHELTER_B = { id: 102, name: 'B Camp', slug: 'b-camp' } as Shelter;

const HIT: WikiSearchResult = {
  path: 'a.md', okf_type: 'Newsletter', title: 'Long Trail News',
  publisher: 'GMC', volume: '1922', edition: 'December',
  printed_volume: '5', printed_issue: '2', author: '', publication_date: '1922-12', resource: 'a.pdf',
  citation_type: 'magazine', kind: 'page', page: 2, image: '', snippet: 'hit',
};

describe('MainPane', () => {
  it('resets research query/results when the selected shelter changes', async () => {
    (window.api.shelters.getAll as jest.Mock).mockResolvedValue([SHELTER_A, SHELTER_B]);
    render(
      <Provider store={store}>
        <MainPane />
      </Provider>,
    );

    await store.dispatch(loadShelters());
    store.dispatch(setSelectedId(SHELTER_A.id));
    store.dispatch(setQuery('Monroe'));
    store.dispatch(setResults([HIT]));
    expect(store.getState().research).toEqual({ query: 'Monroe', results: [HIT] });

    store.dispatch(setSelectedId(SHELTER_B.id));
    await waitFor(() => expect(store.getState().research).toEqual({ query: '', results: [] }));
  });
});
