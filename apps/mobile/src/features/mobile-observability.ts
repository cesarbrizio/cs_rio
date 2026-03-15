import { create } from 'zustand';

export type MobileObservabilityEnvironment =
  | 'development'
  | 'production'
  | 'staging'
  | 'test';

export type MobileIncidentKind = 'api' | 'performance' | 'realtime' | 'render';
export type MobileIncidentSeverity = 'danger' | 'info' | 'warning';
export type MobileRealtimeChannel = 'faction' | 'region';

export interface MobileDiagnosticIncident {
  detail: string;
  id: string;
  kind: MobileIncidentKind;
  occurredAt: string;
  severity: MobileIncidentSeverity;
  title: string;
}

export interface MobileApiDiagnostics {
  averageLatencyMs: number | null;
  failedRequests: number;
  lastErrorMessage: string | null;
  lastLatencyMs: number | null;
  lastMethod: string | null;
  lastOccurredAt: string | null;
  lastPath: string | null;
  lastStatusCode: number | null;
  maxLatencyMs: number | null;
  requests: number;
  slowRequests: number;
}

export interface MobileRealtimeDiagnostics {
  errorCount: number;
  lastErrorMessage: string | null;
  lastEventAt: string | null;
  reconnectCount: number;
  status: 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
}

export interface MobilePerformanceDiagnostics {
  averageFps: number | null;
  lastLowFpsAt: string | null;
  lastSampleAt: string | null;
  latestFps: number | null;
  lowFpsSamples: number;
  minFps: number | null;
  sampleCount: number;
}

export interface MobileRenderDiagnostics {
  crashTrailMode: 'local-buffer';
  environment: MobileObservabilityEnvironment;
  failures: number;
  lastComponentStack: string | null;
  lastErrorMessage: string | null;
  lastOccurredAt: string | null;
}

interface MobileObservabilityState {
  api: MobileApiDiagnostics;
  performance: MobilePerformanceDiagnostics;
  realtime: Record<MobileRealtimeChannel, MobileRealtimeDiagnostics>;
  recentIncidents: MobileDiagnosticIncident[];
  render: MobileRenderDiagnostics;
  recordApiMetric: (input: {
    durationMs: number;
    errorMessage?: string | null;
    method: string;
    path: string;
    statusCode?: number | null;
  }) => void;
  recordPerformanceFpsSample: (fps: number) => void;
  recordRealtimeEvent: (input: {
    channel: MobileRealtimeChannel;
    errorMessage?: string | null;
    status: MobileRealtimeDiagnostics['status'];
  }) => void;
  recordRenderFailure: (input: {
    componentStack?: string | null;
    errorMessage: string;
  }) => void;
  reset: () => void;
}

const LOW_FPS_THRESHOLD = 40;
const MAX_RECENT_INCIDENTS = 12;
const SLOW_API_THRESHOLD_MS = 1_500;

