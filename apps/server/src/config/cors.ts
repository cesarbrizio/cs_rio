import { InvalidEnvironmentError } from './env.js';

const DEV_ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https?:\/\/10\.0\.2\.2(?::\d+)?$/i,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(?::\d+)?$/i,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(?::\d+)?$/i,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(?::\d+)?$/i,
];

export interface ResolveCorsOptionsInput {
  corsAllowedOrigins?: string | null;
  nodeEnv?: string | null;
}

export function resolveCorsOptions(input: ResolveCorsOptionsInput = {}) {
  const nodeEnv = normalizeNodeEnv(input.nodeEnv);
  const explicitOrigins = parseCorsAllowedOrigins(input.corsAllowedOrigins);

  if (isProtectedEnvironment(nodeEnv) && explicitOrigins.length === 0) {
    throw new InvalidEnvironmentError(
      [
        `CORS_ALLOWED_ORIGINS precisa ser definido em ${nodeEnv}.`,
        'Informe uma lista separada por virgula com as origens HTTP/HTTPS autorizadas.',
      ],
      `boot do servidor (${nodeEnv})`,
    );
  }

  return {
    credentials: true,
    origin: buildAllowedOriginEntries(nodeEnv, explicitOrigins),
  };
}

export function parseCorsAllowedOrigins(raw: string | null | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return Array.from(
    new Set(
      raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function isDevelopmentLikeEnvironment(nodeEnv: string): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}

function isProtectedEnvironment(nodeEnv: string): boolean {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

function matchesAnyPattern(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeNodeEnv(nodeEnv: string | null | undefined): string {
  return nodeEnv?.trim().toLowerCase() || 'development';
}

function buildAllowedOriginEntries(nodeEnv: string, explicitOrigins: string[]): Array<string | RegExp> {
  if (isDevelopmentLikeEnvironment(nodeEnv)) {
    return [...explicitOrigins, ...DEV_ALLOWED_ORIGIN_PATTERNS];
  }

  return explicitOrigins;
}

export function isCorsOriginAllowed(input: ResolveCorsOptionsInput, origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  const nodeEnv = normalizeNodeEnv(input.nodeEnv);
  const explicitOrigins = parseCorsAllowedOrigins(input.corsAllowedOrigins);

  if (explicitOrigins.includes(origin)) {
    return true;
  }

  if (isDevelopmentLikeEnvironment(nodeEnv) && matchesAnyPattern(origin, DEV_ALLOWED_ORIGIN_PATTERNS)) {
    return true;
  }

  return false;
}
