import { type KeyValueStore } from '../services/auth.js';

const RESOURCE_STATE_TTL_SECONDS = 90 * 24 * 60 * 60;

export interface TimedResourceState {
  lastDrugUseAt?: number | null;
  lastSyncAt: number;
}

export function buildTimedResourceKey(resource: string, playerId: string): string {
  return `resource:${resource}:${playerId}`;
}

export async function readTimedResourceState(
  keyValueStore: KeyValueStore,
  key: string,
): Promise<TimedResourceState | null> {
  const rawValue = await keyValueStore.get(key);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<TimedResourceState>;

    if (typeof parsed.lastSyncAt !== 'number' || Number.isNaN(parsed.lastSyncAt)) {
      return null;
    }

    return {
      lastDrugUseAt:
        typeof parsed.lastDrugUseAt === 'number' && !Number.isNaN(parsed.lastDrugUseAt)
          ? parsed.lastDrugUseAt
          : null,
      lastSyncAt: parsed.lastSyncAt,
    };
  } catch {
    return null;
  }
}

export async function writeTimedResourceState(
  keyValueStore: KeyValueStore,
  key: string,
  state: TimedResourceState,
): Promise<void> {
  await keyValueStore.set(key, JSON.stringify(state), RESOURCE_STATE_TTL_SECONDS);
}

export function resolveTimedBaseline(
  now: number,
  state: TimedResourceState | null,
  baselineAt?: Date | string | null,
): TimedResourceState {
  if (state) {
    return state;
  }

  const normalizedBaseline = normalizeBaselineAt(baselineAt);

  return {
    lastDrugUseAt: null,
    lastSyncAt: normalizedBaseline ?? now,
  };
}

function normalizeBaselineAt(value?: Date | string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp =
    value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}
