import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { MapMarker, MapMarkerInput, DeleteMarkerOptions, DeleteMarkerResult } from '../../shared/ipc-types';

export interface MapMarkersState {
  byShelter: Record<number, MapMarker[]>;
  loading: boolean;
  error: string | null;
}

const initialState: MapMarkersState = {
  byShelter: {},
  loading: false,
  error: null,
};

export const loadMapMarkers = createAsyncThunk(
  'mapMarkers/loadByShelter',
  async (shelterId: number) => {
    if (typeof window !== 'undefined' && window.api) {
      const markers = await window.api.mapMarkers.getByShelter(shelterId);
      return { shelterId, markers };
    }
    return { shelterId, markers: [] as MapMarker[] };
  },
);

export const createMarker = createAsyncThunk(
  'mapMarkers/create',
  async (input: MapMarkerInput) => {
    const marker = await window.api.mapMarkers.create(input);
    return marker;
  },
);

export const updateMarker = createAsyncThunk(
  'mapMarkers/update',
  async ({ id, input }: { id: number; input: MapMarkerInput }) => {
    const marker = await window.api.mapMarkers.update(id, input);
    return marker;
  },
);

interface DeleteArgs {
  id: number;
  shelterId: number;
  opts?: DeleteMarkerOptions;
}

interface DeleteFulfilled {
  deleted: true;
  markerId: number;
  shelterId: number;
}

interface DeleteGapWarning extends DeleteMarkerResult {
  markerId: number;
  shelterId: number;
}

export const deleteMarker = createAsyncThunk(
  'mapMarkers/delete',
  async ({ id, shelterId, opts }: DeleteArgs): Promise<DeleteFulfilled | DeleteGapWarning> => {
    const result = await window.api.mapMarkers.delete(id, opts);
    if (result && (result as DeleteMarkerResult).gapWarning) {
      return { ...(result as DeleteMarkerResult), markerId: id, shelterId };
    }
    return { deleted: true, markerId: id, shelterId };
  },
);

const mapMarkersSlice = createSlice({
  name: 'mapMarkers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadMapMarkers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadMapMarkers.fulfilled, (state, action) => {
        state.loading = false;
        state.byShelter[action.payload.shelterId] = action.payload.markers;
      })
      .addCase(loadMapMarkers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message ?? 'Failed to load map markers';
      })
      .addCase(createMarker.fulfilled, (state, action) => {
        const marker = action.payload;
        if (!state.byShelter[marker.shelter_id]) {
          state.byShelter[marker.shelter_id] = [];
        }
        state.byShelter[marker.shelter_id].push(marker);
        state.byShelter[marker.shelter_id].sort((a, b) => a.start_year - b.start_year);
      })
      .addCase(updateMarker.fulfilled, (state, action) => {
        const marker = action.payload;
        const list = state.byShelter[marker.shelter_id];
        if (list) {
          const idx = list.findIndex((m) => m.id === marker.id);
          if (idx >= 0) list[idx] = marker;
        }
      })
      .addCase(deleteMarker.fulfilled, (state, action) => {
        const payload = action.payload;
        if ('gapWarning' in payload) return; // gap warning — do not mutate state
        const { markerId, shelterId } = payload as DeleteFulfilled;
        if (state.byShelter[shelterId]) {
          state.byShelter[shelterId] = state.byShelter[shelterId].filter((m) => m.id !== markerId);
        }
      });
  },
});

export default mapMarkersSlice.reducer;
