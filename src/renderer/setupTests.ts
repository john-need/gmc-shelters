import '@testing-library/jest-dom';
import type { ElectronAPI } from '../shared/ipc-types';

const noop = jest.fn().mockResolvedValue(undefined);

const mockApi: ElectronAPI = {
  shelters: {
    getAll: jest.fn().mockResolvedValue([]),
    getById: noop,
    create: noop,
    update: noop,
    delete: noop,
  },
  photos: {
    getByShelter: jest.fn().mockResolvedValue([]),
    update: noop,
    delete: noop,
    setDefault: noop,
    upload: noop,
  },
  history: {
    read: jest.fn().mockResolvedValue(''),
    write: noop,
  },
  sources: {
    getByShelter: jest.fn().mockResolvedValue([]),
    create: noop,
    update: noop,
    delete: noop,
  },
  shell: { openExternal: noop },
  app: {
    getVersion: jest.fn().mockResolvedValue('0.1.0'),
    getRepoRoot: jest.fn().mockResolvedValue('/tmp'),
  },
};

Object.defineProperty(window, 'api', { value: mockApi, writable: true });
