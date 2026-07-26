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
  PHOTOS_MOVE: 'photos:move',
  PHOTOS_MOVE_TO_UNIDENTIFIED: 'photos:moveToUnidentified',
  PHOTOS_SET_DEFAULT: 'photos:setDefault',
  PHOTOS_REORDER: 'photos:reorder',
  PHOTOS_UPLOAD: 'photos:upload',
  PHOTOS_READ_METADATA: 'photos:readMetadata',
  PHOTOS_EXPORT: 'photos:export',
  PHOTOS_READ_FILE_METADATA: 'photos:readFileMetadata',
  PHOTOS_WRITE_FILE_METADATA: 'photos:writeFileMetadata',
  PHOTOS_RECONCILE_SCAN: 'photos:reconcileScan',
  PHOTOS_RECONCILE_APPLY: 'photos:reconcileApply',
  PHOTOS_OPEN_FOLDER: 'photos:openFolder',
  HISTORY_READ: 'history:read',
  HISTORY_WRITE: 'history:write',
  SOURCES_GET_BY_SHELTER: 'sources:getByShelter',
  SOURCES_GET_ALL: 'sources:getAll',
  SOURCES_CREATE: 'sources:create',
  SOURCES_UPDATE: 'sources:update',
  SOURCES_DELETE: 'sources:delete',
  SOURCES_CLEAN_QUOTE: 'sources:cleanQuote',
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
  WIKI_SEARCH: 'wiki:search',
  WIKI_OPEN_PDF: 'wiki:openPdf',
  WIKI_INDEX_REPORT: 'wiki:indexReport',
  WIKI_GET_HEADER: 'wiki:getHeader',
  WIKI_SAVE_HEADER: 'wiki:saveHeader',
  WIKI_FIND_RESOURCE: 'wiki:findResource',
  AI_GET_API_KEY: 'ai:getApiKey',
  AI_SET_API_KEY: 'ai:setApiKey',
  AI_GET_MODEL: 'ai:getModel',
  AI_SET_MODEL: 'ai:setModel',
  MCP_GET_ENABLED: 'mcp:getEnabled',
  MCP_SET_ENABLED: 'mcp:setEnabled',
  MCP_GET_CONNECTION_INFO: 'mcp:getConnectionInfo',
  COLLECTIONS_STATUS: 'collections:status',
  COLLECTIONS_RUN: 'collections:run',
  COLLECTIONS_CANCEL: 'collections:cancel',
  COLLECTIONS_PROGRESS: 'collections:progress',
  COLLECTIONS_SET_DEFAULTS: 'collections:setDefaults',
  COLLECTIONS_ADD_FILES: 'collections:addFiles',
  COLLECTIONS_DELETE_FILE: 'collections:deleteFile',
  COLLECTIONS_DELETE: 'collections:delete',
  RESEARCH_WEB_SEARCH: 'research:webSearch',
  HISTORY_GENERATE: 'history:generate',
  HISTORY_GENERATE_PROGRESS: 'history:generateProgress',
  HISTORY_GENERATE_RESPOND: 'history:generateRespond',
  SHELTER_GENERATE_DESCRIPTION: 'shelter:generateDescription',
} as const;

export interface CollectionFileStatus {
  name: string;
  status: 'missing' | 'raw' | 'clean';
}

export interface CollectionStatus {
  name: string;
  total: number;
  added: number;
  cleaned: number;
  files: CollectionFileStatus[];
  citationType: string | null;
  defaults: Record<string, string>;
}

export interface CollectionDefaultsRequest {
  name: string;
  oldCitationType: string;
  citationType: string;
  oldDefaults: Record<string, string>;
  defaults: Record<string, string>;
}

export interface CollectionDefaultsResult {
  ok: boolean;
  updated: number;
  error?: string;
}

export interface CollectionsAddFilesRequest {
  collection: string;
  sourcePaths: string[];
}

export interface CollectionsAddFilesResult {
  added: string[];
  skipped: string[];
}

