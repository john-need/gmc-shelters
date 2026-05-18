import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { MapMarker, MapMarkerCreateInput, MapMarkerUpdateInput } from '../../shared/ipc-types';

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
  async (input: MapMarkerCreateInput) => {
    const markers = await window.api.mapMarkers.create(input);
    return { shelterId: input.shelter_id, markers };
  },
);

export const updateMarker = createAsyncThunk(
  'mapMarkers/update',
  async ({ id, shelterId, input }: { id: number; shelterId: number; input: MapMarkerUpdateInput }) => {
    const marker = await window.api.mapMarkers.update(id, input);
    return { shelterId, marker };
  },
);

export const deleteMarker = createAsyncThunk(
  'mapMarkers/delete',
  async ({ id, shelterId }: { id: number; shelterId: number }) => {
    const markers = await window.api.mapMarkers.delete(id);
    return { shelterId, markers };
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
        const { shelterId, markers } = action.payload;
        state.byShelter[shelterId] = markers;
      })
      .addCase(updateMarker.fulfilled, (state, action) => {
        const { shelterId, marker } = action.payload;
        const list = state.byShelter[shelterId];
        if (list) {
          const idx = list.findIndex((m) => m.id === marker.id);
          if (idx >= 0) list[idx] = marker;
        }
      })
      .addCase(deleteMarker.fulfilled, (state, action) => {
        const { shelterId, markers } = action.payload;
        state.byShelter[shelterId] = markers;
      });
  },
});

export default mapMarkersSlice.reducer;
