import fs from 'fs';
import http from 'http';
import path from 'path';
import { google } from 'googleapis';
import { shell } from 'electron';
import type { OAuth2Client } from 'google-auth-library';
import type { ConnectionTestResult } from '../../shared/ipc-types';

interface CredentialsFile {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface TokenData {
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
}

export class GDriveClient {
  private credentialsPath: string;
  private tokenPath: string;
  private scopes: string[];

  constructor(credentialsPath: string, tokenPath: string, scopes: string[]) {
    this.credentialsPath = credentialsPath;
    this.tokenPath = tokenPath;
    this.scopes = scopes;
  }

  async authenticate(): Promise<OAuth2Client> {
    const creds = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8')) as CredentialsFile;
    const { client_id, client_secret } = creds.installed;

    // T011: create OAuth2Client with a loopback port placeholder; real port resolved during consent flow
    const oauth2Client = new (google.auth.OAuth2 as unknown as new (id: string, secret: string, redirect: string) => OAuth2Client)(
      client_id,
      client_secret,
      'http://localhost',
    );

    if (fs.existsSync(this.tokenPath)) {
      const token = JSON.parse(fs.readFileSync(this.tokenPath, 'utf8')) as TokenData;
      oauth2Client.setCredentials(token);

      // T010: expired token → refresh without browser
      if (token.expiry_date && token.expiry_date < Date.now()) {
        const { credentials } = await (oauth2Client as unknown as { refreshAccessToken: () => Promise<{ credentials: TokenData }> }).refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        fs.writeFileSync(this.tokenPath, JSON.stringify(credentials));
      }

      return oauth2Client;
    }

    // T010: no token file → browser consent via loopback server
    return new Promise<OAuth2Client>((resolve, reject) => {
      const server = http.createServer(async (req, res) => {
        const url = new URL(req.url ?? '/', `http://localhost`);
        const code = url.searchParams.get('code');
        res.end('Authentication complete. You may close this window.');

        // Capture port before closing — server.address() returns null after close
        const port = (server.address() as { port: number }).port;
        server.close();

        if (!code) {
          reject(new Error('No auth code received'));
          return;
        }

        const localOAuth2 = new (google.auth.OAuth2 as unknown as new (id: string, secret: string, redirect: string) => OAuth2Client)(
          client_id,
          client_secret,
          `http://localhost:${port}`,
        );

        try {
          const { tokens } = await (localOAuth2 as unknown as { getToken: (code: string) => Promise<{ tokens: TokenData }> }).getToken(code);
          localOAuth2.setCredentials(tokens);
          fs.mkdirSync(path.dirname(this.tokenPath), { recursive: true });
          fs.writeFileSync(this.tokenPath, JSON.stringify(tokens));
          resolve(localOAuth2);
        } catch (err) {
          reject(err);
        }
      });

      server.listen(0, () => {
        const port = (server.address() as { port: number }).port;
        const redirectOAuth2 = new (google.auth.OAuth2 as unknown as new (id: string, secret: string, redirect: string) => OAuth2Client)(
          client_id,
          client_secret,
          `http://localhost:${port}`,
        );
        const authUrl = (redirectOAuth2 as unknown as { generateAuthUrl: (opts: Record<string, unknown>) => string }).generateAuthUrl({
          access_type: 'offline',
          scope: this.scopes,
        });
        shell.openExternal(authUrl);
      });
    });
  }

  private async _buildDriveService(auth: OAuth2Client) {
    return google.drive({ version: 'v3', auth: auth as unknown as Parameters<typeof google.drive>[0]['auth'] });
  }

  async listFolder(folderId: string): Promise<Map<string, string>> {
    const auth = await this.authenticate();
    const drive = await this._buildDriveService(auth);
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id,name)',
      pageSize: 1000,
    });
    const map = new Map<string, string>();
    for (const f of res.data.files ?? []) {
      if (f.name && f.id) map.set(f.name, f.id);
    }
    return map;
  }

  async downloadJson(fileId: string): Promise<unknown> {
    const auth = await this.authenticate();
    const drive = await this._buildDriveService(auth);
    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );
    return JSON.parse(Buffer.from(res.data as ArrayBuffer).toString());
  }

  async uploadFile(localPath: string, name: string, folderId: string, mimeType: string): Promise<string> {
    const auth = await this.authenticate();
    const drive = await this._buildDriveService(auth);
    const res = await drive.files.create({
      requestBody: { name, mimeType, parents: [folderId] },
      media: { mimeType, body: fs.createReadStream(localPath) },
      fields: 'id',
    });
    return res.data.id!;
  }

  async updateFile(fileId: string, localPath: string, mimeType: string): Promise<void> {
    const auth = await this.authenticate();
    const drive = await this._buildDriveService(auth);
    await drive.files.update({
      fileId,
      requestBody: {},
      media: { mimeType, body: fs.createReadStream(localPath) },
    });
  }

  async createFolder(name: string, parentId: string): Promise<string> {
    const auth = await this.authenticate();
    const drive = await this._buildDriveService(auth);
    const res = await drive.files.create({
      requestBody: {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
      },
      fields: 'id',
    });
    return res.data.id!;
  }

  async deleteFile(fileId: string): Promise<void> {
    const auth = await this.authenticate();
    const drive = await this._buildDriveService(auth);
    await drive.files.delete({ fileId });
  }

  async testConnection(rootFolderId: string): Promise<ConnectionTestResult> {
    try {
      const auth = await this.authenticate();
      const drive = await this._buildDriveService(auth);
      const res = await drive.files.get({ fileId: rootFolderId, fields: 'id,name' });
      return { ok: true, message: `Connected — folder: ${res.data.name ?? rootFolderId}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, message: `Drive root folder not accessible: ${msg}` };
    }
  }
}
