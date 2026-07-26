const app = {
  requestSingleInstanceLock: jest.fn(() => true),
  quit: jest.fn(),
  on: jest.fn(),
  getPath: jest.fn(() => '/tmp'),
  getVersion: jest.fn(() => '0.1.0'),
  getAppPath: jest.fn(() => '/tmp/app'),
  isPackaged: false,
  getName: jest.fn(() => 'gmc-shelters'),
};

class BrowserWindowMock {
  static getAllWindows = jest.fn(() => []);
  static fromWebContents = jest.fn();
  static instances: BrowserWindowMock[] = [];

  loadURL = jest.fn();
  loadFile = jest.fn();
  on = jest.fn();
  close = jest.fn();
  minimize = jest.fn();
  restore = jest.fn();
  focus = jest.fn();
  show = jest.fn();
  isMinimized = jest.fn(() => false);
  isFullScreen = jest.fn(() => false);
  setFullScreen = jest.fn();
  webContents = {
    openDevTools: jest.fn(),
    send: jest.fn(),
  };

  constructor(_options?: unknown) {
    BrowserWindowMock.instances.push(this);
    BrowserWindowMock.fromWebContents.mockImplementation((webContents: unknown) =>
      webContents === this.webContents ? this : null,
    );
  }
}

const ipcMain = {
  handle: jest.fn(),
  on: jest.fn(),
};

const ipcRenderer = {
  invoke: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
  removeListener: jest.fn(),
  send: jest.fn(),
};

const contextBridge = {
  exposeInMainWorld: jest.fn(),
};

const Menu = {
  setApplicationMenu: jest.fn(),
  buildFromTemplate: jest.fn(),
  getApplicationMenu: jest.fn(),
};

const shell = {
  openExternal: jest.fn().mockResolvedValue(undefined),
  openPath: jest.fn().mockResolvedValue(''),
};

const dialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
  showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '' }),
};

const protocol = {
  registerSchemesAsPrivileged: jest.fn(),
  handle: jest.fn(),
  registerFileProtocol: jest.fn(),
};

const nativeImage = {
  createThumbnailFromPath: jest.fn().mockResolvedValue({
    toPNG: jest.fn(() => Buffer.from('thumb')),
  }),
};

module.exports = {
  app,
  BrowserWindow: BrowserWindowMock,
  ipcMain,
  ipcRenderer,
  contextBridge,
  Menu,
  shell,
  dialog,
  protocol,
  nativeImage,
};