export const useMobileObservabilityStore = create<MobileObservabilityState>((set) => ({
  ...buildInitialState(),
  recordApiMetric: (input) =>
    set((state) => {
      const nextRequestCount = state.api.requests + 1;
      const nextAverageLatencyMs =
        state.api.averageLatencyMs === null
          ? Math.round(input.durationMs)
          : Math.round(
              (state.api.averageLatencyMs * state.api.requests + input.durationMs) /
                nextRequestCount,
            );
      const hasError = Boolean(input.errorMessage) || (input.statusCode ?? 200) >= 400;
      const nextState: MobileObservabilityState = {
        ...state,
        api: {
          averageLatencyMs: nextAverageLatencyMs,
          failedRequests: state.api.failedRequests + (hasError ? 1 : 0),
          lastErrorMessage: input.errorMessage ?? (hasError ? 'Falha de API.' : null),
          lastLatencyMs: Math.round(input.durationMs),
          lastMethod: input.method,
          lastOccurredAt: new Date().toISOString(),
          lastPath: normalizeMetricPath(input.path),
          lastStatusCode: input.statusCode ?? null,
          maxLatencyMs:
            state.api.maxLatencyMs === null
              ? Math.round(input.durationMs)
              : Math.max(state.api.maxLatencyMs, Math.round(input.durationMs)),
          requests: nextRequestCount,
          slowRequests:
            state.api.slowRequests + (input.durationMs >= SLOW_API_THRESHOLD_MS ? 1 : 0),
        },
      };

      if (hasError) {
        nextState.recentIncidents = pushIncident(state.recentIncidents, {
          detail: `${input.method.toUpperCase()} ${normalizeMetricPath(input.path)}${
            input.statusCode ? ` · ${input.statusCode}` : ''
          }${input.errorMessage ? ` · ${input.errorMessage}` : ''}`,
          kind: 'api',
          severity: 'danger',
          title: 'Falha de API',
        });
      } else if (input.durationMs >= SLOW_API_THRESHOLD_MS) {
        nextState.recentIncidents = pushIncident(state.recentIncidents, {
          detail: `${input.method.toUpperCase()} ${normalizeMetricPath(input.path)} · ${Math.round(
            input.durationMs,
          )} ms`,
          kind: 'api',
          severity: 'warning',
          title: 'API lenta',
        });
      }

      return nextState;
    }),
  recordPerformanceFpsSample: (fps) =>
    set((state) => {
      const nextSampleCount = state.performance.sampleCount + 1;
      const nextLatestFps = Math.round(fps);
      const nextAverageFps =
        state.performance.averageFps === null
          ? nextLatestFps
          : Math.round(
              (state.performance.averageFps * state.performance.sampleCount + nextLatestFps) /
                Math.max(1, nextSampleCount),
            );
      const nextState: MobileObservabilityState = {
        ...state,
        performance: {
          averageFps: nextAverageFps,
          lastLowFpsAt:
            nextLatestFps < LOW_FPS_THRESHOLD
              ? new Date().toISOString()
              : state.performance.lastLowFpsAt,
          lastSampleAt: new Date().toISOString(),
          latestFps: nextLatestFps,
          lowFpsSamples:
            state.performance.lowFpsSamples + (nextLatestFps < LOW_FPS_THRESHOLD ? 1 : 0),
          minFps:
            state.performance.minFps === null
              ? nextLatestFps
              : Math.min(state.performance.minFps, nextLatestFps),
          sampleCount: nextSampleCount,
        },
      };

      if (nextLatestFps < LOW_FPS_THRESHOLD && shouldLogLowFpsIncident(state.performance.lastLowFpsAt)) {
        nextState.recentIncidents = pushIncident(state.recentIncidents, {
          detail: `O mapa reportou ${nextLatestFps} FPS no último ciclo útil.`,
          kind: 'performance',
          severity: 'warning',
          title: 'Queda de FPS',
        });
      }

      return nextState;
    }),
  recordRealtimeEvent: (input) =>
    set((state) => {
      const channelState = state.realtime[input.channel];
      const hasError = Boolean(input.errorMessage);
      const nextState: MobileObservabilityState = {
        ...state,
        realtime: {
          ...state.realtime,
          [input.channel]: {
            errorCount: channelState.errorCount + (hasError ? 1 : 0),
            lastErrorMessage: input.errorMessage ?? channelState.lastErrorMessage,
            lastEventAt: new Date().toISOString(),
            reconnectCount:
              channelState.reconnectCount + (input.status === 'reconnecting' ? 1 : 0),
            status: input.status,
          },
        },
      };

      if (hasError || input.status === 'reconnecting') {
        nextState.recentIncidents = pushIncident(state.recentIncidents, {
          detail: `${resolveRealtimeLabel(input.channel)} · ${resolveRealtimeStatusLabel(
            input.status,
          )}${input.errorMessage ? ` · ${input.errorMessage}` : ''}`,
          kind: 'realtime',
          severity: input.status === 'reconnecting' ? 'warning' : 'danger',
          title:
            input.status === 'reconnecting'
              ? 'Realtime reconectando'
              : 'Falha de realtime',
        });
      }

      return nextState;
    }),
  recordRenderFailure: (input) =>
    set((state) => {
      const nextOccurredAt = new Date().toISOString();
      return {
        ...state,
        recentIncidents: pushIncident(state.recentIncidents, {
          detail: input.errorMessage,
          kind: 'render',
          severity: 'danger',
          title: 'Falha de render',
        }),
        render: {
          ...state.render,
          failures: state.render.failures + 1,
          lastComponentStack: normalizeComponentStack(input.componentStack),
          lastErrorMessage: input.errorMessage,
          lastOccurredAt: nextOccurredAt,
        },
      };
    }),
  reset: () => set(buildInitialState()),
}));

