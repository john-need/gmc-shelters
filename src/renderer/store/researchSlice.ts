import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { WikiSearchResult } from '../../shared/ipc-types';

export interface ResearchState {
  query: string;
  results: WikiSearchResult[];
}

const initialState: ResearchState = {
  query: '',
  results: [],
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
    resetResearch(state) {
      state.query = '';
      state.results = [];
    },
  },
});

export const { setQuery, setResults, resetResearch } = researchSlice.actions;
export default researchSlice.reducer;
