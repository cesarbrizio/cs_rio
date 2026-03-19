import {
  ColyseusService,
  createColyseusClientFactory,
  type RealtimeConnectionStatus,
  type RealtimePlayerSnapshot,
  type RealtimeSnapshot,
} from '@cs-rio/domain/realtime';

import { appEnv } from '../config/env';
import { recordRealtimeEvent } from '../features/mobile-observability';

export { ColyseusService };
export type { RealtimeConnectionStatus, RealtimePlayerSnapshot, RealtimeSnapshot };

export const colyseusService = new ColyseusService(
  createColyseusClientFactory(appEnv),
  recordRealtimeEvent,
);
