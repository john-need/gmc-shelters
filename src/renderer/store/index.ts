import { configureStore } from '@reduxjs/toolkit';
import type { Middleware } from '@reduxjs/toolkit';
import sheltersReducer from './sheltersSlice';
import photosReducer from './photosSlice';
import sourcesReducer from './sourcesSlice';
import mapMarkersReducer from './mapMarkersSlice';
import uiReducer from './uiSlice';
import architecturesReducer from './architecturesSlice';
import categoriesReducer from './categoriesSlice';
import { showToast } from './uiSlice';

const toastLogger: Middleware = () => (next) => (action) => {
  if (showToast.match(action)) {
    const { id, message } = action.payload;
    if (id.endsWith('-error')) {
      console.error(`[toast] ${id}: ${message}`);
    } else if (id.endsWith('-warn')) {
      console.warn(`[toast] ${id}: ${message}`);
    } else {
      console.info(`[toast] ${id}: ${message}`);
    }
  }
  return next(action);
};

export const store = configureStore({
  reducer: {
    shelters: sheltersReducer,
    photos: photosReducer,
    sources: sourcesReducer,
    mapMarkers: mapMarkersReducer,
    ui: uiReducer,
    architectures: architecturesReducer,
    categories: categoriesReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(toastLogger),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
