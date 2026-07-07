import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { isValidAnthropicKey } from '../../shared/anthropic-key';

export interface AiSettingsState {
  apiKey: string;
}

const initialState: AiSettingsState = {
  apiKey: '',
};

export const loadApiKey = createAsyncThunk('aiSettings/loadApiKey', async () => {
  return window.api.ai.getApiKey();
});

const aiSettingsSlice = createSlice({
  name: 'aiSettings',
  initialState,
  reducers: {
    apiKeyChanged(state, action: PayloadAction<string>) {
      state.apiKey = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadApiKey.fulfilled, (state, action) => {
      state.apiKey = action.payload;
    });
  },
});

export const { apiKeyChanged } = aiSettingsSlice.actions;

export function selectHasValidApiKey(state: { aiSettings: AiSettingsState }): boolean {
  return isValidAnthropicKey(state.aiSettings.apiKey);
}

export default aiSettingsSlice.reducer;