export function recordApiMetric(input: {
  durationMs: number;
  errorMessage?: string | null;
  method: string;
  path: string;
  statusCode?: number | null;
}): void {
  useMobileObservabilityStore.getState().recordApiMetric(input);
}

export function recordPerformanceFpsSample(fps: number): void {
  useMobileObservabilityStore.getState().recordPerformanceFpsSample(fps);
}

export function recordRealtimeEvent(input: {
  channel: MobileRealtimeChannel;
  errorMessage?: string | null;
  status: MobileRealtimeDiagnostics['status'];
}): void {
  useMobileObservabilityStore.getState().recordRealtimeEvent(input);
}

export function recordRenderFailure(input: {
  componentStack?: string | null;
  errorMessage: string;
}): void {
  useMobileObservabilityStore.getState().recordRenderFailure(input);
}

export function resetMobileObservability(): void {
  useMobileObservabilityStore.getState().reset();
}

export function resolveMobileObservabilityEnvironment(): MobileObservabilityEnvironment {
  const explicitEnv = process.env.EXPO_PUBLIC_APP_ENV?.trim().toLowerCase();

  if (explicitEnv === 'production') {
    return 'production';
  }

  if (explicitEnv === 'staging') {
    return 'staging';
  }

  if (explicitEnv === 'test' || process.env.NODE_ENV === 'test') {
    return 'test';
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return 'development';
  }

  return 'production';
}

function buildInitialState(): Omit<MobileObservabilityState, 'recordApiMetric' | 'recordPerformanceFpsSample' | 'recordRealtimeEvent' | 'recordRenderFailure' | 'reset'> {
  return {
    api: {
      averageLatencyMs: null,
      failedRequests: 0,
      lastErrorMessage: null,
      lastLatencyMs: null,
      lastMethod: null,
      lastOccurredAt: null,
      lastPath: null,
      lastStatusCode: null,
      maxLatencyMs: null,
      requests: 0,
      slowRequests: 0,
    },
    performance: {
      averageFps: null,
      lastLowFpsAt: null,
      lastSampleAt: null,
      latestFps: null,
      lowFpsSamples: 0,
      minFps: null,
      sampleCount: 0,
    },
    realtime: {
      faction: {
        errorCount: 0,
        lastErrorMessage: null,
        lastEventAt: null,
        reconnectCount: 0,
        status: 'disconnected',
      },
      region: {
        errorCount: 0,
        lastErrorMessage: null,
        lastEventAt: null,
        reconnectCount: 0,
        status: 'disconnected',
      },
    },
    recentIncidents: [],
    render: {
      crashTrailMode: 'local-buffer',
      environment: resolveMobileObservabilityEnvironment(),
      failures: 0,
      lastComponentStack: null,
      lastErrorMessage: null,
      lastOccurredAt: null,
    },
  };
}

function normalizeMetricPath(path: string): string {
  const trimmed = path.trim();

  if (!trimmed) {
    return '/desconhecido';
  }

  return trimmed.split('?')[0] ?? trimmed;
}

function normalizeComponentStack(componentStack?: string | null): string | null {
  const normalized = componentStack?.trim();
  return normalized ? normalized.slice(0, 320) : null;
}

function pushIncident(
  incidents: MobileDiagnosticIncident[],
  input: Omit<MobileDiagnosticIncident, 'id' | 'occurredAt'>,
): MobileDiagnosticIncident[] {
  const incident: MobileDiagnosticIncident = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  };

  return [incident, ...incidents].slice(0, MAX_RECENT_INCIDENTS);
}

function resolveRealtimeLabel(channel: MobileRealtimeChannel): string {
  return channel === 'faction' ? 'Sala da facção' : 'Mapa regional';
}

function resolveRealtimeStatusLabel(status: MobileRealtimeDiagnostics['status']): string {
  switch (status) {
    case 'connected':
      return 'Conectado';
    case 'connecting':
      return 'Conectando';
    case 'reconnecting':
      return 'Reconectando';
    default:
      return 'Offline';
  }
}

function shouldLogLowFpsIncident(lastLowFpsAt: string | null): boolean {
  if (!lastLowFpsAt) {
    return true;
  }

  return Date.now() - new Date(lastLowFpsAt).getTime() >= 20_000;
}
