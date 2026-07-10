import reducer, { setQuery, setResults, setExcludedCollections, setWebPhase, setWebResults, resetResearch } from './researchSlice';
import type { WebResearchResult, WikiSearchResult } from '../../shared/ipc-types';

const HIT: WikiSearchResult = {
  path: 'a.md', okf_type: 'Newsletter', title: 'Long Trail News',
  publisher: 'GMC', volume: '1922', edition: 'December',
  printed_volume: '5', printed_issue: '2', author: '', publication_date: '1922-12', resource: 'a.pdf',
  citation_type: 'magazine', kind: 'page', page: 2, image: '', snippet: 'hit',
};

describe('researchSlice', () => {
  it('starts with empty query, results, no excluded collections, and idle web search state', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual({
      query: '', results: [], excludedCollections: [], webPhase: 'idle', webResults: [],
    });
  });

  it('setQuery updates the query text', () => {
    const state = reducer(undefined, setQuery('Monroe'));
    expect(state.query).toBe('Monroe');
  });

  it('setResults updates the results list', () => {
    const state = reducer(undefined, setResults([HIT]));
    expect(state.results).toEqual([HIT]);
  });

  it('setWebPhase updates the web search phase', () => {
    const state = reducer(undefined, setWebPhase('loading'));
    expect(state.webPhase).toBe('loading');
  });

  it('setWebResults updates the web results list', () => {
    const webHit: WebResearchResult = { title: 'NOAA Almanac', url: 'https://example.com/a', snippet: 'a snippet', localImagePath: null };
    const state = reducer(undefined, setWebResults([webHit]));
    expect(state.webResults).toEqual([webHit]);
  });

  it('resetResearch clears query, results, webPhase, and webResults but keeps excludedCollections', () => {
    const webHit: WebResearchResult = { title: 'NOAA Almanac', url: 'https://example.com/a', snippet: 'a snippet', localImagePath: null };
    let state = reducer(undefined, setQuery('Monroe'));
    state = reducer(state, setResults([HIT]));
    state = reducer(state, setExcludedCollections(['1922']));
    state = reducer(state, setWebPhase('success'));
    state = reducer(state, setWebResults([webHit]));
    state = reducer(state, resetResearch());
    expect(state).toEqual({
      query: '', results: [], excludedCollections: ['1922'], webPhase: 'idle', webResults: [],
    });
  });

  it('setExcludedCollections updates which collections are excluded', () => {
    const state = reducer(undefined, setExcludedCollections(['1922', '1923']));
    expect(state.excludedCollections).toEqual(['1922', '1923']);
  });
});
