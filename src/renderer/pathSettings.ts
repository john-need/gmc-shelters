export const DEFAULT_PATHS = {
  DB_PATH: 'database/gmc_shelters.sqlite',
  SHELTERS_ROOT: 'shelters/',
};

export type StoredPaths = typeof DEFAULT_PATHS;

export function normalizeStoredPaths(value: unknown): StoredPaths {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    DB_PATH: typeof record.DB_PATH === 'string' ? record.DB_PATH : DEFAULT_PATHS.DB_PATH,
    SHELTERS_ROOT: typeof record.SHELTERS_ROOT === 'string'
      ? record.SHELTERS_ROOT
      : DEFAULT_PATHS.SHELTERS_ROOT,
  };
}

export function loadStoredPaths(): StoredPaths {
  try {
    const stored = localStorage.getItem('gmc.paths');
    return stored ? normalizeStoredPaths(JSON.parse(stored)) : { ...DEFAULT_PATHS };
  } catch {
    return { ...DEFAULT_PATHS };
  }
}

export function buildHistoryFileDisplayPath(sheltersRoot: string, slug: string): string {
  const trimmedRoot = sheltersRoot.trim();
  const normalizedRoot = trimmedRoot.replace(/[\\/]+$/, '');
  const fullPath = `${normalizedRoot}/${slug}/${slug}.md`;
  const parts = fullPath.split(/[\\/]+/).filter(Boolean);
  return parts.slice(-3).join('/');
}
