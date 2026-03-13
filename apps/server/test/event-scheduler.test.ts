import { RegionId } from '@cs-rio/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  EventSchedulerService,
  type EventSchedulerRepository,
  type SchedulerEventRollDefinition,
} from '../src/services/event-scheduler.js';

const SILENT_LOGGER = {
  error: vi.fn(),
  info: vi.fn(),
};

describe('EventSchedulerService', () => {
  it('creates a regional event when the roll hits and there is no recent cooldown window', async () => {
    const createEvent = vi.fn(async () => {});
    const hasRecentEvent = vi.fn(async () => false);
    const repository: EventSchedulerRepository = {
      createEvent,
      hasRecentEvent,
    };
    const rollDefinitions: SchedulerEventRollDefinition[] = [
      {
        cooldownMs: 12 * 60 * 60 * 1000,
        durationMs: 3 * 60 * 60 * 1000,
        eventType: 'seca_drogas',
        id: 'test_roll',
        rollChance: 0.5,
      },
    ];
    const now = new Date('2026-03-11T12:00:00.000Z');
    const service = new EventSchedulerService({
      logger: SILENT_LOGGER,
      random: () => 0,
      regionIds: [RegionId.Centro],
      repository,
      rollDefinitions,
    });

    const result = await service.runTick(now);

    expect(hasRecentEvent).toHaveBeenCalledWith({
      eventType: 'seca_drogas',
      regionId: RegionId.Centro,
      since: new Date('2026-03-11T00:00:00.000Z'),
    });
    expect(createEvent).toHaveBeenCalledTimes(1);
    expect(createEvent).toHaveBeenCalledWith({
      dataJson: {
        phase: '14.1',
        rolledAt: '2026-03-11T12:00:00.000Z',
        ruleId: 'test_roll',
        source: 'event_scheduler',
      },
      endsAt: new Date('2026-03-11T15:00:00.000Z'),
      eventType: 'seca_drogas',
      regionId: RegionId.Centro,
      startedAt: now,
    });
    expect(result).toEqual({
      createdEvents: [
        {
          endsAt: new Date('2026-03-11T15:00:00.000Z'),
          eventType: 'seca_drogas',
          regionId: RegionId.Centro,
          startedAt: now,
        },
      ],
      skippedByChance: 0,
      skippedByCooldown: 0,
    });
  });

  it('skips the roll when there is a recent event in cooldown for the region', async () => {
    const createEvent = vi.fn(async () => {});
    const hasRecentEvent = vi.fn(async () => true);
    const repository: EventSchedulerRepository = {
      createEvent,
      hasRecentEvent,
    };
    const service = new EventSchedulerService({
      logger: SILENT_LOGGER,
      random: () => 0,
      regionIds: [RegionId.ZonaNorte],
      repository,
      rollDefinitions: [
        {
          cooldownMs: 60 * 60 * 1000,
          durationMs: 30 * 60 * 1000,
          eventType: 'bonecas_china',
          id: 'cooldown_test',
          rollChance: 1,
        },
      ],
    });

    const result = await service.runTick(new Date('2026-03-11T12:00:00.000Z'));

    expect(createEvent).not.toHaveBeenCalled();
    expect(result).toEqual({
      createdEvents: [],
      skippedByChance: 0,
      skippedByCooldown: 1,
    });
  });

  it('skips the roll when randomness does not pass the threshold', async () => {
    const createEvent = vi.fn(async () => {});
    const hasRecentEvent = vi.fn(async () => false);
    const repository: EventSchedulerRepository = {
      createEvent,
      hasRecentEvent,
    };
    const service = new EventSchedulerService({
      logger: SILENT_LOGGER,
      random: () => 0.95,
      regionIds: [RegionId.ZonaSul],
      repository,
      rollDefinitions: [
        {
          cooldownMs: 60 * 60 * 1000,
          durationMs: 45 * 60 * 1000,
          eventType: 'chuva_verao',
          id: 'chance_test',
          rollChance: 0.1,
        },
      ],
    });

    const result = await service.runTick(new Date('2026-03-11T12:00:00.000Z'));

    expect(createEvent).not.toHaveBeenCalled();
    expect(result).toEqual({
      createdEvents: [],
      skippedByChance: 1,
      skippedByCooldown: 0,
    });
  });
});
