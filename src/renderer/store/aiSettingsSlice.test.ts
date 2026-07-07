import aiSettingsReducer, { loadApiKey, apiKeyChanged, selectHasValidApiKey, AiSettingsState } from './aiSettingsSlice';

const initialState: AiSettingsState = { apiKey: '' };

describe('aiSettingsSlice', () => {
  it('has correct initial state', () => {
    expect(aiSettingsReducer(undefined, { type: '@@init' })).toEqual(initialState);
  });

  describe('loadApiKey', () => {
    it('stores the fetched key on fulfilled', () => {
      const next = aiSettingsReducer(initialState, loadApiKey.fulfilled('sk-ant-x', '', undefined));
      expect(next.apiKey).toBe('sk-ant-x');
    });
  });

  describe('apiKeyChanged', () => {
    it('replaces the stored key', () => {
      const next = aiSettingsReducer({ apiKey: 'sk-ant-old' }, apiKeyChanged('sk-ant-new'));
      expect(next.apiKey).toBe('sk-ant-new');
    });
  });

  describe('selectHasValidApiKey', () => {
    it('returns false when no valid key is stored', () => {
      expect(selectHasValidApiKey({ aiSettings: { apiKey: '' } })).toBe(false);
      expect(selectHasValidApiKey({ aiSettings: { apiKey: 'not-a-key' } })).toBe(false);
    });

    it('returns true when a valid sk-ant- key is stored', () => {
      expect(selectHasValidApiKey({ aiSettings: { apiKey: 'sk-ant-x' } })).toBe(true);
    });
  });
});
