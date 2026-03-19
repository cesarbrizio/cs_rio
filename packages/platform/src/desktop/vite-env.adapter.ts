import type { AppPlatformEnv, EnvPort } from '../contracts/env.port';

function normalizeAppEnv(value: string | undefined): AppPlatformEnv {
  if (value === 'production' || value === 'staging') {
    return value;
  }

  return 'development';
}

export const viteEnv: EnvPort = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  appEnv: normalizeAppEnv(import.meta.env.VITE_APP_ENV),
  wsUrl: import.meta.env.VITE_WS_URL ?? 'ws://localhost:2567',
};
