import { describe, expect, it, vi } from 'vitest';

import { RedisKeyValueStore } from '../src/services/auth.js';

function createLoggerSpy() {
  const logger = {
    child: vi.fn(() => logger),
    error: vi.fn(),
    fatal: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };

  return logger;
}

function createRedisClientDouble() {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const client = {
    connect: vi.fn(async () => {
      client.isOpen = true;
    }),
    del: vi.fn(async () => 1),
    emit(event: string, ...args: unknown[]) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
    expire: vi.fn(async () => 1),
    get: vi.fn(async () => null),
    incr: vi.fn(async () => 1),
    isOpen: false,
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      const registered = listeners.get(event) ?? [];
      registered.push(listener);
      listeners.set(event, registered);
      return client;
    }),
    quit: vi.fn(async () => {
      client.isOpen = false;
    }),
    set: vi.fn(async () => 'OK'),
  };

  return client;
}

describe('RedisKeyValueStore', () => {
  it('loga eventos criticos do client Redis em vez de engolir silenciosamente', async () => {
    const logger = createLoggerSpy();
    const client = createRedisClientDouble();
    const store = new RedisKeyValueStore({
      clientFactory: () => client,
      logger,
      redisUrl: 'redis://localhost:6379/2',
    });

    await store.get('login:attempts');

    client.emit('ready');
    client.emit('reconnecting');
    client.emit('end');
    client.emit('error', new Error('redis down'));

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith({}, 'Redis client ready.');
    expect(logger.warn).toHaveBeenCalledWith({}, 'Redis client reconnecting.');
    expect(logger.warn).toHaveBeenCalledWith({}, 'Redis client connection ended.');
    expect(logger.error).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
      },
      'Redis client error.',
    );
  });
});
