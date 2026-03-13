import { RegionId } from '@cs-rio/shared';
import { and, eq, gte, isNull } from 'drizzle-orm';
import cron, { type ScheduledTask } from 'node-cron';

import { db } from '../db/client.js';
import { gameEvents } from '../db/schema.js';

export type SchedulerManagedGameEventType = 'bonecas_china' | 'chuva_verao' | 'seca_drogas';

export interface SchedulerEventRollDefinition {
  cooldownMs: number;
  durationMs: number;
  eventType: SchedulerManagedGameEventType;
  id: string;
  rollChance: number;
}

export interface EventSchedulerRepository {
  createEvent(input: EventSchedulerCreateEventInput): Promise<void>;
  hasRecentEvent(input: EventSchedulerHasRecentEventInput): Promise<boolean>;
}

export interface EventSchedulerCreateEventInput {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: SchedulerManagedGameEventType;
  favelaId?: string | null;
  regionId: RegionId | null;
  startedAt: Date;
}

export interface EventSchedulerHasRecentEventInput {
  eventType: SchedulerManagedGameEventType;
  regionId: RegionId | null;
  since: Date;
}

export interface EventSchedulerTickCreatedEvent {
  endsAt: Date;
  eventType: SchedulerManagedGameEventType;
  regionId: RegionId;
  startedAt: Date;
}

export interface EventSchedulerTickResult {
  createdEvents: EventSchedulerTickCreatedEvent[];
  skippedByChance: number;
  skippedByCooldown: number;
}

interface EventSchedulerLogger {
  error(payload: unknown, message?: string): void;
  info(payload: unknown, message?: string): void;
}

export const DEFAULT_EVENT_SCHEDULER_CRON_EXPRESSION = '*/30 * * * *';
export const DEFAULT_EVENT_SCHEDULER_TIMEZONE = 'America/Sao_Paulo';

export const RANDOM_EVENT_ROLL_DEFINITIONS: SchedulerEventRollDefinition[] = [
  {
    cooldownMs: 12 * 60 * 60 * 1000,
    durationMs: 3 * 60 * 60 * 1000,
    eventType: 'seca_drogas',
    id: 'seca_drogas_regional',
    rollChance: 0.025,
  },
  {
    cooldownMs: 18 * 60 * 60 * 1000,
    durationMs: 4 * 60 * 60 * 1000,
    eventType: 'bonecas_china',
    id: 'bonecas_china_regional',
    rollChance: 0.02,
  },
  {
    cooldownMs: 8 * 60 * 60 * 1000,
    durationMs: 2 * 60 * 60 * 1000,
    eventType: 'chuva_verao',
    id: 'chuva_verao_regional',
    rollChance: 0.03,
  },
] as const;

const DEFAULT_REGION_IDS = Object.values(RegionId);

const NOOP_LOGGER: EventSchedulerLogger = {
  error() {},
  info() {},
};

class DrizzleEventSchedulerRepository implements EventSchedulerRepository {
  async createEvent(input: EventSchedulerCreateEventInput): Promise<void> {
    await db.insert(gameEvents).values({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      favelaId: input.favelaId ?? null,
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async hasRecentEvent(input: EventSchedulerHasRecentEventInput): Promise<boolean> {
    const rows = await db
      .select({
        id: gameEvents.id,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.eventType, input.eventType),
          input.regionId === null ? isNull(gameEvents.regionId) : eq(gameEvents.regionId, input.regionId),
          gte(gameEvents.endsAt, input.since),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }
}

export interface EventSchedulerServiceOptions {
  cronExpression?: string;
  logger?: EventSchedulerLogger;
  random?: () => number;
  regionIds?: RegionId[];
  repository?: EventSchedulerRepository;
  rollDefinitions?: SchedulerEventRollDefinition[];
  syncHandlers?: Array<(now: Date) => Promise<void>>;
  timezone?: string;
}

export class EventSchedulerService {
  private readonly cronExpression: string;
  private readonly logger: EventSchedulerLogger;
  private readonly random: () => number;
  private readonly regionIds: RegionId[];
  private readonly repository: EventSchedulerRepository;
  private readonly rollDefinitions: SchedulerEventRollDefinition[];
  private readonly syncHandlers: Array<(now: Date) => Promise<void>>;
  private task: ScheduledTask | null = null;
  private readonly timezone: string;

  constructor(options: EventSchedulerServiceOptions = {}) {
    this.cronExpression = options.cronExpression ?? DEFAULT_EVENT_SCHEDULER_CRON_EXPRESSION;
    this.logger = options.logger ?? NOOP_LOGGER;
    this.random = options.random ?? Math.random;
    this.regionIds = options.regionIds ?? DEFAULT_REGION_IDS;
    this.repository = options.repository ?? new DrizzleEventSchedulerRepository();
    this.rollDefinitions = options.rollDefinitions ?? [...RANDOM_EVENT_ROLL_DEFINITIONS];
    this.syncHandlers = options.syncHandlers ?? [];
    this.timezone = options.timezone ?? DEFAULT_EVENT_SCHEDULER_TIMEZONE;
  }

  async runTick(now: Date = new Date()): Promise<EventSchedulerTickResult> {
    const createdEvents: EventSchedulerTickCreatedEvent[] = [];
    let skippedByChance = 0;
    let skippedByCooldown = 0;

    for (const handler of this.syncHandlers) {
      await handler(now);
    }

    for (const definition of this.rollDefinitions) {
      for (const regionId of this.regionIds) {
        const hasRecentEvent = await this.repository.hasRecentEvent({
          eventType: definition.eventType,
          regionId,
          since: new Date(now.getTime() - definition.cooldownMs),
        });

        if (hasRecentEvent) {
          skippedByCooldown += 1;
          continue;
        }

        if (this.random() > definition.rollChance) {
          skippedByChance += 1;
          continue;
        }

        const endsAt = new Date(now.getTime() + definition.durationMs);
        await this.repository.createEvent({
          dataJson: {
            phase: '14.1',
            rolledAt: now.toISOString(),
            ruleId: definition.id,
            source: 'event_scheduler',
          },
          endsAt,
          eventType: definition.eventType,
          regionId,
          startedAt: now,
        });

        createdEvents.push({
          endsAt,
          eventType: definition.eventType,
          regionId,
          startedAt: now,
        });
      }
    }

    if (createdEvents.length > 0) {
      this.logger.info(
        {
          createdEvents: createdEvents.map((event) => ({
            endsAt: event.endsAt.toISOString(),
            eventType: event.eventType,
            regionId: event.regionId,
            startedAt: event.startedAt.toISOString(),
          })),
          skippedByChance,
          skippedByCooldown,
        },
        'Event scheduler tick criou novas janelas de eventos.',
      );
    }

    return {
      createdEvents,
      skippedByChance,
      skippedByCooldown,
    };
  }

  start(): void {
    if (this.task) {
      return;
    }

    this.task = cron.schedule(
      this.cronExpression,
      () => {
        void this.runTick().catch((error: unknown) => {
          this.logger.error({ error }, 'Falha ao executar tick do event scheduler.');
        });
      },
      {
        timezone: this.timezone,
      },
    );
  }

  async stop(): Promise<void> {
    if (!this.task) {
      return;
    }

    this.task.stop();
    this.task.destroy();
    this.task = null;
  }
}
