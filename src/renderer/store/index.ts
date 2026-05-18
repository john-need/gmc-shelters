import { configureStore } from '@reduxjs/toolkit';
import sheltersReducer from './sheltersSlice';
import photosReducer from './photosSlice';
import sourcesReducer from './sourcesSlice';
import mapMarkersReducer from './mapMarkersSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    shelters: sheltersReducer,
    photos: photosReducer,
    sources: sourcesReducer,
    mapMarkers: mapMarkersReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
