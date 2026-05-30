import { configureStore } from '@reduxjs/toolkit';
import photosReducer, {
  updatePhotoLocal,
  removePhotoLocal,
  loadPhotos,
  uploadPhoto,
  savePhotoMetadata,
  reconcileApply,
  PhotosState,
} from './photosSlice';
import type { Photo, ReconcileApplyInput } from '@shared/ipc-types';

const photo = (overrides: Partial<Photo> = {}): Photo => ({
  id: 1,
  shelter_id: 10,
  file_name: 'test.jpg',
  title: 'Test',
  photographer: '',
  caption: '',
  date_taken: '',
  notes: '',
  alt_text: '',
  description: '',
  include_in_post: false,
  created: '2020-01-01',
  updated: '2020-01-01',
  ...overrides,
});

const initialState: PhotosState = { byShelter: {}, originals: {}, loading: false, uploading: false };

describe('photosSlice reducers', () => {
  it('has correct initial state', () => {
    expect(photosReducer(undefined, { type: '@@init' })).toEqual(initialState);
  });

  describe('updatePhotoLocal', () => {
    it('merges partial photo into existing list entry', () => {
      const state: PhotosState = { byShelter: { 10: [photo()] }, originals: {}, loading: false, uploading: false };
      const next = photosReducer(state, updatePhotoLocal({ shelterId: 10, photo: { id: 1, title: 'Updated' } }));
      expect(next.byShelter[10][0].title).toBe('Updated');
      expect(next.byShelter[10][0].file_name).toBe('test.jpg');
    });

    it('does nothing when shelterId not in state', () => {
      const state: PhotosState = { byShelter: {}, originals: {}, loading: false, uploading: false };
      const next = photosReducer(state, updatePhotoLocal({ shelterId: 10, photo: { id: 1, title: 'X' } }));
      expect(next.byShelter[10]).toBeUndefined();
    });
  });

  describe('removePhotoLocal', () => {
    it('filters out photo by id', () => {
      const state: PhotosState = {
        byShelter: { 10: [photo({ id: 1 }), photo({ id: 2 })] },
        originals: {},
        loading: false,
        uploading: false,
      };
      const next = photosReducer(state, removePhotoLocal({ shelterId: 10, photoId: 1 }));
      expect(next.byShelter[10]).toHaveLength(1);
      expect(next.byShelter[10][0].id).toBe(2);
    });

    it('does nothing when shelterId not present', () => {
      const next = photosReducer(initialState, removePhotoLocal({ shelterId: 99, photoId: 1 }));
      expect(next.byShelter[99]).toBeUndefined();
    });
  });
});

describe('photosSlice extraReducers', () => {
  describe('loadPhotos', () => {
    it('sets loading true on pending', () => {
      const next = photosReducer(initialState, loadPhotos.pending('', 10));
      expect(next.loading).toBe(true);
    });

    it('stores photos and clears loading on fulfilled', () => {
      const photos = [photo()];
      const next = photosReducer(
        { ...initialState, loading: true },
        loadPhotos.fulfilled({ shelterId: 10, photos }, '', 10),
      );
      expect(next.loading).toBe(false);
      expect(next.byShelter[10]).toEqual(photos);
    });

    it('clears loading on rejected', () => {
      const next = photosReducer(
        { ...initialState, loading: true },
        loadPhotos.rejected(new Error('fail'), '', 10),
      );
      expect(next.loading).toBe(false);
    });
  });

  describe('uploadPhoto', () => {
    it('sets uploading true on pending', () => {
      const next = photosReducer(initialState, uploadPhoto.pending('', { shelterId: 10, sourcePath: '/x.jpg' }));
      expect(next.uploading).toBe(true);
    });

    it('appends photo and clears uploading on fulfilled', () => {
      const p = photo({ id: 5 });
      const next = photosReducer(
        { ...initialState, uploading: true },
        uploadPhoto.fulfilled({ shelterId: 10, photo: p }, '', { shelterId: 10, sourcePath: '/x.jpg' }),
      );
      expect(next.uploading).toBe(false);
      expect(next.byShelter[10]).toHaveLength(1);
      expect(next.byShelter[10][0].id).toBe(5);
    });

    it('clears uploading on rejected', () => {
      const next = photosReducer(
        { ...initialState, uploading: true },
        uploadPhoto.rejected(new Error('fail'), '', { shelterId: 10, sourcePath: '/x.jpg' }),
      );
      expect(next.uploading).toBe(false);
    });
  });

  describe('savePhotoMetadata', () => {
    it('replaces photo in list on fulfilled', () => {
      const existing = photo({ id: 3, title: 'Old' });
      const updated = photo({ id: 3, title: 'New' });
      const state: PhotosState = { byShelter: { 10: [existing] }, originals: {}, loading: false, uploading: false };
      const input = { ...updated, shelter_id: 10 };
      const next = photosReducer(
        state,
        savePhotoMetadata.fulfilled({ shelterId: 10, photo: updated }, '', input),
      );
      expect(next.byShelter[10][0].title).toBe('New');
    });
  });

  describe('reconcileApply', () => {
    const mockReconcileApply = jest.fn();

    beforeEach(() => {
      (window as any).api = { photos: { reconcileApply: mockReconcileApply } };
    });

    afterEach(() => {
      (window as any).api = undefined;
    });

    it('calls window.api.photos.reconcileApply with correct input', async () => {
      const mockResult = { added: 2, deleted: 1, failed: 0, failures: [] };
      mockReconcileApply.mockResolvedValue(mockResult);

      const store = configureStore({ reducer: { photos: photosReducer } });
      const input: ReconcileApplyInput = {
        shelterId: 1,
        sheltersRoot: '/shelters',
        filesToAdd: ['new.jpg', 'another.jpg'],
        recordIdsToDelete: [10],
      };

      const action = await store.dispatch(reconcileApply(input));
      expect(mockReconcileApply).toHaveBeenCalledWith(input);
      expect(action.payload).toEqual(mockResult);
    });

    it('rejects when api not available', async () => {
      (window as any).api = undefined;
      const store = configureStore({ reducer: { photos: photosReducer } });
      const input: ReconcileApplyInput = {
        shelterId: 1, sheltersRoot: '/shelters', filesToAdd: [], recordIdsToDelete: [],
      };
      const action = await store.dispatch(reconcileApply(input));
      expect(action.type).toBe('photos/reconcileApply/rejected');
    });
  });
});
