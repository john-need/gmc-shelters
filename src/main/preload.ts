import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import type { ElectronAPI, Architecture, Category, CategoryInput, Shelter, ShelterCreateInput, PhotoUpdateInput, PhotoUploadInput, Source, SourceInput, MapMarkerCreateInput, MapMarkerUpdateInput } from '../shared/ipc-types';

const api: ElectronAPI = {
  categories: {
    getAll: () => ipcRenderer.invoke(CHANNELS.CATEGORIES_GET_ALL),
    create: (input: CategoryInput) => ipcRenderer.invoke(CHANNELS.CATEGORIES_CREATE, input),
    update: (cat: Category) => ipcRenderer.invoke(CHANNELS.CATEGORIES_UPDATE, cat),
    delete: (id: number, reassignTo?: string) =>
      ipcRenderer.invoke(CHANNELS.CATEGORIES_DELETE, { id, reassignTo }),
  },
  architectures: {
    getAll: () => ipcRenderer.invoke(CHANNELS.ARCHITECTURES_GET_ALL),
    create: (input) => ipcRenderer.invoke(CHANNELS.ARCHITECTURES_CREATE, input),
    update: (arch: Architecture) => ipcRenderer.invoke(CHANNELS.ARCHITECTURES_UPDATE, arch),
    delete: (id: number, reassignTo?: string) =>
      ipcRenderer.invoke(CHANNELS.ARCHITECTURES_DELETE, { id, reassignTo }),
  },
  shelters: {
    getAll: () => ipcRenderer.invoke(CHANNELS.SHELTERS_GET_ALL),
    getById: (id: number) => ipcRenderer.invoke(CHANNELS.SHELTERS_GET_BY_ID, { id }),
    create: (input: ShelterCreateInput) => ipcRenderer.invoke(CHANNELS.SHELTERS_CREATE, input),
    update: (shelter: Shelter) => ipcRenderer.invoke(CHANNELS.SHELTERS_UPDATE, shelter),
    delete: (id: number, slug: string, sheltersRoot: string) =>
      ipcRenderer.invoke(CHANNELS.SHELTERS_DELETE, { id, slug, sheltersRoot }),
  },
  photos: {
    getByShelter: (shelterId: number) =>
      ipcRenderer.invoke(CHANNELS.PHOTOS_GET_BY_SHELTER, { shelterId }),
    update: (input: PhotoUpdateInput & { id: number; shelter_id: number; sheltersRoot: string }) =>
      ipcRenderer.invoke(CHANNELS.PHOTOS_UPDATE, input),
    delete: (id: number, sheltersRoot: string) => ipcRenderer.invoke(CHANNELS.PHOTOS_DELETE, { id, sheltersRoot }),
    setDefault: (shelterId: number, photoId: number) =>
      ipcRenderer.invoke(CHANNELS.PHOTOS_SET_DEFAULT, { shelterId, photoId }),
    upload: (input: PhotoUploadInput) => ipcRenderer.invoke(CHANNELS.PHOTOS_UPLOAD, input),
    readMetadata: (slug: string, fileName: string, sheltersRoot: string) =>
      ipcRenderer.invoke(CHANNELS.PHOTOS_READ_METADATA, { slug, fileName, sheltersRoot }),
  },
  history: {
    read: (slug: string, sheltersRoot: string) =>
      ipcRenderer.invoke(CHANNELS.HISTORY_READ, { slug, sheltersRoot }),
    write: (slug: string, content: string, sheltersRoot: string) =>
      ipcRenderer.invoke(CHANNELS.HISTORY_WRITE, { slug, content, sheltersRoot }),
  },
  sources: {
    getByShelter: (shelterId: number) =>
      ipcRenderer.invoke(CHANNELS.SOURCES_GET_BY_SHELTER, { shelterId }),
    create: (input: SourceInput) => ipcRenderer.invoke(CHANNELS.SOURCES_CREATE, input),
    update: (source: Source) => ipcRenderer.invoke(CHANNELS.SOURCES_UPDATE, source),
    delete: (id: number) => ipcRenderer.invoke(CHANNELS.SOURCES_DELETE, { id }),
  },
  mapMarkers: {
    getByShelter: (shelterId: number) =>
      ipcRenderer.invoke(CHANNELS.MAP_MARKERS_GET_BY_SHELTER, { shelterId }),
    create: (input: MapMarkerCreateInput) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_CREATE, input),
    update: (id: number, input: MapMarkerUpdateInput) =>
      ipcRenderer.invoke(CHANNELS.MAP_MARKERS_UPDATE, { id, input }),
    delete: (id: number) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_DELETE, { id }),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.SHELL_OPEN_EXTERNAL, { url }),
  },
  app: {
    getVersion: () => ipcRenderer.invoke(CHANNELS.APP_GET_VERSION),
    getRepoRoot: () => ipcRenderer.invoke(CHANNELS.APP_GET_REPO_ROOT),
    browseForDatabasePath: (defaultPath?: string) =>
      ipcRenderer.invoke(CHANNELS.APP_BROWSE_DATABASE_PATH, { defaultPath }),
    browseForDirectoryPath: (defaultPath?: string) =>
      ipcRenderer.invoke(CHANNELS.APP_BROWSE_DIRECTORY_PATH, { defaultPath }),
    validatePath: (input: string) => ipcRenderer.invoke(CHANNELS.APP_VALIDATE_PATH, { input }),
    closeWindow: () => ipcRenderer.invoke(CHANNELS.APP_WINDOW_CLOSE),
    minimizeWindow: () => ipcRenderer.invoke(CHANNELS.APP_WINDOW_MINIMIZE),
    toggleFullscreen: () => ipcRenderer.invoke(CHANNELS.APP_WINDOW_TOGGLE_FULLSCREEN),
    isFullscreen: () => ipcRenderer.invoke(CHANNELS.APP_WINDOW_IS_FULLSCREEN),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
  },
};

contextBridge.exposeInMainWorld('api', api);
