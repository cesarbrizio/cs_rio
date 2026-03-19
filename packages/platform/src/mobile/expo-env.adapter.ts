import Constants from 'expo-constants';
import { NativeModules } from 'react-native';

import type { AppPlatformEnv, EnvPort } from '../contracts/env.port';

interface ExpoEnvSources {
  apiUrl?: string | null;
  appEnv?: string | null;
  debuggerHost?: string | null;
  expoHostUri?: string | null;
  scriptUrl?: string | null;
  wsUrl?: string | null;
}

function extractHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.includes('://')) {
    try {
      const parsedUrl = new URL(normalizedValue);
      return parsedUrl.hostname || null;
    } catch {
      return null;
    }
  }

  const withoutPath = normalizedValue.split('/')[0];

  if (!withoutPath) {
    return null;
  }

  const [host] = withoutPath.split(':');
  return host || null;
}

function resolveScriptUrl(): string | null {
  const sourceCodeModule = NativeModules.SourceCode as
    | { getConstants?: () => { scriptURL?: string | null }; scriptURL?: string | null }
    | undefined;

  return (
    sourceCodeModule?.scriptURL ??
    sourceCodeModule?.getConstants?.().scriptURL ??
    null
  );
}

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

function inferDevHost(sources: Pick<ExpoEnvSources, 'debuggerHost' | 'expoHostUri' | 'scriptUrl'>): string | null {
  const hostCandidates = [
    extractHost(sources.expoHostUri),
    extractHost(sources.debuggerHost),
    extractHost(sources.scriptUrl),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const nonLoopbackHost = hostCandidates.find((candidate) => !isLoopbackHost(candidate));

  return nonLoopbackHost ?? hostCandidates[0] ?? null;
}

function buildDevUrl(protocol: 'http' | 'ws', port: number, host: string | null): string | null {
  if (!host) {
    return null;
  }

  return `${protocol}://${host}:${port}`;
}

export function normalizeAppEnv(value: string | null | undefined): AppPlatformEnv {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === 'production' || normalizedValue === 'staging') {
    return normalizedValue;
  }

  return 'development';
}

export function resolveExpoEnv(sources: ExpoEnvSources): EnvPort {
  const inferredHost = inferDevHost({
    debuggerHost: sources.debuggerHost ?? null,
    expoHostUri: sources.expoHostUri ?? null,
    scriptUrl: sources.scriptUrl ?? null,
  });

  return {
    apiUrl: sources.apiUrl ?? buildDevUrl('http', 9000, inferredHost) ?? 'http://localhost:3000',
    appEnv: normalizeAppEnv(sources.appEnv),
    wsUrl: sources.wsUrl ?? buildDevUrl('ws', 2567, inferredHost) ?? 'ws://localhost:2567',
  };
}

export const expoEnv: EnvPort = resolveExpoEnv({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  debuggerHost: Constants.expoGoConfig?.debuggerHost ?? null,
  expoHostUri: Constants.expoConfig?.hostUri ?? null,
  scriptUrl: resolveScriptUrl(),
  wsUrl: process.env.EXPO_PUBLIC_WS_URL,
});
