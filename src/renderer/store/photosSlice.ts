import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Photo } from '../../shared/ipc-types';

export interface PhotosState {
  byShelter: Record<number, Photo[]>;
  loading: boolean;
  uploading: boolean;
}

const initialState: PhotosState = {
  byShelter: {},
  loading: false,
  uploading: false,
};

// Placeholder thunk — returns empty array until data layer is built
export const loadPhotos = createAsyncThunk(
  'photos/loadByShelter',
  async (_shelterId: number) => [] as Photo[],
);

const photosSlice = createSlice({
  name: 'photos',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadPhotos.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadPhotos.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(loadPhotos.rejected, (state) => {
        state.loading = false;
      });
  },
});

export default photosSlice.reducer;
