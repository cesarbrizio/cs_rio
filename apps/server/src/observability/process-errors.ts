import { type InfrastructureLogger } from './logger.js';

export interface ProcessErrorHandlerProcess {
  off(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  off(event: 'uncaughtExceptionMonitor', listener: (error: Error, origin: string) => void): void;
  on(event: 'unhandledRejection', listener: (reason: unknown) => void): void;
  on(event: 'uncaughtExceptionMonitor', listener: (error: Error, origin: string) => void): void;
}

export function registerProcessErrorHandlers(
  logger: Pick<InfrastructureLogger, 'fatal'>,
  processRef: ProcessErrorHandlerProcess = process,
): () => void {
  const onUnhandledRejection = (reason: unknown) => {
    logger.fatal(
      {
        reason,
      },
      'Unhandled promise rejection.',
    );
  };

  const onUncaughtExceptionMonitor = (error: Error, origin: string) => {
    logger.fatal(
      {
        err: error,
        origin,
      },
      'Uncaught exception monitor.',
    );
  };

  processRef.on('unhandledRejection', onUnhandledRejection);
  processRef.on('uncaughtExceptionMonitor', onUncaughtExceptionMonitor);

  return () => {
    processRef.off('unhandledRejection', onUnhandledRejection);
    processRef.off('uncaughtExceptionMonitor', onUncaughtExceptionMonitor);
  };
}
