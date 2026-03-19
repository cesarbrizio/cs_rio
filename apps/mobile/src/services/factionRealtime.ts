import {
  createColyseusClientFactory,
  FactionRealtimeService,
  type FactionRealtimeConnectionStatus,
  type FactionRealtimeSnapshot,
} from '@cs-rio/domain/realtime';

import { appEnv } from '../config/env';
import { recordRealtimeEvent } from '../features/mobile-observability';

export { FactionRealtimeService };
export type { FactionRealtimeConnectionStatus, FactionRealtimeSnapshot };

export const factionRealtimeService = new FactionRealtimeService(
  createColyseusClientFactory(appEnv),
  recordRealtimeEvent,
);
