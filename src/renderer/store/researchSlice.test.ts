import reducer, { setQuery, setResults, setExcludedCollections, resetResearch } from './researchSlice';
import type { WikiSearchResult } from '../../shared/ipc-types';

const HIT: WikiSearchResult = {
  path: 'a.md', okf_type: 'Newsletter', title: 'Long Trail News',
  publisher: 'GMC', volume: '1922', edition: 'December',
  printed_volume: '5', printed_issue: '2', author: '', publication_date: '1922-12', resource: 'a.pdf',
  citation_type: 'magazine', kind: 'page', page: 2, image: '', snippet: 'hit',
};

describe('researchSlice', () => {
  it('starts with empty query, results, and no excluded collections', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({ query: '', results: [], excludedCollections: [] });
  });

  it('setQuery updates the query text', () => {
    const state = reducer(undefined, setQuery('Monroe'));
    expect(state.query).toBe('Monroe');
  });

  it('setResults updates the results list', () => {
    const state = reducer(undefined, setResults([HIT]));
    expect(state.results).toEqual([HIT]);
  });

  it('resetResearch clears query and results but keeps excludedCollections', () => {
    let state = reducer(undefined, setQuery('Monroe'));
    state = reducer(state, setResults([HIT]));
    state = reducer(state, setExcludedCollections(['1922']));
    state = reducer(state, resetResearch());
    expect(state).toEqual({ query: '', results: [], excludedCollections: ['1922'] });
  });

  it('setExcludedCollections updates which collections are excluded', () => {
    const state = reducer(undefined, setExcludedCollections(['1922', '1923']));
    expect(state.excludedCollections).toEqual(['1922', '1923']);
  });
});
