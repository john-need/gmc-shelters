import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Shelter } from '../../shared/ipc-types';

export interface SheltersState {
  list: Shelter[];
  selectedId: number | null;
  editBuffer: Shelter | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  historyContent: string;
  historyDirty: boolean;
}

const initialState: SheltersState = {
  list: [],
  selectedId: null,
  editBuffer: null,
  loading: false,
  saving: false,
  dirty: false,
  historyContent: '',
  historyDirty: false,
};

// Placeholder thunk — returns empty array until data layer is built
export const loadShelters = createAsyncThunk('shelters/loadAll', async () => {
  return [] as Shelter[];
});

const sheltersSlice = createSlice({
  name: 'shelters',
  initialState,
  reducers: {
    setSelectedId(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
    },
    setDirty(state, action: PayloadAction<boolean>) {
      state.dirty = action.payload;
    },
    setHistoryDirty(state, action: PayloadAction<boolean>) {
      state.historyDirty = action.payload;
    },
    setEditBuffer(state, action: PayloadAction<Shelter | null>) {
      state.editBuffer = action.payload;
    },
    clearDirty(state) {
      state.dirty = false;
      state.historyDirty = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadShelters.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadShelters.fulfilled, (state, action) => {
        state.list = action.payload;
        state.loading = false;
      })
      .addCase(loadShelters.rejected, (state) => {
        state.loading = false;
      });
  },
});

export const { setSelectedId, setDirty, setHistoryDirty, setEditBuffer, clearDirty } =
  sheltersSlice.actions;

export default sheltersSlice.reducer;
