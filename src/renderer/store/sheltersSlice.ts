import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Shelter, ShelterCreateInput } from '../../shared/ipc-types';

export interface SheltersState {
  list: Shelter[];
  selectedId: number | null;
  editBuffer: Shelter | null;
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  historyContent: string;
  historyOriginal: string;
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
  historyOriginal: '',
  historyDirty: false,
};

export const loadShelters = createAsyncThunk('shelters/loadAll', async () => {
  console.log('[renderer] loadShelters called, window.api =', typeof window !== 'undefined' ? typeof (window as Window & typeof globalThis & { api?: unknown }).api : 'no window');
  if (typeof window !== 'undefined' && window.api) {
    try {
      const result = await window.api.shelters.getAll();
      console.log('[renderer] shelters.getAll returned', result?.length, 'rows');
      return result;
    } catch (err) {
      console.error('[renderer] shelters.getAll threw:', err);
      throw err;
    }
  }
  console.warn('[renderer] window.api not available, returning []');
  return [] as Shelter[];
});

export const saveShelter = createAsyncThunk(
  'shelters/save',
  async (shelter: Shelter) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.shelters.update(shelter);
    }
    return { ...shelter, updated: new Date().toISOString().slice(0, 10) };
  },
);

export const createShelter = createAsyncThunk(
  'shelters/create',
  async (input: ShelterCreateInput) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.shelters.create(input);
    }
    const slug = input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const today = new Date().toISOString().slice(0, 10);
    return {
      id: Date.now(),
      name: input.name,
      slug,
      start_year: input.start_year,
      end_year: null,
      category: input.category,
      architecture: '',
      built_by: '',
      description: '',
      notes: '',
      latitude: 44.0,
      longitude: -72.8,
      is_extant: true,
      is_gmc: input.is_gmc,
      show_on_web: false,
      default_photo_id: null,
      created: today,
      updated: today,
      photo_count: 0,
    } as Shelter;
  },
);

export const loadHistory = createAsyncThunk(
  'shelters/loadHistory',
  async (slug: string) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.history.read(slug);
    }
    return '';
  },
);

export const saveHistory = createAsyncThunk(
  'shelters/saveHistory',
  async ({ slug, content }: { slug: string; content: string }) => {
    if (typeof window !== 'undefined' && window.api) {
      await window.api.history.write(slug, content);
    }
    return content;
  },
);

const sheltersSlice = createSlice({
  name: 'shelters',
  initialState,
  reducers: {
    setSelectedId(state, action: PayloadAction<number | null>) {
      state.selectedId = action.payload;
      state.dirty = false;
      state.historyDirty = false;
      if (action.payload !== null) {
        const shelter = state.list.find((s) => s.id === action.payload);
        state.editBuffer = shelter ?? null;
      } else {
        state.editBuffer = null;
      }
    },
    setEditBuffer(state, action: PayloadAction<Shelter | null>) {
      state.editBuffer = action.payload;
      if (action.payload && state.selectedId !== null) {
        const original = state.list.find((s) => s.id === state.selectedId);
        state.dirty = JSON.stringify(action.payload) !== JSON.stringify(original);
      }
    },
    revertEditBuffer(state) {
      if (state.selectedId !== null) {
        const shelter = state.list.find((s) => s.id === state.selectedId);
        state.editBuffer = shelter ?? null;
        state.dirty = false;
      }
    },
    setHistoryContent(state, action: PayloadAction<string>) {
      state.historyContent = action.payload;
      state.historyDirty = action.payload !== state.historyOriginal;
    },
    upsertShelter(state, action: PayloadAction<Shelter>) {
      const idx = state.list.findIndex((s) => s.id === action.payload.id);
      if (idx >= 0) {
        state.list[idx] = action.payload;
      } else {
        state.list.push(action.payload);
      }
      if (state.selectedId === action.payload.id) {
        state.editBuffer = action.payload;
        state.dirty = false;
      }
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
        if (action.payload.length > 0 && state.selectedId === null) {
          state.selectedId = action.payload[0].id;
          state.editBuffer = action.payload[0];
        }
      })
      .addCase(loadShelters.rejected, (state) => {
        state.loading = false;
      })
      .addCase(saveShelter.fulfilled, (state, action) => {
        const idx = state.list.findIndex((s) => s.id === action.payload.id);
        if (idx >= 0) state.list[idx] = action.payload;
        state.editBuffer = action.payload;
        state.dirty = false;
        state.saving = false;
      })
      .addCase(saveShelter.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveShelter.rejected, (state) => {
        state.saving = false;
      })
      .addCase(createShelter.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.selectedId = action.payload.id;
        state.editBuffer = action.payload;
        state.dirty = false;
        state.historyContent = '';
        state.historyOriginal = '';
        state.historyDirty = false;
      })
      .addCase(loadHistory.fulfilled, (state, action) => {
        state.historyContent = action.payload;
        state.historyOriginal = action.payload;
        state.historyDirty = false;
      })
      .addCase(saveHistory.fulfilled, (state, action) => {
        state.historyOriginal = action.payload;
        state.historyDirty = false;
      });
  },
});

export const {
  setSelectedId,
  setEditBuffer,
  revertEditBuffer,
  setHistoryContent,
  upsertShelter,
  clearDirty,
} = sheltersSlice.actions;

export default sheltersSlice.reducer;
