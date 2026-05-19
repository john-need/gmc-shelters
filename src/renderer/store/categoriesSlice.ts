import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Category, CategoryInput } from '../../shared/ipc-types';

export interface CategoriesState {
  list: Category[];
  loading: boolean;
  error: string | null;
}

const initialState: CategoriesState = {
  list: [],
  loading: false,
  error: null,
};

export const loadCategories = createAsyncThunk('categories/loadAll', async () => {
  if (typeof window !== 'undefined' && window.api) {
    return window.api.categories.getAll();
  }
  return [] as Category[];
});

export const createCategory = createAsyncThunk(
  'categories/create',
  async (input: CategoryInput) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.categories.create(input);
    }
    const today = new Date().toISOString().slice(0, 10);
    return { ...input, id: Date.now(), created: today, updated: today } as Category;
  },
);

export const updateCategory = createAsyncThunk(
  'categories/update',
  async (cat: Category) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.categories.update(cat);
    }
    return cat;
  },
);

export const deleteCategory = createAsyncThunk(
  'categories/delete',
  async ({ id, reassignTo }: { id: number; reassignTo?: string }) => {
    if (typeof window !== 'undefined' && window.api) {
      await window.api.categories.delete(id, reassignTo);
    }
    return id;
  },
);

const categoriesSlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadCategories.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadCategories.fulfilled, (state, action) => {
        state.loading = false;
        state.list = action.payload;
      })
      .addCase(loadCategories.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load categories';
      })
      .addCase(createCategory.fulfilled, (state, action) => {
        state.list.push(action.payload);
        state.list.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateCategory.fulfilled, (state, action) => {
        const idx = state.list.findIndex((c) => c.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
        state.list.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(deleteCategory.fulfilled, (state, action) => {
        state.list = state.list.filter((c) => c.id !== action.payload);
      });
  },
});

export default categoriesSlice.reducer;
