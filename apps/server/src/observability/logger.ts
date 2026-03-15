import pino from 'pino';

export interface InfrastructureLogger {
  child(bindings: Record<string, unknown>): InfrastructureLogger;
  info(payload: unknown, message?: string): void;
  warn(payload: unknown, message?: string): void;
  error(payload: unknown, message?: string): void;
  fatal(payload: unknown, message?: string): void;
}

const baseLogger = pino({
  name: 'cs-rio-server',
});

export function createInfrastructureLogger(bindings: Record<string, unknown> = {}): InfrastructureLogger {
  return baseLogger.child(bindings) as unknown as InfrastructureLogger;
}
