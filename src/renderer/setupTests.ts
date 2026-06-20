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
  },
  sources: {
    getByShelter: jest.fn().mockResolvedValue([]),
    getAll: jest.fn().mockResolvedValue([]),
    create: noop,
    update: noop,
    delete: noop,
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
