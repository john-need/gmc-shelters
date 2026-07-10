import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WikiSearchResult, WebResearchResult } from '../../shared/ipc-types';

export type WebSearchPhase = 'idle' | 'loading' | 'success' | 'empty' | 'no_api_key' | 'error';

export interface ResearchState {
  query: string;
  results: WikiSearchResult[];
  /** Collections excluded from search. Empty = search all (the default). */
  excludedCollections: string[];
  webPhase: WebSearchPhase;
  webResults: WebResearchResult[];
}

const initialState: ResearchState = {
  query: '',
  results: [],
  excludedCollections: [],
  webPhase: 'idle',
  webResults: [],
};

const researchSlice = createSlice({
  name: 'research',
  initialState,
  reducers: {
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
    setResults(state, action: PayloadAction<WikiSearchResult[]>) {
      state.results = action.payload;
    },
    setExcludedCollections(state, action: PayloadAction<string[]>) {
      state.excludedCollections = action.payload;
    },
    setWebPhase(state, action: PayloadAction<WebSearchPhase>) {
      state.webPhase = action.payload;
    },
    setWebResults(state, action: PayloadAction<WebResearchResult[]>) {
      state.webResults = action.payload;
    },
    resetResearch(state) {
      state.query = '';
      state.results = [];
      state.webPhase = 'idle';
      state.webResults = [];
      // excludedCollections deliberately persists — it's a search preference, not shelter-scoped data.
    },
  },
});

export const {
  setQuery, setResults, setExcludedCollections, setWebPhase, setWebResults, resetResearch,
} = researchSlice.actions;
export default researchSlice.reducer;
