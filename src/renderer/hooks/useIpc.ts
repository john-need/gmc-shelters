import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppPathValidation, ElectronAPI, HistoryReadResult } from '../../shared/ipc-types';
import type { AppDispatch } from '../store';
import { showToast } from '../store/uiSlice';

const noop = () => Promise.resolve(undefined as never);
const noopHistoryRead = () => Promise.resolve({ content: '', missing: false } as HistoryReadResult);
const noopPathValidation = () => Promise.resolve({
  input: '',
  resolvedPath: '',
  exists: false,
  isFile: false,
  isDirectory: false,
} as AppPathValidation);

const noopApi: ElectronAPI = {
  categories: { getAll: noop, create: noop, update: noop, delete: noop },
  architectures: { getAll: noop, create: noop, update: noop, delete: noop },
  shelters: {
    getAll: noop, getById: noop, create: noop, update: noop, delete: noop, setHistory: noop,
    generateDescription: () => Promise.resolve({ ok: false, error: 'no_api_key' }),
  },
  photos: { getByShelter: noop, update: noop, delete: noop, move: noop, moveToUnidentified: noop, setDefault: noop, reorder: noop, upload: noop, readMetadata: noop, export: noop, readFileMetadata: noop, writeFileMetadata: noop, reconcileScan: noop, reconcileApply: noop, openFolder: () => Promise.resolve({ ok: false }) },
  history: {
    read: noopHistoryRead,
    write: noop,
    generate: () => Promise.resolve({ ok: false, error: 'no_api_key' }),
    onGenerateProgress: () => () => {},
    respondToPermission: noop,
  },
  sources: { getByShelter: noop, getAll: noop, create: noop, update: noop, delete: noop, cleanUpQuote: noop },
  mapMarkers: { getByShelter: noop, create: noop, update: noop, delete: noop },
  export: { build: noop },
  publish: { preflight: noop, toWeb: () => Promise.resolve(undefined as never), cancel: noop, testConnection: noop, checkCredentials: noop, importCredentials: noop, onProgress: () => () => {} },
  wiki: {
    search: () => Promise.resolve([]),
    openPdf: () => Promise.resolve({ ok: true }),
    indexReport: () => Promise.resolve(null),
    getHeader: () => Promise.resolve(null),
    saveHeader: () => Promise.resolve({ ok: true }),
    findResource: () => Promise.resolve(null),
  },
  ai: { getApiKey: () => Promise.resolve(''), setApiKey: noop, getModel: () => Promise.resolve('default'), setModel: noop },
  mcp: {
    getEnabled: () => Promise.resolve(false),
    setEnabled: noop,
    getConnectionInfo: () => Promise.resolve({ serverName: 'gmc-shelters', url: 'http://127.0.0.1:5972/mcp' }),
  },
  collections: {
    status: () => Promise.resolve([]),
    run: noop,
    cancel: noop,
    onProgress: () => () => {},
    setDefaults: () => Promise.resolve({ ok: true, updated: 0 }),
    addFiles: () => Promise.resolve({ added: [], skipped: [] }),
    deleteFile: noop,
    delete: noop,
  },
  research: { webSearch: () => Promise.resolve({ ok: true, results: [] }) },
  shell: { openExternal: noop },
  app: {
    getVersion: noop,
    getRepoRoot: noop,
    browseForDatabasePath: noop,
    browseForDirectoryPath: noop,
    browseForHistoryFile: noop,
    validatePath: noopPathValidation,
    closeWindow: noop,
    minimizeWindow: noop,
    toggleFullscreen: noop,
    isFullscreen: noop,
    getFilePath: () => '',
  },
};

export function useIpc(): ElectronAPI {
  if (typeof window !== 'undefined' && window.api) {
    return window.api;
  }
  return noopApi;
}

export function useIpcCall<T>(
  fn: () => Promise<T>,
  deps: unknown[],
): { data: T | null; loading: boolean; error: string | null } {
  const dispatch = useDispatch<AppDispatch>();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          const msg = err.message ?? 'Unknown error';
          setError(msg);
          setLoading(false);
          dispatch(showToast({ id: Date.now().toString(), message: msg }));
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
