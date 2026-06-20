import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { Photo, PhotoUpdateInput, ReconcileApplyInput, ReconcileApplyResult } from '../../shared/ipc-types';

export interface PhotosState {
  byShelter: Record<number, Photo[]>;
  originals: Record<number, Photo>;
  loading: boolean;
  uploading: boolean;
}

const initialState: PhotosState = {
  byShelter: {},
  originals: {},
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
  async ({ shelterId, sourcePath, sheltersRoot, title }: { shelterId: number; sourcePath: string; sheltersRoot: string; title?: string }) => {
    if (typeof window !== 'undefined' && window.api) {
      const photo = await window.api.photos.upload({ shelterId, sourcePath, sheltersRoot, title });
      return { shelterId, photo };
    }
    throw new Error('API not available');
  },
);

export const reconcileApply = createAsyncThunk<ReconcileApplyResult, ReconcileApplyInput>(
  'photos/reconcileApply',
  async (input) => {
    if (typeof window !== 'undefined' && window.api) {
      return window.api.photos.reconcileApply(input);
    }
    throw new Error('API not available');
  },
);

export const savePhotoMetadata = createAsyncThunk(
  'photos/saveMetadata',
  async (photo: PhotoUpdateInput & { id: number; shelter_id: number; sheltersRoot: string }) => {
    if (typeof window !== 'undefined' && window.api) {
      const updated = await window.api.photos.update(photo);
      return { shelterId: photo.shelter_id, photo: updated };
    }
    return { shelterId: photo.shelter_id, photo: photo as unknown as Photo };
  },
);

export const reorderPhotos = createAsyncThunk(
  'photos/reorder',
  async ({ shelterId, photoIds }: { shelterId: number; photoIds: number[] }, { dispatch }) => {
    dispatch(reorderPhotosLocal({ shelterId, photoIds }));
    if (typeof window !== 'undefined' && window.api) {
      try {
        await window.api.photos.reorder({ shelterId, photoIds });
      } catch (err) {
        dispatch(loadPhotos(shelterId));
        throw err;
      }
    }
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
      delete state.originals[photoId];
    },
    reorderPhotosLocal(state, action: PayloadAction<{ shelterId: number; photoIds: number[] }>) {
      const { shelterId, photoIds } = action.payload;
      const list = state.byShelter[shelterId];
      if (!list) return;

      const photosById = new Map(list.map((photo) => [photo.id, photo]));
      if (photoIds.length !== list.length || photoIds.some((id) => !photosById.has(id))) return;

      state.byShelter[shelterId] = photoIds
        .map((id) => photosById.get(id))
        .filter((photo): photo is Photo => Boolean(photo));
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
        action.payload.photos.forEach((p) => {
          state.originals[p.id] = p;
        });
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
        state.originals[photo.id] = photo;
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
        state.originals[photo.id] = photo as Photo;
      });
  },
});

export const { updatePhotoLocal, removePhotoLocal, reorderPhotosLocal } = photosSlice.actions;
export default photosSlice.reducer;
