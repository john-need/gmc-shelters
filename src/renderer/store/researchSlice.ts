import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WikiSearchResult } from '../../shared/ipc-types';

export interface ResearchState {
  query: string;
  results: WikiSearchResult[];
  /** Collections excluded from search. Empty = search all (the default). */
  excludedCollections: string[];
}

const initialState: ResearchState = {
  query: '',
  results: [],
  excludedCollections: [],
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
    resetResearch(state) {
      state.query = '';
      state.results = [];
      // excludedCollections deliberately persists — it's a search preference, not shelter-scoped data.
    },
  },
});

export const { setQuery, setResults, setExcludedCollections, resetResearch } = researchSlice.actions;
export default researchSlice.reducer;