export interface CollectionsDeleteFileRequest {
  collection: string;
  file: string;
}

export interface CollectionsDeleteRequest {
  name: string;
}

export type CollectionsRunMode = 'add' | 'clean';

export interface CollectionsRunRequest {
  mode: CollectionsRunMode;
  files: string[]; // repo-relative PDF paths
  force: boolean;
}

export interface CollectionsProgress {
  kind: 'proc' | 'ok' | 'cache' | 'fail' | 'index';
  file?: string;
}

export interface CollectionsRunResult {
  ok: boolean;
  converted: number;
  cached: number;
  failed: number;
  canceled?: boolean;
  error?: string;
}

export interface WikiIndexReport {
  indexed: number;
  skipped: number;
  builtAt: string;
}

export interface WikiHeaderPreserved {
  type: string;
  resource: string;
  timestamp: string;
  pages: string;
}

export interface WikiHeaderPayload {
  citationType: string;
  fields: Record<string, string>;
  preserved: WikiHeaderPreserved;
}

export type WikiSaveHeaderResult =
  | { ok: true }
  | { ok: false; errors: string[] }
  | { ok: false; error: string };

export interface WikiSearchResult {
  path: string;
  okf_type: string;
  title: string;
  publisher: string;
  volume: string;
  edition: string;
  printed_volume: string;
  printed_issue: string;
  author: string;
  publication_date: string;
  resource: string;
  citation_type: string;
  kind: 'page' | 'illustration';
  page: number;
  image: string;
  snippet: string;
}

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
  end_year: number | null;
  change_type: ChangeType;
  notes: string;
};

export type MapMarkerUpdateInput = {
  latitude: number;
  longitude: number;
  name: string;
  start_year: number;
  end_year: number | null;
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
  include_in_history: boolean;
  type: SourceType;
  author: string;
  title: string;
  container_title: string;
  container_author: string;
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

/**
 * Bibliographic-only view of a Source (no shelter association fields).
 * Used by the "browse existing sources" picker to reuse data across shelters.
 */
export type SourceRef = Pick<Source,
  | 'id' | 'type' | 'author' | 'title' | 'container_title' | 'container_author' | 'editor' | 'edition'
  | 'volume' | 'issue' | 'pages' | 'publisher' | 'place' | 'year' | 'date'
  | 'url' | 'access_date' | 'archive' | 'archive_location'>;

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
  contrast?: number;
  brightness?: number;
}

export type PhotoUpdateInput = Omit<Photo, 'id' | 'shelter_id' | 'created' | 'file_name' | 'file_path'> & PhotoTransformInput;

export interface UntrackedFile {
  fileName: string;
}

export interface PhotoReorderInput {
  shelterId: number;
  photoIds: number[];
}

export interface OrphanedRecord {
  id: number;
  fileName: string;
  title: string;
}

export interface ReconcileScanResult {
  untrackedFiles: UntrackedFile[];
  orphanedRecords: OrphanedRecord[];
  missingThumbnailCount: number;
  orphanedThumbnails: string[];
}

export interface ReconcileApplyInput {
  shelterId: number;
  sheltersRoot: string;
  filesToAdd: string[];
  recordIdsToDelete: number[];
  purgeOrphanedThumbnails?: boolean;
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
  thumbnailsGenerated: number;
  thumbnailsPurged: number;
}

export interface PhotoMoveInput {
  photoId: number;
  targetShelterId: number;
  sheltersRoot: string;
}

export interface PhotoMoveToUnidentifiedInput {
  photoId: number;
  sheltersRoot: string;
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
  historyToUploadCount: number;
  historyUnchangedCount: number;
  toUpload: PublishDiffItem[];
  toUpdate: PublishDiffItem[];
  toDelete: PublishDiffItem[];
}

export interface PublishToWebInput {
  _confirm: true;
}

