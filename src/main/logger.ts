import { app } from 'electron';
import log from 'electron-log';

log.transports.file.level = 'info';
log.transports.console.level = app.isPackaged ? false : 'debug';

export { log };
