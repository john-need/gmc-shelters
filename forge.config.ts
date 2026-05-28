import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';

const config: ForgeConfig = {
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'john-need',
          name: 'gmc-shelters',
        },
        prerelease: false,
        draft: true,
      },
    },
  ],
  packagerConfig: {
    appBundleId: 'tech.inulabs.gmc-shelters',
    executableName: 'gmc-shelters',
    icon: 'assets/icon',
    ignore: [
      /^\/specs\//,
      /^\/tests\//,
      /^\/\.specify\//,
      /^\/\.agents\//,
      /^\/\.claude\//,
      /^\/\.junie\//,
      /^\/database\/migrations\//,
      /^\/shelters\//,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
      },
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['linux', 'win32'],
    },
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/main/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
