import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import type { UserConfig } from 'vite';

const appSource = fileURLToPath(new URL('./src', import.meta.url));
const monorepoRoot = fileURLToPath(new URL('../../', import.meta.url));
const domainSource = fileURLToPath(new URL('../../packages/domain/src', import.meta.url));
const engineSource = fileURLToPath(new URL('../../packages/game-engine/src', import.meta.url));
const platformSource = fileURLToPath(new URL('../../packages/platform/src', import.meta.url));
const sharedSource = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

export default async function createConfig(): Promise<UserConfig> {
  const electronPlugins = await electron({
    main: {
      entry: 'electron/main.ts',
    },
    preload: {
      input: 'electron/preload.ts',
    },
  });

  return {
    plugins: [react(), ...electronPlugins],
    resolve: {
      alias: {
        '@': appSource,
        '@domain': domainSource,
        '@engine': engineSource,
        '@platform': platformSource,
        '@shared': sharedSource,
      },
    },
    server: {
      fs: {
        allow: [monorepoRoot],
      },
    },
  };
}
