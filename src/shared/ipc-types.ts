// IPC channel name constants
export interface FileMetadataTag {
  group: string;
  key: string;
  label: string;
  value: string | null;
  writable: boolean;
}

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
  SHELTERS_SET_HISTORY: 'shelters:setHistory',
  PHOTOS_GET_BY_SHELTER: 'photos:getByShelter',
  PHOTOS_UPDATE: 'photos:update',
  PHOTOS_DELETE: 'photos:delete',
  PHOTOS_SET_DEFAULT: 'photos:setDefault',
  PHOTOS_UPLOAD: 'photos:upload',
  PHOTOS_READ_METADATA: 'photos:readMetadata',
  PHOTOS_READ_FILE_METADATA: 'photos:readFileMetadata',
  PHOTOS_WRITE_FILE_METADATA: 'photos:writeFileMetadata',
  PHOTOS_RECONCILE_SCAN: 'photos:reconcileScan',
  PHOTOS_RECONCILE_APPLY: 'photos:reconcileApply',
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
  APP_BROWSE_DATABASE_PATH: 'app:browseDatabasePath',
  APP_BROWSE_DIRECTORY_PATH: 'app:browseDirectoryPath',
  APP_BROWSE_HISTORY_FILE: 'app:browseHistoryFile',
  APP_VALIDATE_PATH: 'app:validatePath',
  APP_WINDOW_CLOSE: 'app:windowClose',
  APP_WINDOW_MINIMIZE: 'app:windowMinimize',
  APP_WINDOW_TOGGLE_FULLSCREEN: 'app:windowToggleFullscreen',
  APP_WINDOW_IS_FULLSCREEN: 'app:windowIsFullscreen',
  EXPORT_BUILD: 'export:build',
  PUBLISH_PREFLIGHT: 'publish:preflight',
  PUBLISH_TO_WEB: 'publish:toWeb',
  PUBLISH_CANCEL: 'publish:cancel',
  PUBLISH_TEST_CONNECTION: 'publish:testConnection',
  PUBLISH_CHECK_CREDENTIALS: 'publish:checkCredentials',
  PUBLISH_IMPORT_CREDENTIALS: 'publish:importCredentials',
  PUBLISH_PROGRESS: 'publish:progress',
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
  history: string | null;
  photo_count?: number;
  default_photo_file_name?: string | null;
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
  quote: string;
  created: string;
  updated: string;
}

export type SourceInput = Omit<Source, 'id' | 'created' | 'updated'>;

export interface ShelterCreateInput {
  name: string;
  start_year: number;
  category: string;
  is_gmc: boolean;
  sheltersRoot: string;
}

export interface PhotoTransformInput {
  rotation?: number;
  flipped?: boolean;
  crop?: { x: number; y: number; width: number; height: number } | null;
}

export type PhotoUpdateInput = Omit<Photo, 'id' | 'shelter_id' | 'created' | 'file_name' | 'file_path'> & PhotoTransformInput;

export interface UntrackedFile {
  fileName: string;
}

export interface OrphanedRecord {
  id: number;
  fileName: string;
  title: string;
}

export interface ReconcileScanResult {
  untrackedFiles: UntrackedFile[];
  orphanedRecords: OrphanedRecord[];
}

export interface ReconcileApplyInput {
  shelterId: number;
  sheltersRoot: string;
  filesToAdd: string[];
  recordIdsToDelete: number[];
}

export interface ReconcileItemOutcome {
  item: string;
  reason: string;
}

export interface ReconcileApplyResult {
  added: number;
  deleted: number;
  failed: number;
  failures: ReconcileItemOutcome[];
}

export interface PhotoUploadInput {
  shelterId: number;
  sourcePath: string;
  sheltersRoot: string;
  title?: string;
}

export interface AppPathValidation {
  input: string;
  resolvedPath: string;
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
}

export interface HistoryReadResult {
  content: string;
  missing: boolean;
}

