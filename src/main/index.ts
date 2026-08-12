import { app, BrowserWindow, Menu, protocol } from 'electron';
import fs from 'fs';
import path from 'path';
import { log } from './logger';
import { registerShelterHandlers } from './ipc/shelters';
import { registerPhotoHandlers } from './ipc/photos';
import { registerSourceHandlers } from './ipc/sources';
import { registerHistoryHandlers } from './ipc/history';
import { registerShellHandlers } from './ipc/shell';
import { registerMapMarkerHandlers } from './ipc/map-markers';
import { registerArchitectureHandlers } from './ipc/architectures';
import { registerCategoryHandlers } from './ipc/categories';
import { registerExportHandlers } from './ipc/export';
import { registerWikiSearchHandlers } from './ipc/wiki-search';
import { registerAiSettingsHandlers } from './ipc/ai-settings';
import { registerCollectionsHandlers } from './ipc/collections';
import { registerResearchWebSearchHandlers } from './ipc/research-web-search';
import { registerGenerateHistoryHandlers } from './ipc/generate-history';
import { registerGenerateDescriptionHandlers } from './ipc/generate-description';
import { registerMcpSettingsHandlers, readStoredMcpEnabled } from './ipc/mcp-settings';
import { getThumbnailPath, type ThumbnailSizeClass } from './fs/thumbnails';
import { setMcpServerRunning, isMcpServerRunning } from './mcp/manager';

protocol.registerSchemesAsPrivileged([
  { scheme: 'shelter', privileges: { secure: true, standard: true, supportFetchAPI: true } },
]);

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    {
      label: app.getName(),
      submenu: [
        { role: 'about', label: `About ${app.getName()}` },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools', accelerator: 'Alt+Command+I' },
      ],
    },
  ]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: -999, y: -999 }, // hidden; custom titlebar used
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(buildMenu());
  log.info('Window created');
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('ready', async () => {
    const MIME: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.gif': 'image/gif',
    };
    protocol.handle('shelter', async (request) => {
      const url = new URL(request.url);
      let filePath = decodeURIComponent(url.pathname);

      // If there's a host (e.g. shelter://C:/...), prepend it to pathname
      if (url.host && url.host !== 'localhost') {
        filePath = url.host + filePath;
      }

      // On Windows, pathname often starts with /C:/
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      // On macOS/Linux, if it's missing the leading slash
      if (process.platform !== 'win32' && !filePath.startsWith('/')) {
        filePath = '/' + filePath;
      }

      const size = url.searchParams.get('size') as ThumbnailSizeClass | null;
      let servedPath = filePath;
      if (size === 'grid' || size === 'preview') {
        const thumbPath = await getThumbnailPath(filePath, size);
        if (thumbPath) servedPath = thumbPath;
      }

      log.info(`[shelter] url=${request.url} → path=${servedPath}`);
      try {
        const data = fs.readFileSync(servedPath);
        const contentType = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        return new Response(data, { headers: { 'Content-Type': contentType } });
      } catch (err) {
        log.error(`[shelter] 404: ${servedPath}`, err);
        return new Response('Not found', { status: 404 });
      }
    });

    registerShelterHandlers();
    registerPhotoHandlers();
    registerSourceHandlers();
    registerHistoryHandlers();
    registerShellHandlers();
    registerMapMarkerHandlers();
    registerArchitectureHandlers();
    registerCategoryHandlers();
    registerExportHandlers();
    registerWikiSearchHandlers();
    registerAiSettingsHandlers();
    registerResearchWebSearchHandlers();
    registerGenerateHistoryHandlers();
    registerGenerateDescriptionHandlers();
    registerCollectionsHandlers();
    registerMcpSettingsHandlers();
    await setMcpServerRunning(readStoredMcpEnabled());
    createWindow();
  });

  app.on('before-quit', async (event) => {
    if (!isMcpServerRunning()) return;
    event.preventDefault();
    await setMcpServerRunning(false);
    app.quit();
  });

  app.on('window-all-closed', () => {
    // In dev, always quit: a windowless instance left running keeps the
    // single-instance lock, so the next `npm run start` silently quits and the
    // zombie opens a window against its long-dead Vite dev-server URL — blank.
    if (process.platform !== 'darwin' || !app.isPackaged) app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}
