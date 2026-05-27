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
    upload: noop,
  },
  history: {
    read: jest.fn().mockResolvedValue(defaultHistoryRead),
    write: noop,
  },
  sources: {
    getByShelter: jest.fn().mockResolvedValue([]),
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
  },
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true });
