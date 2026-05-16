import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Source } from '../../shared/ipc-types';

export interface SourcesState {
  byShelter: Record<number, Source[]>;
  loading: boolean;
}

const initialState: SourcesState = {
  byShelter: {},
  loading: false,
};

// Placeholder thunk — returns empty array until data layer is built
export const loadSources = createAsyncThunk(
  'sources/loadByShelter',
  async (_shelterId: number) => [] as Source[],
);

const sourcesSlice = createSlice({
  name: 'sources',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSources.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadSources.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(loadSources.rejected, (state) => {
        state.loading = false;
      });
  },
});

export default sourcesSlice.reducer;
