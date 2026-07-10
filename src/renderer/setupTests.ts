import '@testing-library/jest-dom';
import type { AppPathValidation, ElectronAPI, HistoryReadResult } from '../shared/ipc-types';

const noop = jest.fn().mockResolvedValue(undefined);
const defaultPathValidation: AppPathValidation = {
  input: '',
  resolvedPath: '/tmp',
  exists: true,
  isFile: true,
  isDirectory: false,
};
const defaultHistoryRead: HistoryReadResult = {
  content: '',
  missing: false,
};

const mockApi: ElectronAPI = {
  categories: {
    getAll: jest.fn().mockResolvedValue([]),
    create: noop,
    update: noop,
    delete: noop,
  },
  architectures: {
    getAll: jest.fn().mockResolvedValue([]),
    create: noop,
    update: noop,
    delete: noop,
  },
  shelters: {
    getAll: jest.fn().mockResolvedValue([]),
    getById: noop,
    create: noop,
    update: noop,
    delete: noop,
    setHistory: noop,
  },
  photos: {
    getByShelter: jest.fn().mockResolvedValue([]),
    update: noop,
    delete: noop,
    move: noop,
    setDefault: noop,
    reorder: noop,
    upload: noop,
    readMetadata: jest.fn().mockResolvedValue({}),
    export: jest.fn().mockResolvedValue(null),
    readFileMetadata: jest.fn().mockResolvedValue([]),
    writeFileMetadata: noop,
    reconcileScan: jest.fn().mockResolvedValue({ untrackedFiles: [], orphanedRecords: [] }),
    reconcileApply: jest.fn().mockResolvedValue({ added: 0, deleted: 0, failed: 0, failures: [] }),
  },
  history: {
    read: jest.fn().mockResolvedValue(defaultHistoryRead),
    write: noop,
    generate: jest.fn().mockResolvedValue({ ok: false, error: 'no_api_key' }),
  },
  sources: {
    getByShelter: jest.fn().mockResolvedValue([]),
    getAll: jest.fn().mockResolvedValue([]),
    create: noop,
    update: noop,
    delete: noop,
    cleanUpQuote: noop,
  },
  mapMarkers: {
    getByShelter: jest.fn().mockResolvedValue([]),
    create: noop,
    update: noop,
    delete: noop,
  },
  export: { build: noop },
  publish: {
    preflight: jest.fn().mockResolvedValue({ toUpload: [], toUpdate: [], toDelete: [], skipCount: 0, historyToUploadCount: 0, historyUnchangedCount: 0 }),
    toWeb: jest.fn().mockResolvedValue(null),
    cancel: jest.fn().mockResolvedValue(undefined),
    testConnection: jest.fn().mockResolvedValue(null),
    checkCredentials: jest.fn().mockResolvedValue({ exists: false, path: '/tmp/credentials.json' }),
    importCredentials: jest.fn().mockResolvedValue(null),
    onProgress: jest.fn().mockReturnValue(jest.fn()),
  },
  wiki: {
    search: jest.fn().mockResolvedValue([]),
    openPdf: jest.fn().mockResolvedValue({ ok: true }),
    indexReport: jest.fn().mockResolvedValue(null),
    getHeader: jest.fn().mockResolvedValue(null),
    saveHeader: jest.fn().mockResolvedValue({ ok: true }),
  },
  ai: {
    getApiKey: jest.fn().mockResolvedValue(''),
    setApiKey: jest.fn().mockResolvedValue(undefined),
    getModel: jest.fn().mockResolvedValue('default'),
    setModel: jest.fn().mockResolvedValue(undefined),
  },
  collections: {
    status: jest.fn().mockResolvedValue([]),
    run: jest.fn().mockResolvedValue({ ok: true, converted: 0, cached: 0, failed: 0 }),
    cancel: jest.fn().mockResolvedValue(undefined),
    onProgress: jest.fn().mockReturnValue(jest.fn()),
    setDefaults: jest.fn().mockResolvedValue({ ok: true, updated: 0 }),
    addFiles: jest.fn().mockResolvedValue({ added: [], skipped: [] }),
    deleteFile: jest.fn().mockResolvedValue({ ok: true }),
    delete: jest.fn().mockResolvedValue({ ok: true }),
  },
  research: {
    webSearch: jest.fn().mockResolvedValue({ ok: true, results: [] }),
  },
  shell: { openExternal: noop },
  app: {
    getVersion: jest.fn().mockResolvedValue('0.1.0'),
    getRepoRoot: jest.fn().mockResolvedValue('/tmp'),
    browseForDatabasePath: jest.fn().mockResolvedValue(null),
    browseForDirectoryPath: jest.fn().mockResolvedValue(null),
    browseForHistoryFile: jest.fn().mockResolvedValue(null),
    validatePath: jest.fn().mockResolvedValue(defaultPathValidation),
    closeWindow: noop,
    minimizeWindow: noop,
    toggleFullscreen: noop,
    isFullscreen: jest.fn().mockResolvedValue(false),
    getFilePath: jest.fn().mockReturnValue('/tmp/mock-file.jpg'),
  },
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true });

// Mock scrollTo for JSDOM
HTMLDivElement.prototype.scrollTo = jest.fn();

// JSDOM has no layout engine, so ResizeObserver doesn't exist.
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
