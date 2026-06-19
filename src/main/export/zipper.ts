import fs from 'fs';
import archiver from 'archiver';

export function createZip(srcDir: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(srcDir)) {
      return reject(new Error(`Source directory does not exist: ${srcDir}`));
    }

    const output = fs.createWriteStream(destPath);
    const archive = archiver.create('zip', { zlib: { level: 9 } });

    output.on('close', resolve);
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(srcDir, false);
    archive.finalize();
  });
}
