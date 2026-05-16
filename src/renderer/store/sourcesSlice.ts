import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Source, SourceInput } from '../../shared/ipc-types';

export interface SourcesState {
  byShelter: Record<number, Source[]>;
  loading: boolean;
}

const initialState: SourcesState = {
  byShelter: {},
  loading: false,
};

export const loadSources = createAsyncThunk(
  'sources/loadByShelter',
  async (shelterId: number) => {
    if (typeof window !== 'undefined' && window.api) {
      const sources = await window.api.sources.getByShelter(shelterId);
      return { shelterId, sources };
    }
    return { shelterId, sources: [] as Source[] };
  },
);

export const createSource = createAsyncThunk(
  'sources/create',
  async (input: SourceInput) => {
    if (typeof window !== 'undefined' && window.api) {
      const source = await window.api.sources.create(input);
      return { shelterId: input.shelter_id, source };
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      shelterId: input.shelter_id,
      source: { ...input, id: Date.now(), created: today, updated: today } as Source,
    };
  },
);

export const updateSource = createAsyncThunk(
  'sources/update',
  async (source: Source) => {
    if (typeof window !== 'undefined' && window.api) {
      const updated = await window.api.sources.update(source);
      return { shelterId: source.shelter_id, source: updated };
    }
    return { shelterId: source.shelter_id, source };
  },
);

export const deleteSource = createAsyncThunk(
  'sources/delete',
  async ({ id, shelterId }: { id: number; shelterId: number }) => {
    if (typeof window !== 'undefined' && window.api) {
      await window.api.sources.delete(id);
    }
    return { id, shelterId };
  },
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
      .addCase(loadSources.fulfilled, (state, action) => {
        state.loading = false;
        state.byShelter[action.payload.shelterId] = action.payload.sources;
      })
      .addCase(loadSources.rejected, (state) => {
        state.loading = false;
      })
      .addCase(createSource.fulfilled, (state, action) => {
        const { shelterId, source } = action.payload;
        if (!state.byShelter[shelterId]) state.byShelter[shelterId] = [];
        state.byShelter[shelterId].unshift(source);
      })
      .addCase(updateSource.fulfilled, (state, action) => {
        const { shelterId, source } = action.payload;
        const list = state.byShelter[shelterId];
        if (list) {
          const idx = list.findIndex((s) => s.id === source.id);
          if (idx >= 0) list[idx] = source;
        }
      })
      .addCase(deleteSource.fulfilled, (state, action) => {
        const { id, shelterId } = action.payload;
        if (state.byShelter[shelterId]) {
          state.byShelter[shelterId] = state.byShelter[shelterId].filter((s) => s.id !== id);
        }
      });
  },
});

export default sourcesSlice.reducer;
