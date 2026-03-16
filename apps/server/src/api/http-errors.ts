import { type FastifyInstance, type FastifyRequest } from 'fastify';

import { DomainError } from '../errors/domain-error.js';
import { registerDefaultHttpErrorMappers } from './http-error-mappers.js';
import { resolveDomainErrorStatus } from './http-error-registry.js';

export type HttpErrorCategory =
  | 'auth'
  | 'domain'
  | 'forbidden'
  | 'infrastructure'
  | 'internal'
  | 'not_found'
  | 'rate_limited'
  | 'validation';

export interface HttpErrorResponseBody {
  category: HttpErrorCategory;
  message: string;
  requestId: string;
}

export class RouteHttpError extends Error {
  declare cause: unknown;

  constructor(public readonly statusCode: number, public readonly category: HttpErrorCategory, message: string, cause?: unknown) {
    super(message);
    this.name = 'RouteHttpError';
    this.cause = cause;
  }
}

export function throwRouteHttpError(error: unknown, fallbackMessage: string): never {
  throw normalizeHttpError(error, fallbackMessage);
}

export function installGlobalHttpErrorHandler(app: FastifyInstance): void {
  registerDefaultHttpErrorMappers();

  app.setErrorHandler((error, request, reply) => {
    const normalized = normalizeHttpError(error);
    const log = request.contextLog ?? request.log;
    const logPayload = {
      err: error,
      errorCategory: normalized.category,
      errorStatusCode: normalized.statusCode,
      requestId: request.id,
    };

    if (normalized.statusCode >= 500) {
      log.error(logPayload, 'request failed');
    } else {
      log.warn(logPayload, 'request rejected');
    }

    if (reply.sent) {
      return reply;
    }

    return reply.code(normalized.statusCode).send(buildHttpErrorResponse(request, normalized));
  });
}

export function buildHttpErrorResponse(
  request: FastifyRequest,
  error: RouteHttpError,
): HttpErrorResponseBody {
  return { category: error.category, message: error.message, requestId: request.id };
}

export function normalizeHttpError(
  error: unknown,
  fallbackMessage = 'Falha interna ao processar a requisicao.',
): RouteHttpError {
  if (error instanceof RouteHttpError) {
    return error;
  }

  const fastifyStatusCode = extractFastifyStatusCode(error);
  if (fastifyStatusCode !== null) {
    return new RouteHttpError(
      fastifyStatusCode,
      mapStatusCodeToCategory(fastifyStatusCode),
      extractErrorMessage(error, fallbackMessage),
      error,
    );
  }

  const domainError = normalizeKnownDomainError(error);
  if (domainError) {
    return domainError;
  }

  if (isInfrastructureError(error)) {
    return new RouteHttpError(
      503,
      'infrastructure',
      'Falha temporaria de infraestrutura.',
      error,
    );
  }

  return new RouteHttpError(500, 'internal', fallbackMessage, error);
}

function normalizeKnownDomainError(error: unknown): RouteHttpError | null {
  if (!(error instanceof DomainError)) {
    return null;
  }
  const statusCode = resolveDomainErrorStatus(error);
  return new RouteHttpError(statusCode, mapStatusCodeToCategory(statusCode), error.message, error);
}

function extractFastifyStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const maybeStatusCode = (error as { statusCode?: unknown }).statusCode;

  if (typeof maybeStatusCode === 'number' && maybeStatusCode >= 400 && maybeStatusCode < 600) {
    return maybeStatusCode;
  }

  if ('validation' in error) {
    return 400;
  }

  return null;
}

function extractErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallbackMessage;
}

function mapStatusCodeToCategory(statusCode: number): HttpErrorCategory {
  switch (statusCode) {
    case 400:
    case 413:
      return 'validation';
    case 401:
      return 'auth';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 429:
      return 'rate_limited';
    case 500:
      return 'internal';
    case 502:
    case 503:
    case 504:
      return 'infrastructure';
    default:
      return 'domain';
  }
}

function isInfrastructureError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const name = error.name.toLowerCase();
  const message = error.message.toLowerCase();
  const code = readErrorCode(error);

  if (
    name.includes('redis') ||
    name.includes('drizzle') ||
    name.includes('database') ||
    name.includes('postgres')
  ) {
    return true;
  }

  if (
    message.includes('redis') ||
    message.includes('database') ||
    message.includes('connection refused') ||
    message.includes('timeout')
  ) {
    return true;
  }
  return code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'EPIPE';
}

function readErrorCode(error: Error): string | null {
  return typeof (error as Error & { code?: unknown }).code === 'string'
    ? (error as Error & { code?: string }).code ?? null
    : null;
}
