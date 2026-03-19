import type { EnvPort } from '@cs-rio/platform';
import { Client } from 'colyseus.js';

export function createColyseusClientFactory(env: Pick<EnvPort, 'wsUrl'>) {
  return () => new Client(env.wsUrl);
}
