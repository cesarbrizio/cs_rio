import { describe, expect, it } from 'vitest';

import { resolveAppEnv } from '../src/config/env-resolver';

describe('resolveAppEnv', () => {
  it('prefers explicit API and WS URLs from environment', () => {
    const env = resolveAppEnv({
      apiUrl: 'http://192.168.1.20:9000',
      expoHostUri: '192.168.1.19:8081',
      wsUrl: 'ws://192.168.1.20:2567',
    });

    expect(env.apiUrl).toBe('http://192.168.1.20:9000');
    expect(env.wsUrl).toBe('ws://192.168.1.20:2567');
  });

  it('falls back to the Metro script URL host in development builds', () => {
    const env = resolveAppEnv({
      scriptUrl: 'http://192.168.1.19:8081/index.bundle?platform=android&dev=true',
    });

    expect(env.apiUrl).toBe('http://192.168.1.19:9000');
    expect(env.wsUrl).toBe('ws://192.168.1.19:2567');
  });

  it('prefers a non-loopback host over localhost when multiple sources exist', () => {
    const env = resolveAppEnv({
      debuggerHost: 'localhost:8081',
      expoHostUri: '192.168.1.25:8081',
      scriptUrl: 'http://localhost:8081/index.bundle?platform=android',
    });

    expect(env.apiUrl).toBe('http://192.168.1.25:9000');
    expect(env.wsUrl).toBe('ws://192.168.1.25:2567');
  });

  it('keeps localhost fallback only when no better host exists', () => {
    const env = resolveAppEnv({
      debuggerHost: 'localhost:8081',
    });

    expect(env.apiUrl).toBe('http://localhost:9000');
    expect(env.wsUrl).toBe('ws://localhost:2567');
  });
});
