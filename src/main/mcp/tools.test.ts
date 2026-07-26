// electron resolves to src/main/__mocks__/electron.ts via jest moduleNameMapper.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { app } from 'electron';
import type { Shelter, Source, Photo } from '../../shared/ipc-types';

jest.mock('../db/shelters');
jest.mock('../db/sources');
jest.mock('../db/photos');
import { getAllShelters, getShelterById } from '../db/shelters';
import { getSourcesByShelter } from '../db/sources';
import { getPhotosByShelter } from '../db/photos';

import {
  downloadDocument, listShelters, getShelter, listSources, listPhotos, downloadHistory, downloadPhoto,
} from './tools';

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 7, name: 'Birch Glen Lodge', start_year: 1932, end_year: null,
    description: '', slug: 'birch-glen-lodge', default_photo_id: null, is_gmc: true,
    architecture: 'Adirondack', built_by: 'Green Mountain Club', notes: '',
    created: '2020-01-01', updated: '2020-01-02', is_extant: true, category: 'Lean-to',
    show_on_web: true, history: 'birch-glen-lodge/birch-glen-lodge.md',
    ...overrides,
  };
}

function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: 3, photographer: '', file_name: 'birch-glen-lodge/photos/view.jpg', caption: '',
    date_taken: '', notes: '', created: '2020-01-01', updated: '2020-01-02', shelter_id: 7,
    alt_text: '', title: '', description: '', include_in_post: true,
    ...overrides,
  };
}

describe('mcp/tools downloadDocument', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tools-test-'));
    (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeCollectionFile(resource: string, content: string) {
    const filePath = path.join(tmpDir, resource);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content);
  }

  it('reads a document under collections/ and reports its mime type', () => {
    writeCollectionFile('collections/long-trail-news/1922_12_Dec.pdf', 'fake pdf bytes');
    const result = downloadDocument('collections/long-trail-news/1922_12_Dec.pdf');
    expect(result.ok).toBe(true);
    expect(result.data?.toString()).toBe('fake pdf bytes');
    expect(result.mimeType).toBe('application/pdf');
  });

  it('reports image/webp for a .webp resource', () => {
    writeCollectionFile('collections/long-trail-news/cover.webp', 'fake webp bytes');
    const result = downloadDocument('collections/long-trail-news/cover.webp');
    expect(result.ok).toBe(true);
    expect(result.mimeType).toBe('image/webp');
  });

  it('reports not-ok for a resource that does not exist', () => {
    const result = downloadDocument('collections/long-trail-news/missing.pdf');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects a resource path that escapes the collections folder', () => {
    writeCollectionFile('secret.txt', 'nope');
    const result = downloadDocument('../secret.txt');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/collections/i);
  });

  it('rejects a resource path outside collections/ even if it exists on disk', () => {
    writeCollectionFile('wiki/long-trail-news/1922_12_Dec.md', 'not a pdf');
    const result = downloadDocument('wiki/long-trail-news/1922_12_Dec.md');
    expect(result.ok).toBe(false);
  });
});

describe('mcp/tools database + file accessors', () => {
  let tmpDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tools-test-'));
    (app.getAppPath as jest.Mock).mockReturnValue(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('listShelters passes through getAllShelters()', () => {
    const shelters = [makeShelter()];
    (getAllShelters as jest.Mock).mockReturnValue(shelters);
    expect(listShelters()).toBe(shelters);
  });

  it('getShelter passes through getShelterById(id)', () => {
    const shelter = makeShelter();
    (getShelterById as jest.Mock).mockReturnValue(shelter);
    expect(getShelter(7)).toBe(shelter);
    expect(getShelterById).toHaveBeenCalledWith(7);
  });

  it('getShelter returns null for an unknown id', () => {
    (getShelterById as jest.Mock).mockReturnValue(null);
    expect(getShelter(999)).toBeNull();
  });

  it('listSources passes through getSourcesByShelter(shelterId)', () => {
    const sources = [{ id: 1 } as Source];
    (getSourcesByShelter as jest.Mock).mockReturnValue(sources);
    expect(listSources(7)).toBe(sources);
    expect(getSourcesByShelter).toHaveBeenCalledWith(7);
  });

  it('listPhotos passes through getPhotosByShelter(shelterId)', () => {
    const photos = [makePhoto()];
    (getPhotosByShelter as jest.Mock).mockReturnValue(photos);
    expect(listPhotos(7)).toBe(photos);
    expect(getPhotosByShelter).toHaveBeenCalledWith(7);
  });

  describe('downloadHistory', () => {
    it('reads the shelter\'s history markdown file', async () => {
      (getShelterById as jest.Mock).mockReturnValue(makeShelter());
      fs.mkdirSync(path.join(tmpDir, 'shelters', 'birch-glen-lodge'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'shelters', 'birch-glen-lodge', 'birch-glen-lodge.md'),
        '# Birch Glen Lodge\n\nBuilt in 1932.',
      );

      const result = await downloadHistory(7);
      expect(result.ok).toBe(true);
      expect(result.content).toBe('# Birch Glen Lodge\n\nBuilt in 1932.');
    });

    it('reports not-ok for an unknown shelter', async () => {
      (getShelterById as jest.Mock).mockReturnValue(null);
      const result = await downloadHistory(999);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('reports not-ok when the history file does not exist on disk', async () => {
      (getShelterById as jest.Mock).mockReturnValue(makeShelter());
      const result = await downloadHistory(7);
      expect(result.ok).toBe(false);
    });
  });

  describe('downloadPhoto', () => {
    it('reads the photo file and reports its mime type', () => {
      (getShelterById as jest.Mock).mockReturnValue(makeShelter());
      (getPhotosByShelter as jest.Mock).mockReturnValue([makePhoto()]);
      fs.mkdirSync(path.join(tmpDir, 'shelters', 'birch-glen-lodge', 'photos'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'shelters', 'birch-glen-lodge', 'photos', 'view.jpg'),
        'fake jpeg bytes',
      );

      const result = downloadPhoto(7, 3);
      expect(result.ok).toBe(true);
      expect(result.data?.toString()).toBe('fake jpeg bytes');
      expect(result.mimeType).toBe('image/jpeg');
    });

    it('reports not-ok for an unknown shelter', () => {
      (getShelterById as jest.Mock).mockReturnValue(null);
      const result = downloadPhoto(999, 3);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('reports not-ok for a photo id not belonging to the shelter', () => {
      (getShelterById as jest.Mock).mockReturnValue(makeShelter());
      (getPhotosByShelter as jest.Mock).mockReturnValue([makePhoto()]);
      const result = downloadPhoto(7, 999);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('reports not-ok when the photo file is missing from disk', () => {
      (getShelterById as jest.Mock).mockReturnValue(makeShelter());
      (getPhotosByShelter as jest.Mock).mockReturnValue([makePhoto()]);
      const result = downloadPhoto(7, 3);
      expect(result.ok).toBe(false);
    });
  });
});
