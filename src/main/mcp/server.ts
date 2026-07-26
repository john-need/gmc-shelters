import http from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { searchWiki } from '../ipc/wiki-search';
import {
  downloadDocument, listShelters, getShelter, listSources, listPhotos, downloadHistory, downloadPhoto,
} from './tools';
import { log } from '../logger';

// ponytail: stateless HTTP, no session map — every request is a self-contained
// JSON-RPC exchange against a freshly built server+transport pair.
export const MCP_PORT = 5972;
export const MCP_SERVER_NAME = 'gmc-shelters';

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: MCP_SERVER_NAME, version: '1.0.0' });

  server.registerTool(
    'search_collections',
    {
      description: 'Full-text search over the GMC shelters wiki collections (newsletters, guidebooks, reports).',
      inputSchema: {
        query: z.string().describe('Search terms; wrap a phrase in double quotes for an exact match'),
        collections: z.array(z.string()).optional().describe('Limit to these collection names; omit to search all'),
      },
    },
    async ({ query, collections }) => {
      const results = searchWiki(query, collections);
      return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
    },
  );

  server.registerTool(
    'download_document',
    {
      description: 'Download the original source document (PDF) for a search result, by its `resource` path.',
      inputSchema: {
        resource: z.string().describe('The `resource` field from a search_collections result, e.g. "collections/long-trail-news/1922_12_Dec.pdf"'),
      },
    },
    async ({ resource }) => {
      const result = downloadDocument(resource);
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: result.error ?? 'Download failed' }], isError: true };
      }
      return {
        content: [{
          type: 'resource',
          resource: {
            uri: `file:///${resource}`,
            mimeType: result.mimeType ?? 'application/octet-stream',
            blob: result.data.toString('base64'),
          },
        }],
      };
    },
  );

  server.registerTool(
    'list_shelters',
    {
      description: 'List every shelter in the database (id, name, slug, years, architecture, category, built-by, extant status).',
      inputSchema: {},
    },
    async () => ({ content: [{ type: 'text', text: JSON.stringify(listShelters(), null, 2) }] }),
  );

  server.registerTool(
    'get_shelter',
    {
      description: 'Get full details for a single shelter, by id (from list_shelters).',
      inputSchema: {
        shelterId: z.number().describe('The shelter id, from list_shelters'),
      },
    },
    async ({ shelterId }) => {
      const shelter = getShelter(shelterId);
      if (!shelter) {
        return { content: [{ type: 'text', text: `Shelter ${shelterId} not found` }], isError: true };
      }
      return { content: [{ type: 'text', text: JSON.stringify(shelter, null, 2) }] };
    },
  );

  server.registerTool(
    'list_sources',
    {
      description: 'List the bibliographic sources cited for a shelter.',
      inputSchema: {
        shelterId: z.number().describe('The shelter id, from list_shelters'),
      },
    },
    async ({ shelterId }) => ({ content: [{ type: 'text', text: JSON.stringify(listSources(shelterId), null, 2) }] }),
  );

  server.registerTool(
    'list_photos',
    {
      description: 'List photo records for a shelter (metadata only — use download_photo for the image bytes).',
      inputSchema: {
        shelterId: z.number().describe('The shelter id, from list_shelters'),
      },
    },
    async ({ shelterId }) => ({ content: [{ type: 'text', text: JSON.stringify(listPhotos(shelterId), null, 2) }] }),
  );

  server.registerTool(
    'download_history',
    {
      description: "Download a shelter's history markdown as plain text.",
      inputSchema: {
        shelterId: z.number().describe('The shelter id, from list_shelters'),
      },
    },
    async ({ shelterId }) => {
      const result = await downloadHistory(shelterId);
      if (!result.ok) {
        return { content: [{ type: 'text', text: result.error ?? 'Download failed' }], isError: true };
      }
      return { content: [{ type: 'text', text: result.content ?? '' }] };
    },
  );

  server.registerTool(
    'download_photo',
    {
      description: 'Download the original image file for a shelter photo, by shelter id and photo id (from list_photos).',
      inputSchema: {
        shelterId: z.number().describe('The shelter id, from list_shelters'),
        photoId: z.number().describe('The photo id, from list_photos'),
      },
    },
    async ({ shelterId, photoId }) => {
      const result = downloadPhoto(shelterId, photoId);
      if (!result.ok || !result.data) {
        return { content: [{ type: 'text', text: result.error ?? 'Download failed' }], isError: true };
      }
      return {
        content: [{
          type: 'resource',
          resource: {
            uri: `file:///shelters/${shelterId}/photos/${photoId}`,
            mimeType: result.mimeType ?? 'application/octet-stream',
            blob: result.data.toString('base64'),
          },
        }],
      };
    },
  );

  return server;
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) { resolve(undefined); return; }
      try { resolve(JSON.parse(raw)); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

export function startMcpServer(port: number = MCP_PORT): http.Server {
  // Stateless mode: no session ID is tracked, and an McpServer can only ever
  // connect to one transport — so each request gets its own fresh server +
  // transport pair, per the SDK's documented stateless-HTTP pattern.
  const httpServer = http.createServer((req, res) => {
    void (async () => {
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await buildMcpServer().connect(transport);
      await transport.handleRequest(req, res, body);
    })().catch((err) => {
      log.error('[mcp] request failed', err);
      if (!res.headersSent) res.writeHead(500).end();
    });
  });

  // An unhandled 'error' event on a Node http.Server throws and takes the whole
  // Electron main process down with it -- log instead, so e.g. a leftover
  // process still holding this port doesn't silently kill app startup.
  httpServer.on('error', (err) => {
    log.error(`[mcp] server error on port ${port}`, err);
  });

  // 127.0.0.1 only — this exposes read access to every collection document,
  // so it must never be reachable from the network, only from this machine.
  httpServer.listen(port, '127.0.0.1', () => {
    log.info(`[mcp] ${MCP_SERVER_NAME} server listening on http://127.0.0.1:${port}/mcp`);
  });

  return httpServer;
}

export function stopMcpServer(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
