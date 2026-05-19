import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from './sheltersSlice';
import photosReducer from './photosSlice';
import sourcesReducer from './sourcesSlice';
import mapMarkersReducer from './mapMarkersSlice';
import uiReducer from './uiSlice';
import architecturesReducer from './architecturesSlice';

export const store = configureStore({
  reducer: {
    shelters: sheltersReducer,
    photos: photosReducer,
    sources: sourcesReducer,
    mapMarkers: mapMarkersReducer,
    ui: uiReducer,
    architectures: architecturesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
