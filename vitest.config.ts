import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const setupEnvPath = fileURLToPath(new URL('./test/setup-env.ts', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    passWithNoTests: true,
    include: ['test/**/*.test.ts'],
    setupFiles: [setupEnvPath],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
