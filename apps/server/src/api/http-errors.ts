import { type FastifyInstance, type FastifyRequest } from 'fastify';

import { AuthError } from '../services/auth.js';
import { BankError } from '../services/bank.js';
import { BichoError } from '../services/bicho.js';
import { BocaError } from '../services/boca.js';
import { CrimeError } from '../systems/CrimeSystem.js';
import { DrugSaleError } from '../services/drug-sale.js';
import { FactionError } from '../services/faction.js';
import { FactoryError } from '../services/factory.js';
import { FrontStoreError } from '../services/front-store.js';
import { HospitalError } from '../services/hospital.js';
import { MarketError } from '../services/market.js';
import { PlayerError } from '../services/player.js';
import { PrisonError } from '../services/prison.js';
import { PropertyError } from '../services/property.js';
import { PuteiroError } from '../services/puteiro.js';
import { PvpError } from '../services/pvp.js';
import { RaveError } from '../services/rave.js';
import { RobberyError } from '../services/robbery.js';
import { SlotMachineError } from '../services/slot-machine.js';
import { TerritoryError } from '../services/territory.js';
import { TrainingError } from '../services/training.js';
import { TribunalError } from '../services/tribunal.js';
import { UniversityError } from '../services/university.js';

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

  constructor(
    public readonly statusCode: number,
    public readonly category: HttpErrorCategory,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'RouteHttpError';
    this.cause = cause;
  }
}

export function throwRouteHttpError(error: unknown, fallbackMessage: string): never {
  throw normalizeHttpError(error, fallbackMessage);
}

export function installGlobalHttpErrorHandler(app: FastifyInstance): void {
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
  return {
    category: error.category,
    message: error.message,
    requestId: request.id,
  };
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
  if (error instanceof AuthError) {
    return createMappedError(
      error,
      {
        conflict: 409,
        invalid_credentials: 401,
        rate_limited: 429,
        unauthorized: 401,
        validation: 400,
      },
      401,
    );
  }

  if (error instanceof PlayerError) {
    return createMappedError(
      error,
      {
        conflict: 409,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      401,
    );
  }

  if (error instanceof BankError) {
    return createMappedError(
      error,
      {
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof BichoError) {
    return createMappedError(
      error,
      {
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof BocaError) {
    return createMappedError(
      error,
      {
        invalid_stock: 400,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof CrimeError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof DrugSaleError) {
    return createMappedError(
      error,
      {
        conflict: 409,
        not_found: 404,
      },
      400,
    );
  }

  if (error instanceof FactionError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof FactoryError) {
    return createMappedError(
      error,
      {
        invalid_component: 400,
        invalid_recipe: 400,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof FrontStoreError) {
    return createMappedError(
      error,
      {
        insufficient_funds: 422,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof HospitalError) {
    return createMappedError(
      error,
      {
        insufficient_resources: 402,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof MarketError) {
    return createMappedError(
      error,
      {
        auction_own_bid: 403,
        auction_closed: 409,
        bid_too_low: 409,
        character_not_ready: 409,
        insufficient_funds: 409,
        not_found: 404,
        ownership_required: 403,
      },
      400,
    );
  }

  if (error instanceof PrisonError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof PropertyError) {
    return createMappedError(
      error,
      {
        invalid_favela: 400,
        invalid_property: 400,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof PuteiroError) {
    return createMappedError(
      error,
      {
        insufficient_funds: 422,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof PvpError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof RaveError) {
    return createMappedError(
      error,
      {
        invalid_lineup: 400,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof RobberyError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof SlotMachineError) {
    return createMappedError(
      error,
      {
        insufficient_funds: 422,
        not_found: 404,
        unauthorized: 401,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof TerritoryError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        invalid_transition: 400,
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof TrainingError) {
    return createMappedError(
      error,
      {
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof TribunalError) {
    return createMappedError(
      error,
      {
        forbidden: 403,
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  if (error instanceof UniversityError) {
    return createMappedError(
      error,
      {
        not_found: 404,
        validation: 400,
      },
      409,
    );
  }

  return null;
}

function createMappedError(
  error: Error & { code: string },
  statusByCode: Partial<Record<string, number>>,
  defaultStatusCode: number,
): RouteHttpError {
  const statusCode = statusByCode[error.code] ?? defaultStatusCode;
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
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
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

  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EPIPE'
  );
}

function readErrorCode(error: Error): string | null {
  const maybeCode = (error as Error & { code?: unknown }).code;
  return typeof maybeCode === 'string' ? maybeCode : null;
}
