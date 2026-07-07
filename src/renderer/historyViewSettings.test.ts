import {
  DEFAULT_HISTORY_VIEW,
  normalizeHistoryViewMode,
  loadHistoryViewMode,
  saveHistoryViewMode,
} from './historyViewSettings';

describe('historyViewSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to "both" when nothing is stored', () => {
    expect(loadHistoryViewMode()).toBe('both');
  });

  it('normalizes invalid or missing values back to the default', () => {
    expect(normalizeHistoryViewMode(undefined)).toBe(DEFAULT_HISTORY_VIEW);
    expect(normalizeHistoryViewMode(null)).toBe(DEFAULT_HISTORY_VIEW);
    expect(normalizeHistoryViewMode('bogus')).toBe(DEFAULT_HISTORY_VIEW);
    expect(normalizeHistoryViewMode(42)).toBe(DEFAULT_HISTORY_VIEW);
  });

  it('normalizes each valid mode to itself', () => {
    expect(normalizeHistoryViewMode('source')).toBe('source');
    expect(normalizeHistoryViewMode('both')).toBe('both');
    expect(normalizeHistoryViewMode('preview')).toBe('preview');
  });

  it('round-trips a saved value through load', () => {
    saveHistoryViewMode('source');
    expect(loadHistoryViewMode()).toBe('source');

    saveHistoryViewMode('preview');
    expect(loadHistoryViewMode()).toBe('preview');
  });

  it('falls back to the default when localStorage holds a malformed value', () => {
    localStorage.setItem('gmc.historyView', 'not-a-real-mode');
    expect(loadHistoryViewMode()).toBe('both');
  });
});
