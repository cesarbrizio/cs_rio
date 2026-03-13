type DevProtocol = 'http' | 'ws';

export interface AppEnvSources {
  apiUrl?: string | null;
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

function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}

function inferDevHost(sources: Omit<AppEnvSources, 'apiUrl' | 'wsUrl'>): string | null {
  const hostCandidates = [
    extractHost(sources.expoHostUri),
    extractHost(sources.debuggerHost),
    extractHost(sources.scriptUrl),
  ].filter((candidate): candidate is string => Boolean(candidate));

  const nonLoopbackHost = hostCandidates.find((candidate) => !isLoopbackHost(candidate));

  return nonLoopbackHost ?? hostCandidates[0] ?? null;
}

function buildDevUrl(protocol: DevProtocol, port: number, host: string | null): string | null {
  if (!host) {
    return null;
  }

  return `${protocol}://${host}:${port}`;
}

export function resolveAppEnv(sources: AppEnvSources): { apiUrl: string; wsUrl: string } {
  const inferredHost = inferDevHost({
    debuggerHost: sources.debuggerHost ?? null,
    expoHostUri: sources.expoHostUri ?? null,
    scriptUrl: sources.scriptUrl ?? null,
  });

  return {
    apiUrl: sources.apiUrl ?? buildDevUrl('http', 9000, inferredHost) ?? 'http://localhost:3000',
    wsUrl: sources.wsUrl ?? buildDevUrl('ws', 2567, inferredHost) ?? 'ws://localhost:2567',
  };
}
