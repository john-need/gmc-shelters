const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const file = path.resolve(
  'out/gmc-shelters-darwin-arm64/gmc-shelters.app/Contents/Resources/app/.vite/renderer/main_window/index.html',
);

const vc = new VirtualConsole();
vc.on('log', (...args) => console.log('[console.log]', ...args));
vc.on('error', (...args) => console.log('[console.error]', ...args));
vc.on('jsdomError', (err) => console.log('[jsdomError]', err.stack || err.message));

JSDOM.fromFile(file, {
  url: `file://${file}`,
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.api = {
      shelters: { getAll: async () => [], getById: async () => null, create: async () => ({}), update: async () => ({}), delete: async () => {} },
      photos: { getByShelter: async () => [], update: async () => ({}), delete: async () => {}, setDefault: async () => {}, upload: async () => ({}) },
      history: { read: async () => '', write: async () => {} },
      sources: { getByShelter: async () => [], create: async () => ({}), update: async () => ({}), delete: async () => {} },
      shell: { openExternal: async () => {} },
      app: { getVersion: async () => '0.1.0', getRepoRoot: async () => process.cwd() },
    };
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  },
}).then((dom) => {
  setTimeout(() => {
    const root = dom.window.document.getElementById('root');
    console.log('root child count', root ? root.childNodes.length : 'missing');
    console.log('body text snippet', dom.window.document.body.textContent?.trim().slice(0, 200));
    console.log('html snippet', root?.innerHTML.slice(0, 500));
    dom.window.close();
  }, 1500);
});

