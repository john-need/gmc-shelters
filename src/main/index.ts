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

  app.on('ready', () => {
    const MIME: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.tiff': 'image/tiff',
      '.gif': 'image/gif',
    };
    protocol.handle('shelter', (request) => {
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

      log.info(`[shelter] url=${request.url} → path=${filePath}`);
      try {
        const data = fs.readFileSync(filePath);
        const contentType = MIME[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
        return new Response(data, { headers: { 'Content-Type': contentType } });
      } catch (err) {
        log.error(`[shelter] 404: ${filePath}`, err);
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
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    }
  });
}
