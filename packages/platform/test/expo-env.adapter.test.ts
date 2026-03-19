import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: null,
    expoGoConfig: null,
  },
}));

vi.mock('react-native', () => ({
  NativeModules: {},
}));

describe('expo env adapter', () => {
  it('normalizes the application environment', async () => {
    const { normalizeAppEnv } = await import('../src/mobile/expo-env.adapter');

    expect(normalizeAppEnv('production')).toBe('production');
    expect(normalizeAppEnv('staging')).toBe('staging');
    expect(normalizeAppEnv('DEV')).toBe('development');
    expect(normalizeAppEnv(undefined)).toBe('development');
  });

  it('infers api and websocket urls from expo-like hosts', async () => {
    const { resolveExpoEnv } = await import('../src/mobile/expo-env.adapter');

    expect(
      resolveExpoEnv({
        debuggerHost: '192.168.0.9:8081',
      }),
    ).toEqual({
      apiUrl: 'http://192.168.0.9:9000',
      appEnv: 'development',
      wsUrl: 'ws://192.168.0.9:2567',
    });
  });
});
