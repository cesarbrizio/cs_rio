import {
  ColyseusService,
  createColyseusClientFactory,
  FactionRealtimeService,
  type RealtimeObservabilityEvent,
} from '@cs-rio/domain/realtime';
import { viteEnv } from '@cs-rio/platform/desktop';

function recordRealtimeEvent(input: RealtimeObservabilityEvent): void {
  if (!import.meta.env.DEV) {
    return;
  }

  console.info('[desktop realtime]', input.channel, input.status, input.errorMessage ?? '');
}

export const colyseusService = new ColyseusService(
  createColyseusClientFactory(viteEnv),
  recordRealtimeEvent,
);

export const factionRealtimeService = new FactionRealtimeService(
  createColyseusClientFactory(viteEnv),
  recordRealtimeEvent,
);
