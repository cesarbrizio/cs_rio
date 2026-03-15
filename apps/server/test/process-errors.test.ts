import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { registerProcessErrorHandlers } from '../src/observability/process-errors.js';

class ProcessDouble extends EventEmitter {
  override off(event: 'uncaughtExceptionMonitor' | 'unhandledRejection', listener: (...args: unknown[]) => void): this {
    return super.off(event, listener);
  }

  override on(event: 'uncaughtExceptionMonitor' | 'unhandledRejection', listener: (...args: unknown[]) => void): this {
    return super.on(event, listener);
  }
}

describe('registerProcessErrorHandlers', () => {
  it('loga fatal para unhandled rejection e uncaught exception monitor', () => {
    const logger = {
      fatal: vi.fn(),
    };
    const processDouble = new ProcessDouble();
    const unregister = registerProcessErrorHandlers(logger, processDouble);

    processDouble.emit('unhandledRejection', new Error('promise exploded'));
    processDouble.emit('uncaughtExceptionMonitor', new Error('uncaught exploded'), 'uncaughtException');

    expect(logger.fatal).toHaveBeenCalledWith(
      {
        reason: expect.any(Error),
      },
      'Unhandled promise rejection.',
    );
    expect(logger.fatal).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        origin: 'uncaughtException',
      },
      'Uncaught exception monitor.',
    );

    unregister();
  });
});
