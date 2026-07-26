import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

/** Rebuilds wiki/search.db from the current wiki/**\/*.md OKF headers. */
export function rebuildWikiIndex(): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const root = app.getAppPath();
    const child = spawn('python3', [path.join(root, 'scripts', 'build_wiki_index.py')], { cwd: root });
    let stderr = '';
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
    child.on('close', (code) => {
      resolve(code === 0 ? { ok: true } : { ok: false, error: stderr.slice(-500) || `exit code ${code}` });
    });
  });
}
