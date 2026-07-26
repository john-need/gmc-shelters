import fs from 'fs';
import path from 'path';
import { app, ipcMain } from 'electron';
import { CHANNELS } from '../../shared/ipc-types';
import { MCP_PORT, MCP_SERVER_NAME } from '../mcp/server';
import { setMcpServerRunning, isMcpServerRunning } from '../mcp/manager';

// Lives at the repo root, mirroring .anthropic_api_key / .ai_model — gitignored, owner-readable only.
const ENABLED_FILENAME = '.mcp_enabled';

function enabledPath(): string {
  return path.join(app.getAppPath(), ENABLED_FILENAME);
}

/** Defaults to enabled — matches the server's pre-existing always-on behavior for anyone who hasn't touched the setting. */
export function readStoredMcpEnabled(): boolean {
  try {
    return fs.readFileSync(enabledPath(), 'utf8').trim() !== '0';
  } catch {
    return true;
  }
}

export function registerMcpSettingsHandlers(): void {
  ipcMain.handle(CHANNELS.MCP_GET_ENABLED, isMcpServerRunning);

  ipcMain.handle(CHANNELS.MCP_SET_ENABLED, async (_e, { enabled }: { enabled: boolean }) => {
    fs.writeFileSync(enabledPath(), (enabled ? '1' : '0') + '\n', { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(enabledPath(), 0o600);
    await setMcpServerRunning(enabled);
  });

  ipcMain.handle(CHANNELS.MCP_GET_CONNECTION_INFO, () => ({
    serverName: MCP_SERVER_NAME,
    url: `http://127.0.0.1:${MCP_PORT}/mcp`,
  }));
}
