import { contextBridge, ipcRenderer } from 'electron';
import { CHANNELS } from '@shared/ipc-types';
import type { ElectronAPI, Shelter, ShelterCreateInput, PhotoUpdateInput, PhotoUploadInput, Source, SourceInput, MapMarkerInput, DeleteMarkerOptions } from '../shared/ipc-types';

const api: ElectronAPI = {
  shelters: {
    getAll: () => ipcRenderer.invoke(CHANNELS.SHELTERS_GET_ALL),
    getById: (id: number) => ipcRenderer.invoke(CHANNELS.SHELTERS_GET_BY_ID, { id }),
    create: (input: ShelterCreateInput) => ipcRenderer.invoke(CHANNELS.SHELTERS_CREATE, input),
    update: (shelter: Shelter) => ipcRenderer.invoke(CHANNELS.SHELTERS_UPDATE, shelter),
    delete: (id: number) => ipcRenderer.invoke(CHANNELS.SHELTERS_DELETE, { id }),
  },
  photos: {
    getByShelter: (shelterId: number) =>
      ipcRenderer.invoke(CHANNELS.PHOTOS_GET_BY_SHELTER, { shelterId }),
    update: (input: PhotoUpdateInput) => ipcRenderer.invoke(CHANNELS.PHOTOS_UPDATE, input),
    delete: (id: number) => ipcRenderer.invoke(CHANNELS.PHOTOS_DELETE, { id }),
    setDefault: (shelterId: number, photoId: number) =>
      ipcRenderer.invoke(CHANNELS.PHOTOS_SET_DEFAULT, { shelterId, photoId }),
    upload: (input: PhotoUploadInput) => ipcRenderer.invoke(CHANNELS.PHOTOS_UPLOAD, input),
  },
  history: {
    read: (slug: string) => ipcRenderer.invoke(CHANNELS.HISTORY_READ, { slug }),
    write: (slug: string, content: string) =>
      ipcRenderer.invoke(CHANNELS.HISTORY_WRITE, { slug, content }),
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
    create: (input: MapMarkerInput) => ipcRenderer.invoke(CHANNELS.MAP_MARKERS_CREATE, input),
    update: (id: number, input: MapMarkerInput) =>
      ipcRenderer.invoke(CHANNELS.MAP_MARKERS_UPDATE, { id, input }),
    delete: (id: number, opts?: DeleteMarkerOptions) =>
      ipcRenderer.invoke(CHANNELS.MAP_MARKERS_DELETE, { id, opts }),
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(CHANNELS.SHELL_OPEN_EXTERNAL, { url }),
  },
  app: {
    getVersion: () => ipcRenderer.invoke(CHANNELS.APP_GET_VERSION),
    getRepoRoot: () => ipcRenderer.invoke(CHANNELS.APP_GET_REPO_ROOT),
  },
};

contextBridge.exposeInMainWorld('api', api);
