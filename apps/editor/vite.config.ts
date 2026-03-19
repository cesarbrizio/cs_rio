import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const monorepoRoot = fileURLToPath(new URL('../../', import.meta.url));
const engineSource = fileURLToPath(new URL('../../packages/game-engine/src', import.meta.url));
const sharedSource = fileURLToPath(new URL('../../packages/shared/src', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@engine': engineSource,
      '@shared': sharedSource,
    },
  },
  server: {
    fs: {
      allow: [monorepoRoot],
    },
  },
});
