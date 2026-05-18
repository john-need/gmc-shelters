import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AdvancedFilters {
  yearMin: string;
  yearMax: string;
  architecture: string;
  builtBy: string;
  category: string;
  showOnWeb: 'any' | 'yes' | 'no';
}

export interface UiState {
  sidebarCollapsed: boolean;
  activeTab: 'shelter' | 'history' | 'sources' | 'photos' | 'markers';
  query: string;
  filter: 'all' | 'extant' | 'gone' | 'gmc';
  advancedFilters: AdvancedFilters;
  toast: { id: string; message: string } | null;
}

const initialState: UiState = {
  sidebarCollapsed: false,
  activeTab: 'shelter',
  query: '',
  filter: 'all',
  advancedFilters: {
    yearMin: '',
    yearMax: '',
    architecture: '',
    builtBy: '',
    category: '',
    showOnWeb: 'any',
  },
  toast: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveTab(state, action: PayloadAction<UiState['activeTab']>) {
      state.activeTab = action.payload;
    },
    setSidebarCollapsed(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    setQuery(state, action: PayloadAction<string>) {
      state.query = action.payload;
    },
    setFilter(state, action: PayloadAction<UiState['filter']>) {
      state.filter = action.payload;
    },
    setAdvancedFilters(state, action: PayloadAction<Partial<AdvancedFilters>>) {
      state.advancedFilters = { ...state.advancedFilters, ...action.payload };
    },
    showToast(state, action: PayloadAction<{ id: string; message: string }>) {
      state.toast = action.payload;
    },
    clearToast(state) {
      state.toast = null;
    },
  },
});

export const {
  setActiveTab,
  setSidebarCollapsed,
  setQuery,
  setFilter,
  setAdvancedFilters,
  showToast,
  clearToast,
} = uiSlice.actions;

export default uiSlice.reducer;
