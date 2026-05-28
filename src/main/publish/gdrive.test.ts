import fs from 'fs';
import http from 'http';
import { EventEmitter } from 'events';

jest.mock('googleapis');
jest.mock('electron', () => ({
  shell: { openExternal: jest.fn().mockResolvedValue(undefined) },
  app: { getPath: jest.fn().mockReturnValue('/tmp') },
}));
jest.mock('fs');

import { google } from 'googleapis';
import { shell } from 'electron';
import { GDriveClient } from './gdrive';

const mockGoogle = google as jest.Mocked<typeof google>;

// ----- helpers -----

function makeOAuth2Client(overrides: Record<string, unknown> = {}) {
  return {
    generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/auth?code=X'),
    getToken: jest.fn().mockResolvedValue({ tokens: { access_token: 'tok', refresh_token: 'rtok', expiry_date: Date.now() + 3600_000 } }),
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn().mockResolvedValue({ credentials: { access_token: 'newTok', expiry_date: Date.now() + 3600_000 } }),
    credentials: {},
    ...overrides,
  };
}

function makeDriveService() {
  return {
    files: {
      list: jest.fn().mockResolvedValue({ data: { files: [] } }),
      get: jest.fn().mockResolvedValue({ data: Buffer.from(JSON.stringify({ created: 'now', shelters: [] })) }),
      create: jest.fn().mockResolvedValue({ data: { id: 'new-drive-id' } }),
      update: jest.fn().mockResolvedValue({ data: { id: 'existing-drive-id' } }),
    },
  };
}

// ----- describe blocks -----

