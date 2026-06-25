import { configureStore } from '@reduxjs/toolkit';
import mapMarkersReducer, {
  loadMapMarkers,
  createMarker,
  updateMarker,
  deleteMarker,
} from './mapMarkersSlice';
import type { MapMarker } from '../../shared/ipc-types';

function makeStore() {
  return configureStore({ reducer: { mapMarkers: mapMarkersReducer } });
}

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.1, longitude: -71.5,
    name: 'Test', start_year: 1960, end_year: 1990, change_type: 'Original',
    notes: '', is_extant: false,
    photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

describe('mapMarkersSlice', () => {
  describe('initial state', () => {
    it('has the correct shape', () => {
      const store = makeStore();
      expect(store.getState().mapMarkers).toEqual({ byShelter: {}, loading: false, error: null });
    });
  });

  describe('loadMapMarkers', () => {
    it('sets loading true on pending', () => {
      const store = makeStore();
      store.dispatch(loadMapMarkers.pending('', 10));
      expect(store.getState().mapMarkers.loading).toBe(true);
    });

    it('populates byShelter on fulfilled', () => {
      const store = makeStore();
      const markers = [makeMarker({ id: 1 }), makeMarker({ id: 2 })];
      store.dispatch(loadMapMarkers.fulfilled({ shelterId: 10, markers }, '', 10));
      expect(store.getState().mapMarkers.byShelter[10]).toHaveLength(2);
      expect(store.getState().mapMarkers.loading).toBe(false);
    });

    it('sets error on rejected', () => {
      const store = makeStore();
      store.dispatch(loadMapMarkers.rejected(new Error('fail'), '', 10));
      expect(store.getState().mapMarkers.loading).toBe(false);
      expect(store.getState().mapMarkers.error).toBeTruthy();
    });
  });

  describe('createMarker', () => {
    it('replaces byShelter list on fulfilled', () => {
      const store = makeStore();
      const markers = [makeMarker({ id: 5, shelter_id: 10 })];
      store.dispatch(createMarker.fulfilled(
        { shelterId: 10, markers },
        '',
        { shelter_id: 10, latitude: 44.1, longitude: -71.5, name: 'Test', start_year: 1960, end_year: null, change_type: 'Original', notes: '' },
      ));
      expect(store.getState().mapMarkers.byShelter[10]).toHaveLength(1);
      expect(store.getState().mapMarkers.byShelter[10][0].id).toBe(5);
    });
  });

  describe('updateMarker', () => {
    it('replaces the marker in byShelter on fulfilled', () => {
      const store = makeStore();
      const original = makeMarker({ id: 3, shelter_id: 10, name: 'Old' });
      store.dispatch(loadMapMarkers.fulfilled({ shelterId: 10, markers: [original] }, '', 10));

      const updated = makeMarker({ id: 3, shelter_id: 10, name: 'New' });
      store.dispatch(updateMarker.fulfilled(
        { shelterId: 10, marker: updated },
        '',
        { id: 3, shelterId: 10, input: { latitude: 44.1, longitude: -71.5, name: 'New', start_year: 1960, end_year: 1975, change_type: 'Original', notes: '' } },
      ));

      const list = store.getState().mapMarkers.byShelter[10];
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe('New');
    });
  });

  describe('deleteMarker', () => {
    it('replaces byShelter list on fulfilled', () => {
      const store = makeStore();
      const marker = makeMarker({ id: 7, shelter_id: 10 });
      store.dispatch(loadMapMarkers.fulfilled({ shelterId: 10, markers: [marker] }, '', 10));
      store.dispatch(deleteMarker.fulfilled(
        { shelterId: 10, markers: [] },
        '',
        { id: 7, shelterId: 10 },
      ));
      expect(store.getState().mapMarkers.byShelter[10]).toHaveLength(0);
    });
  });
});
