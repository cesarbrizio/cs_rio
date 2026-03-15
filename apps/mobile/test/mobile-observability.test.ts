import { beforeEach, describe, expect, it } from 'vitest';

import {
  recordApiMetric,
  recordPerformanceFpsSample,
  recordRealtimeEvent,
  recordRenderFailure,
  resetMobileObservability,
  resolveMobileObservabilityEnvironment,
  useMobileObservabilityStore,
} from '../src/features/mobile-observability';

describe('mobile observability', () => {
  beforeEach(() => {
    resetMobileObservability();
  });

  it('tracks api latency and failures', () => {
    recordApiMetric({
      durationMs: 320,
      method: 'GET',
      path: '/hospital',
      statusCode: 200,
    });
    recordApiMetric({
      durationMs: 1800,
      errorMessage: 'Timeout',
      method: 'POST',
      path: '/market/orders?itemType=drug',
      statusCode: 504,
    });

    const snapshot = useMobileObservabilityStore.getState();

    expect(snapshot.api.requests).toBe(2);
    expect(snapshot.api.failedRequests).toBe(1);
    expect(snapshot.api.slowRequests).toBe(1);
    expect(snapshot.api.lastPath).toBe('/market/orders');
    expect(snapshot.recentIncidents[0]).toMatchObject({
      kind: 'api',
      severity: 'danger',
      title: 'Falha de API',
    });
  });

  it('tracks realtime reconnects and render failures', () => {
    recordRealtimeEvent({
      channel: 'region',
      status: 'connecting',
    });
    recordRealtimeEvent({
      channel: 'region',
      errorMessage: 'Socket caiu',
      status: 'reconnecting',
    });
    recordRenderFailure({
      componentStack: 'at HomeScreen',
      errorMessage: 'Falha no render do HUD',
    });

    const snapshot = useMobileObservabilityStore.getState();

    expect(snapshot.realtime.region.reconnectCount).toBe(1);
    expect(snapshot.realtime.region.errorCount).toBe(1);
    expect(snapshot.render.failures).toBe(1);
    expect(snapshot.render.lastComponentStack).toContain('HomeScreen');
    expect(snapshot.recentIncidents.some((incident) => incident.kind === 'render')).toBe(true);
  });

  it('tracks fps samples and exposes runtime environment', () => {
    recordPerformanceFpsSample(58);
    recordPerformanceFpsSample(31);

    const snapshot = useMobileObservabilityStore.getState();

    expect(snapshot.performance.sampleCount).toBe(2);
    expect(snapshot.performance.minFps).toBe(31);
    expect(snapshot.performance.lowFpsSamples).toBe(1);
    expect(['development', 'production', 'staging', 'test']).toContain(
      resolveMobileObservabilityEnvironment(),
    );
  });
});