describe('GDriveClient', () => {
  const credPath = '/tmp/credentials.json';
  const tokenPath = '/tmp/gmc-gdrive-token.json';
  const scopes = ['https://www.googleapis.com/auth/drive'];

  let mockOAuth2Ctor: jest.Mock;
  let mockOAuth2Client: ReturnType<typeof makeOAuth2Client>;
  let mockDrive: ReturnType<typeof makeDriveService>;
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOAuth2Client = makeOAuth2Client();
    mockOAuth2Ctor = jest.fn().mockReturnValue(mockOAuth2Client);
    (mockGoogle as unknown as Record<string, unknown>).auth = { OAuth2: mockOAuth2Ctor };

    mockDrive = makeDriveService();
    (mockGoogle.drive as jest.Mock).mockReturnValue(mockDrive);

    // Default: credentials file exists
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(
      JSON.stringify({ installed: { client_id: 'cid', client_secret: 'csecret', redirect_uris: ['urn:ietf:params:oauth:2.0:oob'] } }),
    );
  });

  // ---- T009: core methods ----

  describe('authenticate()', () => {
    it('returns an OAuth2Client when a valid cached token exists', async () => {
      // Token file exists and is not expired
      mockFs.readFileSync
        .mockReturnValueOnce(
          JSON.stringify({ installed: { client_id: 'cid', client_secret: 'csecret', redirect_uris: [] } }),
        )
        .mockReturnValueOnce(
          JSON.stringify({ access_token: 'tok', refresh_token: 'rtok', expiry_date: Date.now() + 3600_000 }),
        );

      const client = new GDriveClient(credPath, tokenPath, scopes);
      const auth = await client.authenticate();
      expect(auth).toBeDefined();
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalled();
    });

    it('does not open browser when cached token exists', async () => {
      mockFs.readFileSync
        .mockReturnValueOnce(
          JSON.stringify({ installed: { client_id: 'cid', client_secret: 'csecret', redirect_uris: [] } }),
        )
        .mockReturnValueOnce(
          JSON.stringify({ access_token: 'tok', refresh_token: 'rtok', expiry_date: Date.now() + 3600_000 }),
        );

      const client = new GDriveClient(credPath, tokenPath, scopes);
      await client.authenticate();
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });

  describe('listFolder()', () => {
    it('returns a Map<filename, driveFileId> for files in the folder', async () => {
      mockDrive.files.list.mockResolvedValue({
        data: {
          files: [
            { id: 'id1', name: 'photo1.jpg' },
            { id: 'id2', name: 'photo2.jpg' },
          ],
        },
      });

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      const result = await client.listFolder('folder-id');

      expect(result).toBeInstanceOf(Map);
      expect(result.get('photo1.jpg')).toBe('id1');
      expect(result.get('photo2.jpg')).toBe('id2');
    });

    it('includes trashed=false filter in query', async () => {
      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      await client.listFolder('folder-id');

      expect(mockDrive.files.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: expect.stringContaining('trashed=false') }),
      );
    });
  });

  describe('downloadJson()', () => {
    it('returns a parsed object from the Drive file', async () => {
      const payload = { created: '2025-01-01', shelters: [] };
      mockDrive.files.get.mockResolvedValue({ data: Buffer.from(JSON.stringify(payload)) });

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      const result = await client.downloadJson('file-id');

      expect(result).toEqual(payload);
    });
  });

  describe('uploadFile()', () => {
    it('calls drive.files.create and returns the new Drive file ID', async () => {
      mockDrive.files.create.mockResolvedValue({ data: { id: 'new-file-id' } });
      mockFs.createReadStream = jest.fn().mockReturnValue({} as ReturnType<typeof fs.createReadStream>);

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      const id = await client.uploadFile('/local/photo.jpg', 'photo.jpg', 'parent-id', 'image/jpeg');

      expect(mockDrive.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({ name: 'photo.jpg', parents: ['parent-id'] }),
        }),
      );
      expect(id).toBe('new-file-id');
    });
  });

  describe('updateFile()', () => {
    it('calls drive.files.update with the existing fileId', async () => {
      mockFs.createReadStream = jest.fn().mockReturnValue({} as ReturnType<typeof fs.createReadStream>);

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      await client.updateFile('existing-id', '/local/photo.jpg', 'image/jpeg');

      expect(mockDrive.files.update).toHaveBeenCalledWith(
        expect.objectContaining({ fileId: 'existing-id' }),
      );
    });
  });

  describe('createFolder()', () => {
    it('calls drive.files.create with folder mimeType and returns new folder ID', async () => {
      mockDrive.files.create.mockResolvedValue({ data: { id: 'new-folder-id' } });

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      const id = await client.createFolder('my-shelter', 'root-id');

      expect(mockDrive.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            mimeType: 'application/vnd.google-apps.folder',
            name: 'my-shelter',
            parents: ['root-id'],
          }),
        }),
      );
      expect(id).toBe('new-folder-id');
    });
  });

  describe('testConnection()', () => {
    it('returns ok: true with folder name on success', async () => {
      mockDrive.files.get.mockResolvedValue({ data: { id: 'folder-id', name: 'My Shelters' } });

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      const result = await client.testConnection('folder-id');

      expect(result.ok).toBe(true);
      expect(result.message).toContain('My Shelters');
    });

    it('returns ok: false with error message on failure', async () => {
      mockDrive.files.get.mockRejectedValue(new Error('Access denied'));

      const client = new GDriveClient(credPath, tokenPath, scopes);
      jest.spyOn(client, 'authenticate').mockResolvedValue(mockOAuth2Client as unknown as import('google-auth-library').OAuth2Client);
      const result = await client.testConnection('bad-folder-id');

      expect(result.ok).toBe(false);
      expect(result.message).toBeTruthy();
    });
  });

  // ---- T010: token load/save flow ----

  describe('token flow', () => {
    it('does not trigger browser flow when cached token file exists', async () => {
      mockFs.readFileSync
        .mockReturnValueOnce(
          JSON.stringify({ installed: { client_id: 'cid', client_secret: 'csecret', redirect_uris: [] } }),
        )
        .mockReturnValueOnce(
          JSON.stringify({ access_token: 'tok', refresh_token: 'rtok', expiry_date: Date.now() + 3600_000 }),
        );

      const client = new GDriveClient(credPath, tokenPath, scopes);
      await client.authenticate();
      expect(shell.openExternal).not.toHaveBeenCalled();
    });

    it('calls shell.openExternal with auth URL when no token file exists', async () => {
      // credentials file exists; token file does not
      mockFs.existsSync.mockImplementation((p: fs.PathLike) =>
        String(p) === credPath ? true : false,
      );
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ installed: { client_id: 'cid', client_secret: 'csecret', redirect_uris: [] } }),
      );

      // Simulate the loopback server completing immediately
      const mockServer = new EventEmitter() as EventEmitter & {
        listen: jest.Mock;
        close: jest.Mock;
        address: jest.Mock;
      };
      mockServer.listen = jest.fn().mockImplementation((_port: unknown, cb: () => void) => { cb(); return mockServer; });
      mockServer.close = jest.fn().mockImplementation((cb?: () => void) => { cb?.(); });
      mockServer.address = jest.fn().mockReturnValue({ port: 9999 });

      jest.spyOn(http, 'createServer').mockImplementation((handler) => {
        // Immediately emit a fake request with code
        setImmediate(() => {
          const fakeReq = { url: '/?code=fake-code' };
          const fakeRes = { end: jest.fn() };
          (handler as (req: unknown, res: unknown) => void)(fakeReq, fakeRes);
        });
        return mockServer as unknown as http.Server;
      });

      mockFs.writeFileSync = jest.fn();

      const client = new GDriveClient(credPath, tokenPath, scopes);
      await client.authenticate();
      expect(shell.openExternal).toHaveBeenCalledWith(expect.stringContaining('https://'));
    });

    it('calls refreshAccessToken when token is expired, without browser flow', async () => {
      const expiredToken = { access_token: 'old', refresh_token: 'rtok', expiry_date: Date.now() - 1000 };
      mockFs.readFileSync
        .mockReturnValueOnce(
          JSON.stringify({ installed: { client_id: 'cid', client_secret: 'csecret', redirect_uris: [] } }),
        )
        .mockReturnValueOnce(JSON.stringify(expiredToken));

      mockOAuth2Client.credentials = expiredToken;

      const client = new GDriveClient(credPath, tokenPath, scopes);
      await client.authenticate();
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
      expect(shell.openExternal).not.toHaveBeenCalled();
    });
  });
});