export interface PublishProgress {
  stage: 'building' | 'fetching' | 'deleting' | 'uploading' | 'manifest';
  /** Count of upload operations completed so far. Uploads only — excludes unchanged photos and deletes. */
  current: number;
  /** Total files to upload = new photos + updated photos + changed history files + 1 manifest. */
  total: number;
  /** What kind of file the current upload is. Absent for non-upload stages (building/deleting). */
  itemKind?: 'photo' | 'history' | 'manifest';
  /** Whether the current upload creates a new Drive file or updates an existing one. */
  action?: 'create' | 'update';
  /** Basename or relative path of the current file. */
  fileName?: string;
  /** Number of files being removed from Drive, for the 'deleting' stated message. */
  deleteCount?: number;
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

// The two Claude models already wired into scripts/lib/llm_client.py (DEFAULT_MODEL/ESCALATION_MODEL).
// Keep labels in sync with that file if either model changes.
export type AiModelTier = 'default' | 'escalation';

export const AI_MODEL_OPTIONS: { id: AiModelTier; label: string }[] = [
  { id: 'default', label: 'Fast (default)' },
  { id: 'escalation', label: 'Capable (escalation)' },
];

export interface McpConnectionInfo {
  serverName: string;
  url: string;
}

export interface WebResearchResult {
  title: string;
  url: string;
  snippet: string;
  /** Absolute path to a locally cached thumbnail, or null if no photo was found/cached. Never the original external URL. */
  localImagePath: string | null;
}

export type WebResearchError = 'no_api_key' | 'timeout' | 'network';

export type WebSearchResponse =
  | { ok: true; results: WebResearchResult[] }
  | { ok: false; error: WebResearchError };

export interface GenerateHistoryShelterFacts {
  name: string;
  architecture: string;
  built_by: string;
  description: string;
  notes: string;
  start_year: number;
  end_year: number | null;
  is_extant: boolean;
  is_gmc: boolean;
  category: string;
}

export interface GenerateHistoryRequest {
  shelter: GenerateHistoryShelterFacts;
  /** Already filtered to include_in_history === true by the caller. */
  citations: Source[];
  /** Already stripped of the mechanical ### Sources section by the caller. */
  currentHistory: string;
}

export type GenerateHistoryError = 'no_api_key' | 'network' | 'timeout' | 'max_turns';

export type GenerateHistoryResponse =
  | { ok: true; narrative: string }
  | { ok: false; error: GenerateHistoryError };

export interface GenerateDescriptionRequest {
  shelter: GenerateHistoryShelterFacts;
  /** The shelter's history markdown file content, if any — '' when missing. */
  historyContent: string;
}

export type GenerateDescriptionError = 'no_api_key' | 'network' | 'timeout';

export type GenerateDescriptionResponse =
  | { ok: true; description: string }
  | { ok: false; error: GenerateDescriptionError };

/** Server-executed tools run inside Anthropic's own infrastructure; client tools run locally and can be gated by permission. */
export type GenerateHistoryToolName = 'web_search' | 'web_fetch' | 'search_collections' | 'download_document';

/** Live progress emitted while a Generate History agent run is in flight (see history.onGenerateProgress). */
export type GenerateHistoryEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; tool: GenerateHistoryToolName; input: unknown }
  | { type: 'tool_result'; tool: GenerateHistoryToolName; ok: boolean; summary: string }
  | { type: 'permission_request'; requestId: string; tool: 'search_collections' | 'download_document'; input: unknown };

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
    update: (shelter: Shelter, sheltersRoot: string) => Promise<Shelter>;
    delete: (id: number, slug: string, sheltersRoot: string) => Promise<void>;
    setHistory: (id: number, history: string) => Promise<void>;
    generateDescription: (request: GenerateDescriptionRequest) => Promise<GenerateDescriptionResponse>;
  };
  photos: {
    getByShelter: (shelterId: number) => Promise<Photo[]>;
    update: (input: PhotoUpdateInput & { id: number; shelter_id: number; sheltersRoot: string }) => Promise<Photo>;
    delete: (id: number, sheltersRoot: string) => Promise<void>;
    move: (photoId: number, targetShelterId: number, sheltersRoot: string) => Promise<Photo>;
    moveToUnidentified: (photoId: number, sheltersRoot: string) => Promise<void>;
    setDefault: (shelterId: number, photoId: number) => Promise<void>;
    reorder: (input: PhotoReorderInput) => Promise<void>;
    upload: (input: PhotoUploadInput) => Promise<Photo>;
    readMetadata: (slug: string, fileName: string, sheltersRoot: string) => Promise<Partial<Photo>>;
    export: (slug: string, fileName: string, title: string, sheltersRoot: string) => Promise<string | null>;
    readFileMetadata: (slug: string, fileName: string, sheltersRoot: string) => Promise<FileMetadataTag[]>;
    writeFileMetadata: (slug: string, fileName: string, sheltersRoot: string, tags: Record<string, string>) => Promise<void>;
    reconcileScan: (shelterId: number, sheltersRoot: string) => Promise<ReconcileScanResult>;
    reconcileApply: (input: ReconcileApplyInput) => Promise<ReconcileApplyResult>;
    openFolder: (slug: string, sheltersRoot: string) => Promise<{ ok: boolean }>;
  };
  history: {
    read: (historyRelPath: string, sheltersRoot: string) => Promise<HistoryReadResult>;
    write: (historyRelPath: string, content: string, sheltersRoot: string) => Promise<void>;
    generate: (request: GenerateHistoryRequest) => Promise<GenerateHistoryResponse>;
    onGenerateProgress: (callback: (event: GenerateHistoryEvent) => void) => () => void;
    respondToPermission: (requestId: string, approved: boolean) => Promise<void>;
  };
  sources: {
    getByShelter: (shelterId: number) => Promise<Source[]>;
    getAll: () => Promise<SourceRef[]>;
    create: (input: SourceInput) => Promise<Source>;
    update: (source: Source) => Promise<Source>;
    delete: (id: number) => Promise<void>;
    cleanUpQuote: (args: { id: number; shelterId: number }) => Promise<Source>;
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
  wiki: {
    search: (query: string, collections?: string[]) => Promise<WikiSearchResult[]>;
    openPdf: (resource: string) => Promise<{ ok: boolean }>;
    indexReport: () => Promise<WikiIndexReport | null>;
    getHeader: (resource: string) => Promise<WikiHeaderPayload | null>;
    saveHeader: (
      resource: string,
      payload: { citationType: string; fields: Record<string, string> },
    ) => Promise<WikiSaveHeaderResult>;
    findResource: (criteria: import('./wiki-resource-match').WikiResourceCriteria) => Promise<string | null>;
  };
  ai: {
    getApiKey: () => Promise<string>;
    setApiKey: (key: string) => Promise<void>;
    getModel: () => Promise<AiModelTier>;
    setModel: (tier: AiModelTier) => Promise<void>;
  };
  mcp: {
    getEnabled: () => Promise<boolean>;
    setEnabled: (enabled: boolean) => Promise<void>;
    getConnectionInfo: () => Promise<McpConnectionInfo>;
  };
  collections: {
    status: () => Promise<CollectionStatus[]>;
    run: (request: CollectionsRunRequest) => Promise<CollectionsRunResult>;
    cancel: () => Promise<void>;
    onProgress: (callback: (progress: CollectionsProgress) => void) => () => void;
    setDefaults: (request: CollectionDefaultsRequest) => Promise<CollectionDefaultsResult>;
    addFiles: (request: CollectionsAddFilesRequest) => Promise<CollectionsAddFilesResult>;
    deleteFile: (request: CollectionsDeleteFileRequest) => Promise<{ ok: boolean }>;
    delete: (request: CollectionsDeleteRequest) => Promise<{ ok: boolean }>;
  };
  research: {
    webSearch: (query: string, context?: string) => Promise<WebSearchResponse>;
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