export interface ExportResult {
  cancelled: boolean;
  savedTo: string | null;
  shelterCount: number;
  photoCount: number;
  skippedPhotos: number;
}

export interface PublishPreflightInput {
  rootFolderId: string;
  manifestName: string;
  scopes: string[];
  sheltersRoot: string;
}

export interface PublishDiffItem {
  fileName: string;
  shelterSlug: string;
  updated?: string;
  priorUpdated?: string;
  driveFileId?: string | null;
}

export interface PublishDiff {
  newCount: number;
  updatedCount: number;
  deleteCount: number;
  unchangedCount: number;
  shelterCount: number;
  markerCount: number;
  historyFileCount: number;
  toUpload: PublishDiffItem[];
  toUpdate: PublishDiffItem[];
  toDelete: PublishDiffItem[];
}

export interface PublishToWebInput {
  _confirm: true;
}

export interface PublishProgress {
  stage: 'building' | 'uploading' | 'manifest';
  current: number;
  total: number;
  fileName?: string;
}

export interface PublishResult {
  shelterCount: number;
  photosUploaded: number;
  photosUpdated: number;
  photosSkipped: number;
  photosFailed: number;
  photosMissing: number;
  skippedBuildPhotos: number;
  manifestWritten: boolean;
  manifestError?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
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
    delete: (id: number, slug: string, sheltersRoot: string) => Promise<void>;
    setHistory: (id: number, history: string) => Promise<void>;
  };
  photos: {
    getByShelter: (shelterId: number) => Promise<Photo[]>;
    update: (input: PhotoUpdateInput & { id: number; shelter_id: number; sheltersRoot: string }) => Promise<Photo>;
    delete: (id: number, sheltersRoot: string) => Promise<void>;
    setDefault: (shelterId: number, photoId: number) => Promise<void>;
    upload: (input: PhotoUploadInput) => Promise<Photo>;
    readMetadata: (slug: string, fileName: string, sheltersRoot: string) => Promise<Partial<Photo>>;
    readFileMetadata: (slug: string, fileName: string, sheltersRoot: string) => Promise<FileMetadataTag[]>;
    writeFileMetadata: (slug: string, fileName: string, sheltersRoot: string, tags: Record<string, string>) => Promise<void>;
    reconcileScan: (shelterId: number, sheltersRoot: string) => Promise<ReconcileScanResult>;
    reconcileApply: (input: ReconcileApplyInput) => Promise<ReconcileApplyResult>;
  };
  history: {
    read: (historyRelPath: string, sheltersRoot: string) => Promise<HistoryReadResult>;
    write: (historyRelPath: string, content: string, sheltersRoot: string) => Promise<void>;
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
  export: {
    build: () => Promise<ExportResult>;
  };
  publish: {
    preflight: (input: PublishPreflightInput) => Promise<PublishDiff | { error: string }>;
    toWeb: () => Promise<PublishResult | { error: string }>;
    cancel: () => Promise<void>;
    testConnection: (input: Pick<PublishPreflightInput, 'rootFolderId' | 'scopes'>) => Promise<ConnectionTestResult | { error: string }>;
    checkCredentials: () => Promise<{ exists: boolean; path: string }>;
    importCredentials: () => Promise<{ ok: boolean; path: string; message?: string } | null>;
    onProgress: (callback: (progress: PublishProgress) => void) => () => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  app: {
    getVersion: () => Promise<string>;
    getRepoRoot: () => Promise<string>;
    browseForDatabasePath: (defaultPath?: string) => Promise<string | null>;
    browseForDirectoryPath: (defaultPath?: string) => Promise<string | null>;
    browseForHistoryFile: (sheltersRoot: string) => Promise<string | null>;
    validatePath: (input: string) => Promise<AppPathValidation>;
    closeWindow: () => Promise<void>;
    minimizeWindow: () => Promise<void>;
    toggleFullscreen: () => Promise<void>;
    isFullscreen: () => Promise<boolean>;
    getFilePath: (file: File) => string;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
