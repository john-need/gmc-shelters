import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Photo, PhotoUpdateInput } from '../../shared/ipc-types';

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

export const loadPhotos = createAsyncThunk(
  'photos/loadByShelter',
  async (shelterId: number) => {
    if (typeof window !== 'undefined' && window.api) {
      const photos = await window.api.photos.getByShelter(shelterId);
      return { shelterId, photos };
    }
    return { shelterId, photos: [] as Photo[] };
  },
);

export const uploadPhoto = createAsyncThunk(
  'photos/upload',
  async ({ shelterId, sourcePath, title }: { shelterId: number; sourcePath: string; title?: string }) => {
    if (typeof window !== 'undefined' && window.api) {
      const photo = await window.api.photos.upload({ shelterId, sourcePath, title });
      return { shelterId, photo };
    }
    throw new Error('API not available');
  },
);

export const savePhotoMetadata = createAsyncThunk(
  'photos/saveMetadata',
  async (photo: PhotoUpdateInput & { id: number; shelter_id: number }) => {
    if (typeof window !== 'undefined' && window.api) {
      const updated = await window.api.photos.update(photo);
      return { shelterId: photo.shelter_id, photo: updated };
    }
    return { shelterId: photo.shelter_id, photo: photo as unknown as Photo };
  },
);

const photosSlice = createSlice({
  name: 'photos',
  initialState,
  reducers: {
    updatePhotoLocal(state, action: PayloadAction<{ shelterId: number; photo: Partial<Photo> & { id: number } }>) {
      const { shelterId, photo } = action.payload;
      const list = state.byShelter[shelterId];
      if (list) {
        const idx = list.findIndex((p) => p.id === photo.id);
        if (idx >= 0) list[idx] = { ...list[idx], ...photo };
      }
    },
    removePhotoLocal(state, action: PayloadAction<{ shelterId: number; photoId: number }>) {
      const { shelterId, photoId } = action.payload;
      if (state.byShelter[shelterId]) {
        state.byShelter[shelterId] = state.byShelter[shelterId].filter((p) => p.id !== photoId);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPhotos.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadPhotos.fulfilled, (state, action) => {
        state.loading = false;
        state.byShelter[action.payload.shelterId] = action.payload.photos;
      })
      .addCase(loadPhotos.rejected, (state) => {
        state.loading = false;
      })
      .addCase(uploadPhoto.pending, (state) => {
        state.uploading = true;
      })
      .addCase(uploadPhoto.fulfilled, (state, action) => {
        state.uploading = false;
        const { shelterId, photo } = action.payload;
        if (!state.byShelter[shelterId]) state.byShelter[shelterId] = [];
        state.byShelter[shelterId].push(photo);
      })
      .addCase(uploadPhoto.rejected, (state) => {
        state.uploading = false;
      })
      .addCase(savePhotoMetadata.fulfilled, (state, action) => {
        const { shelterId, photo } = action.payload;
        const list = state.byShelter[shelterId];
        if (list) {
          const idx = list.findIndex((p) => p.id === photo.id);
          if (idx >= 0) list[idx] = photo as Photo;
        }
      });
  },
});

export const { updatePhotoLocal, removePhotoLocal } = photosSlice.actions;
export default photosSlice.reducer;
