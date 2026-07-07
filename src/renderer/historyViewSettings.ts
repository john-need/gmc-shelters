export const DEFAULT_HISTORY_VIEW = 'both';

export type HistoryViewMode = 'source' | 'both' | 'preview';

export function normalizeHistoryViewMode(value: unknown): HistoryViewMode {
  return value === 'source' || value === 'both' || value === 'preview' ? value : DEFAULT_HISTORY_VIEW;
}

export function loadHistoryViewMode(): HistoryViewMode {
  try {
    return normalizeHistoryViewMode(localStorage.getItem('gmc.historyView'));
  } catch {
    return DEFAULT_HISTORY_VIEW;
  }
}

export function saveHistoryViewMode(mode: HistoryViewMode): void {
  try { localStorage.setItem('gmc.historyView', mode); } catch {}
}
