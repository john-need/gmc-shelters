import type { Server } from 'http';
import { startMcpServer, stopMcpServer } from './server';

let server: Server | null = null;

export async function setMcpServerRunning(running: boolean): Promise<void> {
  if (running && !server) {
    server = startMcpServer();
  } else if (!running && server) {
    const current = server;
    server = null;
    await stopMcpServer(current);
  }
}

export function isMcpServerRunning(): boolean {
  return server !== null;
}
