import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Architecture, ArchitectureInput } from '../../shared/ipc-types';

export interface ArchitecturesState {
  list: Architecture[];
  loading: boolean;
  error: string | null;
}

const initialState: ArchitecturesState = {
  list: [],
  loading: false,
  error: null,
};

export const loadArchitectures = createAsyncThunk('architectures/loadAll', async () => {
  if (typeof window !== 'undefined' && window.api) {
    return window.api.architectures.getAll();
  }
  return [] as Architecture[];
});

export const createArchitecture = createAsyncThunk(
  'architectures/create',
  async (input: ArchitectureInput) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.architectures.create(input);
    }
    const today = new Date().toISOString().slice(0, 10);
    return { ...input, id: Date.now(), created: today, updated: today } as Architecture;
  },
);

export const updateArchitecture = createAsyncThunk(
  'architectures/update',
  async (arch: Architecture) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.architectures.update(arch);
    }
    return arch;
  },
);

export const deleteArchitecture = createAsyncThunk(
  'architectures/delete',
  async ({ id, reassignTo }: { id: number; reassignTo?: string }) => {
    if (typeof window !== 'undefined' && window.api) {
      await window.api.architectures.delete(id, reassignTo);
    }
    return id;
  },
);

const architecturesSlice = createSlice({
  name: 'architectures',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadArchitectures.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadArchitectures.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(loadArchitectures.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load architectures';
      })
      .addCase(createArchitecture.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.list.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateArchitecture.fulfilled, (state, action) => {
        const idx = state.list.findIndex((a) => a.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
        state.list.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(deleteArchitecture.fulfilled, (state, action) => {
        state.list = state.list.filter((a) => a.id !== action.payload);
      });
  },
});

export default architecturesSlice.reducer;
