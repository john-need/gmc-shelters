// Ensures better-sqlite3's native binary matches the Node ABI that Jest runs on.
//
// `npm run start`/`prestart` runs electron-rebuild, leaving better-sqlite3 built
// for Electron's ABI (NODE_MODULE_VERSION 128). The main-process DB tests then
// crash with "compiled against a different Node.js version". This setup runs no
// matter how Jest is launched (npm test, npx jest, IDE, --watch) and rebuilds
// only when the ABI is actually wrong, so healthy runs pay nothing.
const { execSync } = require('node:child_process');

module.exports = async () => {
  try {
    require('better-sqlite3');
  } catch (err) {
    const message = String((err && err.message) || '');
    if (!/NODE_MODULE_VERSION|compiled against a different/.test(message)) {
      throw err;
    }
    console.warn('\n[jest] better-sqlite3 ABI mismatch — rebuilding for Node…');
    execSync('npm rebuild better-sqlite3', { stdio: 'inherit' });
  }
};
