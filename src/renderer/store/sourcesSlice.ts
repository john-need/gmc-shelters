import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Source, SourceInput } from '../../shared/ipc-types';
import { syncHistorySourcesSection } from '../../shared/history-sources';
import { loadStoredPaths } from '../pathSettings';
import { saveHistory } from './sheltersSlice';

export interface SourcesState {
  byShelter: Record<number, Source[]>;
  loading: boolean;
}

interface SyncState {
  sources: SourcesState;
  shelters: {
    list: Array<{ id: number; slug: string; history: string | null; name: string }>;
    selectedId: number | null;
    editBuffer: { id: number; slug: string; history: string | null; name: string } | null;
    historyContent: string;
    historyDirty: boolean;
    historyOriginal: string;
    historyMissing: boolean;
  };
}

const initialState: SourcesState = {
  byShelter: {},
  loading: false,
};

async function getHistoryBaseContent(state: SyncState, shelterId: number, historyRelPath: string, shelterName: string): Promise<string> {
  if (state.shelters.selectedId === shelterId) {
    if (state.shelters.historyMissing && state.shelters.historyContent.trim() === '') {
      return `# ${shelterName}\n`;
    }
    if (
      state.shelters.historyDirty ||
      state.shelters.historyOriginal !== '' ||
      state.shelters.historyContent !== ''
    ) {
      return state.shelters.historyContent;
    }
  }

  if (typeof window !== 'undefined' && window.api) {
    const history = await window.api.history.read(historyRelPath, loadStoredPaths().SHELTERS_ROOT);
    if (history.missing && history.content.trim() === '') {
      return `# ${shelterName}\n`;
    }
    return history.content;
  }

  return '';
}

async function syncSourcesToHistory(
  state: SyncState,
  shelterId: number,
  nextSources: Source[],
  dispatch: (action: unknown) => unknown,
): Promise<void> {
  const shelter = state.shelters.editBuffer?.id === shelterId
    ? state.shelters.editBuffer
    : state.shelters.list.find((item) => item.id === shelterId);

  if (!shelter) return;

  const historyRelPath = shelter.history ?? `${shelter.slug}/${shelter.slug}.md`;
  const currentContent = await getHistoryBaseContent(state, shelterId, historyRelPath, shelter.name);
  const nextContent = syncHistorySourcesSection(currentContent, nextSources);
  await dispatch(saveHistory({ historyRelPath, content: nextContent }));
}

export const loadSources = createAsyncThunk(
  'sources/loadByShelter',
  async (shelterId: number) => {
    if (typeof window !== 'undefined' && window.api) {
      const sources = await window.api.sources.getByShelter(shelterId);
      return { shelterId, sources };
    }
    return { shelterId, sources: [] as Source[] };
  },
);

export const createSource = createAsyncThunk(
  'sources/create',
  async (input: SourceInput, { dispatch, getState }) => {
    if (typeof window !== 'undefined' && window.api) {
      const source = await window.api.sources.create(input);
      const state = getState() as SyncState;
      const existing = state.sources.byShelter[input.shelter_id] ?? [];
      await syncSourcesToHistory(state, input.shelter_id, [source, ...existing], dispatch);
      return { shelterId: input.shelter_id, source };
    }
    const today = new Date().toISOString().slice(0, 10);
    return {
      shelterId: input.shelter_id,
      source: { ...input, id: Date.now(), created: today, updated: today } as Source,
    };
  },
);

export const updateSource = createAsyncThunk(
  'sources/update',
  async (source: Source, { dispatch, getState }) => {
    if (typeof window !== 'undefined' && window.api) {
      const updated = await window.api.sources.update(source);
      const state = getState() as SyncState;
      const existing = state.sources.byShelter[source.shelter_id] ?? [];
      const nextSources = existing.map((item) => (item.id === updated.id ? updated : item));
      await syncSourcesToHistory(state, source.shelter_id, nextSources, dispatch);
      return { shelterId: source.shelter_id, source: updated };
    }
    return { shelterId: source.shelter_id, source };
  },
);

export const deleteSource = createAsyncThunk(
  'sources/delete',
  async ({ id, shelterId }: { id: number; shelterId: number }, { dispatch, getState }) => {
    if (typeof window !== 'undefined' && window.api) {
      await window.api.sources.delete(id);
      const state = getState() as SyncState;
      const existing = state.sources.byShelter[shelterId] ?? [];
      const nextSources = existing.filter((source) => source.id !== id);
      await syncSourcesToHistory(state, shelterId, nextSources, dispatch);
    }
    return { id, shelterId };
  },
);

const sourcesSlice = createSlice({
  name: 'sources',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadSources.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadSources.fulfilled, (state, action) => {
        state.loading = false;
        state.byShelter[action.payload.shelterId] = action.payload.sources;
      })
      .addCase(loadSources.rejected, (state) => {
        state.loading = false;
      })
      .addCase(createSource.fulfilled, (state, action) => {
        const { shelterId, source } = action.payload;
        if (!state.byShelter[shelterId]) state.byShelter[shelterId] = [];
        state.byShelter[shelterId].unshift(source);
      })
      .addCase(updateSource.fulfilled, (state, action) => {
        const { shelterId, source } = action.payload;
        const list = state.byShelter[shelterId];
        if (list) {
          const idx = list.findIndex((s) => s.id === source.id);
          if (idx >= 0) list[idx] = source;
        }
      })
      .addCase(deleteSource.fulfilled, (state, action) => {
        const { id, shelterId } = action.payload;
        if (state.byShelter[shelterId]) {
          state.byShelter[shelterId] = state.byShelter[shelterId].filter((s) => s.id !== id);
        }
      });
  },
});

export default sourcesSlice.reducer;
