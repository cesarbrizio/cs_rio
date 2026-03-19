import type { AppPlatformEnv, EnvPort } from '../contracts/env.port';

function normalizeAppEnv(value: string | undefined): AppPlatformEnv {
  if (value === 'production' || value === 'staging') {
    return value;
  }

  return 'development';
}

function resolveEnvValue(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export const viteEnv: EnvPort = {
  apiUrl:
    resolveEnvValue(import.meta.env.VITE_API_URL, import.meta.env.EXPO_PUBLIC_API_URL) ??
    'http://localhost:3000',
  appEnv: normalizeAppEnv(
    resolveEnvValue(import.meta.env.VITE_APP_ENV, import.meta.env.EXPO_PUBLIC_APP_ENV),
  ),
  wsUrl:
    resolveEnvValue(import.meta.env.VITE_WS_URL, import.meta.env.EXPO_PUBLIC_WS_URL) ??
    'ws://localhost:2567',
};
