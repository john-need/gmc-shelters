import { createZip } from './zipper';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

describe('createZip', () => {
  let srcDir: string;
  let destDir: string;

  beforeEach(() => {
    srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-src-'));
    destDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zip-dest-'));
  });

  afterEach(() => {
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
  });

  it('creates a zip file at the destination path', async () => {
    fs.writeFileSync(path.join(srcDir, 'shelter-manifest.json'), '{}');
    const destPath = path.join(destDir, 'output.zip');
    await createZip(srcDir, destPath);
    expect(fs.existsSync(destPath)).toBe(true);
    expect(fs.statSync(destPath).size).toBeGreaterThan(0);
  });

  it('zip contains shelter-manifest.json at archive root', async () => {
    fs.writeFileSync(path.join(srcDir, 'shelter-manifest.json'), '{"test":true}');
    const destPath = path.join(destDir, 'output.zip');
    await createZip(srcDir, destPath);

    const listing = execSync(`unzip -l "${destPath}"`).toString();
    expect(listing).toContain('shelter-manifest.json');
  });

  it('zip contains a file under {slug}/ when per-slug directory exists', async () => {
    const slugDir = path.join(srcDir, 'my-shelter');
    fs.mkdirSync(slugDir, { recursive: true });
    fs.writeFileSync(path.join(slugDir, 'photo.jpg'), 'fake-photo');
    fs.writeFileSync(path.join(srcDir, 'shelter-manifest.json'), '{}');
    const destPath = path.join(destDir, 'output.zip');
    await createZip(srcDir, destPath);

    const listing = execSync(`unzip -l "${destPath}"`).toString();
    expect(listing).toContain('my-shelter/photo.jpg');
  });

  it('resolves on success', async () => {
    fs.writeFileSync(path.join(srcDir, 'file.txt'), 'content');
    const destPath = path.join(destDir, 'output.zip');
    await expect(createZip(srcDir, destPath)).resolves.toBeUndefined();
  });

  it('rejects when source directory does not exist', async () => {
    const badSrc = path.join(os.tmpdir(), 'nonexistent-src-dir-xyz');
    const destPath = path.join(destDir, 'output.zip');
    await expect(createZip(badSrc, destPath)).rejects.toThrow();
  });
});
