// IPC channel name constants
export const CHANNELS = {
  ARCHITECTURES_GET_ALL: 'architectures:getAll',
  ARCHITECTURES_CREATE: 'architectures:create',
  ARCHITECTURES_UPDATE: 'architectures:update',
  ARCHITECTURES_DELETE: 'architectures:delete',
  CATEGORIES_GET_ALL: 'categories:getAll',
  CATEGORIES_CREATE: 'categories:create',
  CATEGORIES_UPDATE: 'categories:update',
  CATEGORIES_DELETE: 'categories:delete',
  SHELTERS_GET_ALL: 'shelters:getAll',
  SHELTERS_GET_BY_ID: 'shelters:getById',
  SHELTERS_CREATE: 'shelters:create',
  SHELTERS_UPDATE: 'shelters:update',
  SHELTERS_DELETE: 'shelters:delete',
  PHOTOS_GET_BY_SHELTER: 'photos:getByShelter',
  PHOTOS_UPDATE: 'photos:update',
  PHOTOS_DELETE: 'photos:delete',
  PHOTOS_SET_DEFAULT: 'photos:setDefault',
  PHOTOS_UPLOAD: 'photos:upload',
  HISTORY_READ: 'history:read',
  HISTORY_WRITE: 'history:write',
  SOURCES_GET_BY_SHELTER: 'sources:getByShelter',
  SOURCES_CREATE: 'sources:create',
  SOURCES_UPDATE: 'sources:update',
  SOURCES_DELETE: 'sources:delete',
  MAP_MARKERS_GET_BY_SHELTER: 'mapMarkers:getByShelter',
  MAP_MARKERS_CREATE: 'mapMarkers:create',
  MAP_MARKERS_UPDATE: 'mapMarkers:update',
  MAP_MARKERS_DELETE: 'mapMarkers:delete',
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_REPO_ROOT: 'app:getRepoRoot',
} as const;

export interface Architecture {
  id: number;
  name: string;
  description: string;
  created: string;
  updated: string;
}

export type ArchitectureInput = {
  name: string;
  description: string;
};

export const CHANGE_TYPES = ['Original', 'Moved', 'Renamed', 'Moved & Renamed'] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export interface MapMarker {
  id: number;
  shelter_id: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  end_year: number | null;
  change_type: ChangeType;
  notes: string;
  is_extant: boolean;
  photo_id: number | null;
  created: string;
  updated: string;
}

export type MapMarkerCreateInput = {
  shelter_id: number;
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  change_type: ChangeType;
  notes: string;
};

export type MapMarkerUpdateInput = {
  latitude: number;
  longitude: number;
  name: string;
  change_type: ChangeType;
  notes: string;
};


export type SourceType =
  | 'book'
  | 'chapter'
  | 'journal'
  | 'newspaper'
  | 'magazine'
  | 'website'
  | 'archive'
  | 'manuscript'
  | 'interview'
  | 'map'
  | 'report'
  | 'other';

export interface Shelter {
  id: number;
  name: string;
  start_year: number;
  end_year: number | null;
  description: string;
  slug: string;
  default_photo_id: number | null;
  is_gmc: boolean;
  architecture: string;
  built_by: string;
  notes: string;
  created: string;
  updated: string;
  is_extant: boolean;
  category: string;
  show_on_web: boolean;
  photo_count?: number;
}

export interface Category {
  id: number;
  name: string;
  description: string;
  created: string;
  updated: string;
}

export type CategoryInput = {
  name: string;
  description: string;
};

export interface Photo {
  id: number;
  photographer: string;
  file_name: string;
  caption: string;
  date_taken: string;
  notes: string;
  created: string;
  updated: string;
  shelter_id: number;
  alt_text: string;
  title: string;
  description: string;
  include_in_post: boolean;
  file_path?: string;
}

export interface Source {
  id: number;
  shelter_id: number;
  type: SourceType;
  author: string;
  title: string;
  container_title: string;
  editor: string;
  edition: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  place: string;
  year: number | null;
  date: string;
  url: string;
  access_date: string;
  archive: string;
  archive_location: string;
  annotation: string;
  notes: string;
  created: string;
  updated: string;
}

export type SourceInput = Omit<Source, 'id' | 'created' | 'updated'>;

export interface ShelterCreateInput {
  name: string;
  start_year: number;
  category: string;
  is_gmc: boolean;
}

export type PhotoUpdateInput = Omit<Photo, 'id' | 'shelter_id' | 'created' | 'file_name' | 'file_path'>;

export interface PhotoUploadInput {
  shelterId: number;
  sourcePath: string;
  title?: string;
}

export interface ElectronAPI {
  architectures: {
    getAll: () => Promise<Architecture[]>;
    create: (input: ArchitectureInput) => Promise<Architecture>;
    update: (arch: Architecture) => Promise<Architecture>;
    delete: (id: number, reassignTo?: string) => Promise<void>;
  };
  categories: {
    getAll: () => Promise<Category[]>;
    create: (input: CategoryInput) => Promise<Category>;
    update: (cat: Category) => Promise<Category>;
    delete: (id: number, reassignTo?: string) => Promise<void>;
  };
  shelters: {
    getAll: () => Promise<Shelter[]>;
    getById: (id: number) => Promise<Shelter | null>;
    create: (input: ShelterCreateInput) => Promise<Shelter>;
    update: (shelter: Shelter) => Promise<Shelter>;
    delete: (id: number) => Promise<void>;
  };
  photos: {
    getByShelter: (shelterId: number) => Promise<Photo[]>;
    update: (input: PhotoUpdateInput) => Promise<Photo>;
    delete: (id: number) => Promise<void>;
    setDefault: (shelterId: number, photoId: number) => Promise<void>;
    upload: (input: PhotoUploadInput) => Promise<Photo>;
  };
  history: {
    read: (slug: string) => Promise<string>;
    write: (slug: string, content: string) => Promise<void>;
  };
  sources: {
    getByShelter: (shelterId: number) => Promise<Source[]>;
    create: (input: SourceInput) => Promise<Source>;
    update: (source: Source) => Promise<Source>;
    delete: (id: number) => Promise<void>;
  };
  mapMarkers: {
    getByShelter: (shelterId: number) => Promise<MapMarker[]>;
    create: (input: MapMarkerCreateInput) => Promise<MapMarker[]>;
    update: (id: number, input: MapMarkerUpdateInput) => Promise<MapMarker>;
    delete: (id: number) => Promise<MapMarker[]>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    getRepoRoot: () => Promise<string>;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
