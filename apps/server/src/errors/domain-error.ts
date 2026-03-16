export type DomainErrorCategory =
  | 'auth'
  | 'conflict'
  | 'forbidden'
  | 'infrastructure'
  | 'insufficient_resources'
  | 'invalid_input'
  | 'not_found'
  | 'rate_limited'
  | 'unauthorized';

const AUTH_ERROR_CODES = new Set(['invalid_credentials']);
const FORBIDDEN_ERROR_CODES = new Set(['auction_own_bid', 'faction_required', 'forbidden', 'ownership_required']);
const INSUFFICIENT_RESOURCE_ERROR_CODES = new Set(['insufficient_funds', 'insufficient_resources']);
const INVALID_INPUT_ERROR_CODES = new Set([
  'invalid_component',
  'invalid_favela',
  'invalid_input',
  'invalid_lineup',
  'invalid_order',
  'invalid_property',
  'invalid_recipe',
  'invalid_stock',
  'invalid_transition',
  'item_not_supported',
  'order_not_cancelable',
  'validation',
]);
const NOT_FOUND_ERROR_CODES = new Set(['not_found']);
const RATE_LIMITED_ERROR_CODES = new Set(['rate_limited']);
const UNAUTHORIZED_ERROR_CODES = new Set(['unauthorized']);

export class DomainError extends Error {
  constructor(
    public readonly domain: string,
    public readonly code: string,
    public readonly category: DomainErrorCategory,
    message: string,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function inferDomainErrorCategory(code: string): DomainErrorCategory {
  if (AUTH_ERROR_CODES.has(code)) {
    return 'auth';
  }

  if (UNAUTHORIZED_ERROR_CODES.has(code)) {
    return 'unauthorized';
  }

  if (RATE_LIMITED_ERROR_CODES.has(code)) {
    return 'rate_limited';
  }

  if (NOT_FOUND_ERROR_CODES.has(code)) {
    return 'not_found';
  }

  if (FORBIDDEN_ERROR_CODES.has(code)) {
    return 'forbidden';
  }

  if (INSUFFICIENT_RESOURCE_ERROR_CODES.has(code)) {
    return 'insufficient_resources';
  }

  if (INVALID_INPUT_ERROR_CODES.has(code) || code.startsWith('invalid_')) {
    return 'invalid_input';
  }

  return 'conflict';
}
