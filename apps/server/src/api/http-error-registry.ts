import { type DomainError, type DomainErrorCategory } from '../errors/domain-error.js';

export interface DomainErrorMapper {
  domain: string;
  resolveStatusCode(code: string, category: DomainErrorCategory): number | null | undefined;
}

const registry = new Map<string, DomainErrorMapper>();

export function registerErrorMapper(mapper: DomainErrorMapper): void {
  registry.set(mapper.domain, mapper);
}

export function clearErrorMappers(): void {
  registry.clear();
}

export function resolveDomainErrorStatus(error: DomainError): number {
  const mapper = registry.get(error.domain);
  const mappedStatusCode = mapper?.resolveStatusCode(error.code, error.category);

  return mappedStatusCode ?? mapDomainErrorCategoryToStatus(error.category);
}

export function createFixedStatusCodeMapper(
  domain: string,
  statusCodeByErrorCode: Partial<Record<string, number>>,
): DomainErrorMapper {
  return {
    domain,
    resolveStatusCode: (code) => statusCodeByErrorCode[code],
  };
}

export function mapDomainErrorCategoryToStatus(category: DomainErrorCategory): number {
  switch (category) {
    case 'auth':
    case 'unauthorized':
      return 401;
    case 'invalid_input':
      return 400;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'rate_limited':
      return 429;
    case 'infrastructure':
      return 503;
    case 'insufficient_resources':
    case 'conflict':
    default:
      return 409;
  }
}
