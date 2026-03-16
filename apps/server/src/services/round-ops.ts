import { randomUUID } from 'node:crypto';

import { RegionId } from '@cs-rio/shared';
import { and, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import { FIXED_FACTIONS, MARKET_SYSTEM_OFFER_SEED } from '../db/seed.js';
import {
  components,
  factions,
  favelaBailes,
  favelaBanditReturns,
  favelas,
  gameEvents,
  marketSystemOffers,
  prisonRecords,
  properties,
  regions,
  round,
  roundFeatureFlagOverrides,
  roundOperationLogs,
  soldiers,
  weapons,
  drugs,
  vests,
  x9Events,
  factionWars,
  propinaPayments,
} from '../db/schema.js';
import { buildBanditReturnSchedule, resolveFavelaBanditTarget } from './favela-force.js';
import { applyFixedFactionStarterTerritories } from './fixed-faction-territories.js';
import { GameConfigService } from './game-config.js';
import { type ConfigOperationCommand, ConfigOperationService } from './config-operations.js';
import {
  resolveDefaultFactionRobberyPolicy,
  resolveFactionInternalSatisfactionDefault,
  resolveRoundLifecycleConfig,
} from './gameplay-config.js';
import { RoundService } from './round.js';
import { GameEventService } from './game-event.js';

type ConfigurableEventType =
  | 'navio_docas'
  | 'operacao_policial'
  | 'blitz_pm'
  | 'faca_na_caveira'
  | 'saidinha_natal'
  | 'carnaval'
  | 'ano_novo_copa'
  | 'operacao_verao';

type RoundOpsOperation =
  | { type: 'set-round-day'; value: number }
  | { type: 'finish-round' }
  | { type: 'start-next-round' }
  | { type: 'snapshot-round-state' }
  | {
      type: 'trigger-event';
      eventType: ConfigurableEventType;
      favelaCode?: string;
      favelaId?: string;
      regionId?: RegionId;
    }
  | {
      type: 'expire-event';
      eventType: ConfigurableEventType;
      favelaCode?: string;
      favelaId?: string;
      regionId?: RegionId;
    }
  | { type: 'enable-event'; eventType: ConfigurableEventType }
  | { type: 'disable-event'; eventType: ConfigurableEventType }
  | { type: 'reseed-fixed-factions' }
  | { type: 'reseed-territories' }
  | { type: 'reseed-system-market' }
  | { type: 'rebuild-world-state' };

function toJsonRecord(value: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value));
}

export interface RoundOpsSelector {
  favelaCode?: string;
  favelaId?: string;
  regionId?: RegionId;
  roundId?: string;
  roundNumber?: number;
}

export interface RoundOpsCommand {
  actor?: string;
  operation: RoundOpsOperation;
  origin?: string;
}

interface RoundRecord {
  endsAt: Date;
  id: string;
  number: number;
  startedAt: Date;
  status: 'active' | 'finished' | 'scheduled';
}

interface FavelaRecord {
  banditsActive: number;
  baseBanditTarget: number;
  code: string;
  controllingFactionId: string | null;
  defaultSatisfaction: number;
  difficulty: number;
  id: string;
  name: string;
  population: number;
  regionId: (typeof favelas.$inferSelect)['regionId'];
  satisfaction: number;
}

interface MarketOfferSeedResolved {
  code: string;
  itemId: string;
  itemType: (typeof MARKET_SYSTEM_OFFER_SEED)[number]['itemType'];
  label: string;
  pricePerUnit: string;
  restockAmount: number;
  restockIntervalGameDays: number;
  sortOrder: number;
  stockAvailable: number;
  stockMax: number;
}

export interface RoundOpsSnapshot {
  config: {
    activeSetCode: string | null;
    featureFlagsCount: number;
    roundId: string | null;
  };
  events: {
    activeDocks: number;
    activePolice: number;
    activeSeasonal: number;
    activeTypes: string[];
  };
  market: {
    activeOffers: number;
    totalOffers: number;
    totalStockAvailable: number;
  };
  round: null | {
    currentGameDay: number;
    id: string;
    number: number;
    remainingSeconds: number;
    status: string;
    totalGameDays: number;
  };
  territory: {
    atWarFavelas: number;
    neutralFavelas: number;
    stateFavelas: number;
    topControllers: Array<{ count: number; label: string }>;
  };
}

export interface RoundOpsResult {
  applied: Array<{
    operationType: RoundOpsOperation['type'];
    summary: string;
  }>;
  batchId: string;
  context: RoundOpsSnapshot;
}

export interface RoundOpsPreviewResult {
  context: RoundOpsSnapshot;
  dryRun: true;
  operations: Array<{
    changed: boolean;
    operationType: RoundOpsOperation['type'];
    summary: string;
  }>;
}

export interface RoundOpsServiceOptions {
  configOperationService?: ConfigOperationService;
  gameConfigService?: GameConfigService;
  gameEventService?: GameEventService;
  now?: () => Date;
  roundService?: RoundService;
}

export class RoundOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoundOpsError';
  }
}

export class RoundOpsService {
  private readonly configOperationService: ConfigOperationService;

  private readonly gameConfigService: GameConfigService;

  private readonly gameEventService: GameEventService;

  private readonly now: () => Date;

  private readonly roundService: RoundService;

  constructor(options: RoundOpsServiceOptions = {}) {
    this.configOperationService = options.configOperationService ?? new ConfigOperationService();
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.gameEventService = options.gameEventService ?? new GameEventService();
    this.now = options.now ?? (() => new Date());
    this.roundService = options.roundService ?? new RoundService({
      gameConfigService: this.gameConfigService,
      now: this.now,
    });
  }

  async applyCommands(
    selector: RoundOpsSelector,
    commands: RoundOpsCommand[],
  ): Promise<RoundOpsResult> {
    if (commands.length === 0) {
      throw new RoundOpsError('Nenhuma operação de rodada foi informada.');
    }

    const batchId = randomUUID();
    const applied: RoundOpsResult['applied'] = [];

    for (const command of commands) {
      const before = await this.buildSnapshot(selector);
      const summary = await this.applyOperation(selector, command.operation);
      const after = await this.buildSnapshot(selector);
      const activeRound = await this.getResolvedRound(selector, { allowMissing: true });

      await db.insert(roundOperationLogs).values({
        actor: command.actor ?? process.env.USER ?? 'local',
        afterJson: toJsonRecord(after),
        batchId,
        beforeJson: toJsonRecord(before),
        eventType: extractEventType(command.operation),
        favelaId: await this.resolveFavelaId(selector, extractFavelaSelector(command.operation)),
        operationType: command.operation.type,
        origin: command.origin ?? 'ops:round',
        payloadJson: toJsonRecord(command.operation),
        regionId: extractRegionId(selector, command.operation) ?? null,
        roundId: activeRound?.id ?? null,
        summary,
      });

      applied.push({
        operationType: command.operation.type,
        summary,
      });
    }

    return {
      applied,
      batchId,
      context: await this.buildSnapshot(selector),
    };
  }

  async close(): Promise<void> {
    await this.roundService.close();
  }

  async previewCommands(
    selector: RoundOpsSelector,
    commands: RoundOpsCommand[],
  ): Promise<RoundOpsPreviewResult> {
    if (commands.length === 0) {
      throw new RoundOpsError('Nenhuma operação de rodada foi informada.');
    }

    const operations: RoundOpsPreviewResult['operations'] = [];

    for (const command of commands) {
      operations.push(await this.previewOperation(selector, command.operation));
    }

    return {
      context: await this.buildSnapshot(selector),
      dryRun: true,
      operations,
    };
  }

  private async applyOperation(
    selector: RoundOpsSelector,
    operation: RoundOpsOperation,
  ): Promise<string> {
    switch (operation.type) {
      case 'set-round-day':
        return this.setRoundDay(selector, operation.value);
      case 'finish-round':
        return this.finishRound(selector);
      case 'start-next-round':
        return this.startNextRound(selector);
      case 'snapshot-round-state':
        return this.snapshotRoundState(selector);
      case 'trigger-event':
        return this.triggerEvent(selector, operation);
      case 'expire-event':
        return this.expireEvent(selector, operation);
      case 'enable-event':
        return this.toggleEvent(selector, operation.eventType, 'active');
      case 'disable-event':
        return this.toggleEvent(selector, operation.eventType, 'inactive');
      case 'reseed-fixed-factions':
        return this.reseedFixedFactions();
      case 'reseed-territories':
        return this.reseedTerritories();
      case 'reseed-system-market':
        return this.reseedSystemMarket();
      case 'rebuild-world-state':
        return this.rebuildWorldState();
      default:
        throw new RoundOpsError('Operação de rodada desconhecida.');
    }
  }

  private async previewOperation(
    selector: RoundOpsSelector,
    operation: RoundOpsOperation,
  ): Promise<{ changed: boolean; operationType: RoundOpsOperation['type']; summary: string }> {
    switch (operation.type) {
      case 'set-round-day': {
        const roundRecord = await this.requireRound(selector);
        const targetDay = requireWholeNumber(operation.value, 'set-round-day');
        const now = this.now();
        const catalog = await this.gameConfigService.getResolvedCatalog({
          now,
          roundId: roundRecord.id,
        });
        const lifecycle = resolveRoundLifecycleConfig(catalog);

        if (targetDay < 1 || targetDay > lifecycle.totalGameDays) {
          throw new RoundOpsError(
            `Dia inválido: ${targetDay}. A rodada aceita dias entre 1 e ${lifecycle.totalGameDays}.`,
          );
        }

        const snapshot = await this.buildSnapshot(selector);

        return {
          changed: snapshot.round?.currentGameDay !== targetDay,
          operationType: operation.type,
          summary: `Dry-run: rodada #${roundRecord.number} iria para o dia ${targetDay}/${lifecycle.totalGameDays}.`,
        };
      }
      case 'finish-round': {
        const roundRecord = await this.requireRound(selector);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: rodada #${roundRecord.number} seria encerrada e a próxima rodada seria aberta.`,
        };
      }
      case 'start-next-round': {
        const now = this.now();
        const activeRound = await this.getResolvedRound(selector, { allowMissing: true });

        return {
          changed: !(activeRound && activeRound.endsAt.getTime() > now.getTime()),
          operationType: operation.type,
          summary:
            activeRound && activeRound.endsAt.getTime() > now.getTime()
              ? `Rodada #${activeRound.number} já está ativa.`
              : 'Dry-run: a próxima rodada seria ativada para playtest.',
        };
      }
      case 'snapshot-round-state': {
        const snapshot = await this.buildSnapshot(selector);
        return {
          changed: false,
          operationType: operation.type,
          summary: snapshot.round
            ? `Dry-run: snapshot da rodada #${snapshot.round.number} no dia ${snapshot.round.currentGameDay}/${snapshot.round.totalGameDays}.`
            : 'Dry-run: snapshot sem rodada ativa.',
        };
      }
      case 'trigger-event': {
        const summary = await this.previewTriggerEvent(selector, operation);
        return {
          changed: true,
          operationType: operation.type,
          summary,
        };
      }
      case 'expire-event': {
        const summary = await this.previewExpireEvent(selector, operation);
        return {
          changed: true,
          operationType: operation.type,
          summary,
        };
      }
      case 'enable-event':
      case 'disable-event': {
        const roundRecord = await this.requireRound(selector);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: evento ${operation.eventType} seria ${
            operation.type === 'enable-event' ? 'ativado' : 'desativado'
          } para a rodada #${roundRecord.number}.`,
        };
      }
      case 'reseed-fixed-factions':
        return {
          changed: true,
          operationType: operation.type,
          summary: 'Dry-run: facções fixas seriam reidratadas para o baseline.',
        };
      case 'reseed-territories':
        return {
          changed: true,
          operationType: operation.type,
          summary: 'Dry-run: territórios seriam resetados para o baseline das facções fixas.',
        };
      case 'reseed-system-market':
        return {
          changed: true,
          operationType: operation.type,
          summary: 'Dry-run: ofertas sistêmicas do mercado seriam reidratadas e reabastecidas.',
        };
      case 'rebuild-world-state':
        return {
          changed: true,
          operationType: operation.type,
          summary: 'Dry-run: mundo-base seria reidratado (eventos, facções, territórios e mercado).',
        };
      default:
        return exhaustiveGuard(operation);
    }
  }

  private async buildSnapshot(selector: RoundOpsSelector): Promise<RoundOpsSnapshot> {
    const now = this.now();
    const center = await this.roundService.getCenter();
    const activeRound = await this.getResolvedRound(selector, { allowMissing: true });
    const [docksStatus, policeStatus, seasonalStatus, catalog, territoryRows, marketRows] =
      await Promise.all([
        this.gameEventService.getDocksStatus(now),
        this.gameEventService.getPoliceStatus(now),
        this.gameEventService.getSeasonalStatus(now),
        this.gameConfigService.getResolvedCatalog({
          now,
          roundId: activeRound?.id ?? center.round.id,
        }),
        db
          .select({
            abbreviation: factions.abbreviation,
            controllingFactionId: favelas.controllingFactionId,
            state: favelas.state,
          })
          .from(favelas)
          .leftJoin(factions, eq(factions.id, favelas.controllingFactionId)),
        db
          .select({
            isActive: marketSystemOffers.isActive,
            stockAvailable: marketSystemOffers.stockAvailable,
          })
          .from(marketSystemOffers),
      ]);

    const topControllers = new Map<string, number>();

    for (const row of territoryRows) {
      if (!row.controllingFactionId) {
        continue;
      }

      const label = row.abbreviation ?? row.controllingFactionId;
      topControllers.set(label, (topControllers.get(label) ?? 0) + 1);
    }

    return {
      config: {
        activeSetCode: catalog.activeSet?.code ?? null,
        featureFlagsCount: catalog.featureFlags.length,
        roundId: catalog.activeRoundId ?? null,
      },
      events: {
        activeDocks: docksStatus.isActive ? 1 : 0,
        activePolice: policeStatus.events.length,
        activeSeasonal: seasonalStatus.events.length,
        activeTypes: [
          ...(docksStatus.isActive ? ['navio_docas'] : []),
          ...policeStatus.events.map((event) => event.eventType),
          ...seasonalStatus.events.map((event) => event.eventType),
        ],
      },
      market: {
        activeOffers: marketRows.filter((row) => row.isActive).length,
        totalOffers: marketRows.length,
        totalStockAvailable: marketRows.reduce(
          (sum, row) => sum + Number(row.stockAvailable ?? 0),
          0,
        ),
      },
      round: {
        currentGameDay: center.round.currentGameDay,
        id: center.round.id,
        number: center.round.number,
        remainingSeconds: center.round.remainingSeconds,
        status: center.round.status,
        totalGameDays: center.round.totalGameDays,
      },
      territory: {
        atWarFavelas: territoryRows.filter((row) => row.state === 'at_war').length,
        neutralFavelas: territoryRows.filter((row) => row.state === 'neutral').length,
        stateFavelas: territoryRows.filter((row) => row.state === 'state').length,
        topControllers: [...topControllers.entries()]
          .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
          .slice(0, 5)
          .map(([label, count]) => ({ count, label })),
      },
    };
  }

  private async setRoundDay(selector: RoundOpsSelector, targetDay: number): Promise<string> {
    const roundRecord = await this.requireRound(selector);
    const nextDay = requireWholeNumber(targetDay, 'set-round-day');
    const now = this.now();
    const catalog = await this.gameConfigService.getResolvedCatalog({ now, roundId: roundRecord.id });
    const lifecycle = resolveRoundLifecycleConfig(catalog);

    if (nextDay < 1 || nextDay > lifecycle.totalGameDays) {
      throw new RoundOpsError(
        `Dia inválido: ${nextDay}. A rodada aceita dias entre 1 e ${lifecycle.totalGameDays}.`,
      );
    }

    const startedAt = new Date(now.getTime() - (nextDay - 1) * lifecycle.gameDayRealMs);
    const endsAt = new Date(startedAt.getTime() + lifecycle.realDurationMs);

    await db
      .update(round)
      .set({
        endsAt,
        startedAt,
      })
      .where(eq(round.id, roundRecord.id));

    return `Rodada #${roundRecord.number} ajustada para o dia ${nextDay}/${lifecycle.totalGameDays}.`;
  }

  private async finishRound(selector: RoundOpsSelector): Promise<string> {
    const roundRecord = await this.requireRound(selector);
    const now = this.now();

    await db
      .update(round)
      .set({
        endsAt: new Date(now.getTime() - 1_000),
      })
      .where(eq(round.id, roundRecord.id));

    await this.roundService.syncLifecycle(now);
    const nextRound = await this.requireRound({});

    return `Rodada #${roundRecord.number} encerrada. Rodada #${nextRound.number} aberta.`;
  }

  private async startNextRound(selector: RoundOpsSelector): Promise<string> {
    const now = this.now();
    const activeRound = await this.getResolvedRound(selector, { allowMissing: true });

    if (activeRound && activeRound.endsAt.getTime() > now.getTime()) {
      return `Rodada #${activeRound.number} já está ativa.`;
    }

    await this.roundService.syncLifecycle(now);
    const resolvedRound = await this.requireRound({});

    return `Rodada #${resolvedRound.number} está ativa para playtest.`;
  }

  private async snapshotRoundState(selector: RoundOpsSelector): Promise<string> {
    const snapshot = await this.buildSnapshot(selector);

    if (!snapshot.round) {
      return 'Snapshot gerado sem rodada ativa.';
    }

    return `Snapshot da rodada #${snapshot.round.number} gerado no dia ${snapshot.round.currentGameDay}/${snapshot.round.totalGameDays}.`;
  }

  private async triggerEvent(
    selector: RoundOpsSelector,
    operation: Extract<RoundOpsOperation, { type: 'trigger-event' }>,
  ): Promise<string> {
    const now = this.now();
    const catalog = await this.gameConfigService.getResolvedCatalog({
      now,
      roundId: (await this.requireRound(selector)).id,
    });

    switch (operation.eventType) {
      case 'navio_docas':
        return this.triggerDocksEvent(now, catalog, operation.regionId ?? selector.regionId);
      case 'operacao_policial':
        return this.triggerOperacaoPolicial(now, catalog, selector, operation);
      case 'blitz_pm':
        return this.triggerBlitzPm(now, catalog, operation.regionId ?? selector.regionId);
      case 'faca_na_caveira':
        return this.triggerFacaNaCaveira(now, catalog, selector, operation);
      case 'saidinha_natal':
        return this.triggerSaidinhaNatal(now, catalog);
      case 'carnaval':
      case 'ano_novo_copa':
      case 'operacao_verao':
        return this.triggerSeasonalEvent(now, catalog, operation.eventType, operation.regionId ?? selector.regionId);
      default:
        throw new RoundOpsError(`Evento não suportado: ${operation.eventType}.`);
    }
  }

  private async previewTriggerEvent(
    selector: RoundOpsSelector,
    operation: Extract<RoundOpsOperation, { type: 'trigger-event' }>,
  ): Promise<string> {
    const now = this.now();
    const catalog = await this.gameConfigService.getResolvedCatalog({
      now,
      roundId: (await this.requireRound(selector)).id,
    });

    switch (operation.eventType) {
      case 'navio_docas': {
        const definition = this.resolveEventDefinition(catalog, 'navio_docas', {
          regionIds: [RegionId.Centro],
        });
        const targetRegion = operation.regionId ?? selector.regionId ?? normalizeRegionArray(definition.regionIds)[0] ?? RegionId.Centro;
        return `Dry-run: Navio nas Docas seria disparado manualmente em ${targetRegion}.`;
      }
      case 'operacao_policial': {
        const favela = await this.requireFavela(selector, operation);
        return `Dry-run: Operação Policial seria disparada em ${favela.name}.`;
      }
      case 'blitz_pm': {
        const targetRegion = operation.regionId ?? selector.regionId ?? RegionId.Centro;
        const [region] = await db
          .select({ id: regions.id })
          .from(regions)
          .where(eq(regions.id, targetRegion))
          .limit(1);
        if (!region) {
          throw new RoundOpsError(`Região inválida para blitz: ${targetRegion}.`);
        }
        return `Dry-run: Blitz da PM seria disparada em ${targetRegion}.`;
      }
      case 'faca_na_caveira': {
        const favela = await this.requireFavela(selector, operation);
        return `Dry-run: Faca na Caveira seria disparado em ${favela.name}.`;
      }
      case 'saidinha_natal':
        return 'Dry-run: Saidinha de Natal liberaria presos e retornos de bandidos pendentes.';
      case 'carnaval':
      case 'ano_novo_copa':
      case 'operacao_verao': {
        const targetRegion =
          operation.regionId ??
          selector.regionId ??
          (operation.eventType === 'operacao_verao' ? RegionId.ZonaSul : RegionId.Centro);
        return `Dry-run: evento sazonal ${operation.eventType} seria disparado em ${targetRegion}.`;
      }
      default:
        return exhaustiveGuard(operation.eventType);
    }
  }

  private async expireEvent(
    selector: RoundOpsSelector,
    operation: Extract<RoundOpsOperation, { type: 'expire-event' }>,
  ): Promise<string> {
    const now = this.now();
    const favelaId = await this.resolveFavelaId(selector, operation);
    const regionId = extractRegionId(selector, operation);
    const filters = [
      eq(gameEvents.eventType, operation.eventType),
      gt(gameEvents.endsAt, now),
    ];

    if (regionId) {
      filters.push(eq(gameEvents.regionId, regionId));
    }

    if (favelaId) {
      filters.push(eq(gameEvents.favelaId, favelaId));
    }

    const expired = await db
      .update(gameEvents)
      .set({
        endsAt: now,
      })
      .where(and(...filters))
      .returning({ id: gameEvents.id });

    return `${expired.length} evento(s) ${operation.eventType} expirado(s) manualmente.`;
  }

  private async previewExpireEvent(
    selector: RoundOpsSelector,
    operation: Extract<RoundOpsOperation, { type: 'expire-event' }>,
  ): Promise<string> {
    const favelaId = await this.resolveFavelaId(selector, operation);
    const regionId = extractRegionId(selector, operation);
    const filters = [eq(gameEvents.eventType, operation.eventType)];

    if (regionId) {
      filters.push(eq(gameEvents.regionId, regionId));
    }

    if (favelaId) {
      filters.push(eq(gameEvents.favelaId, favelaId));
    }

    const rows = await db
      .select({ id: gameEvents.id })
      .from(gameEvents)
      .where(and(...filters))
      .limit(20);

    return rows.length > 0
      ? `Dry-run: ${rows.length} evento(s) ${operation.eventType} seriam expirados manualmente.`
      : `Nenhum evento ${operation.eventType} foi encontrado com os filtros informados.`;
  }

  private async toggleEvent(
    selector: RoundOpsSelector,
    eventType: ConfigurableEventType,
    status: 'active' | 'inactive',
  ): Promise<string> {
    const targetRound = await this.requireRound(selector);
    const key = `events.${eventType}.enabled`;
    const command: ConfigOperationCommand = {
      actor: process.env.USER ?? 'local',
      origin: 'ops:round',
      roundSelector: { id: targetRound.id, mode: 'id' },
      scope: 'event_type',
      status,
      targetKey: eventType,
      type: 'upsert_round_feature_flag',
      key,
      payloadJson: {
        eventType,
        source: 'ops:round',
      },
    } as ConfigOperationCommand;

    await this.configOperationService.applyCommand(command);

    return `Evento ${eventType} ${status === 'active' ? 'ativado' : 'desativado'} para a rodada #${targetRound.number}.`;
  }

  private async reseedFixedFactions(): Promise<string> {
    const now = this.now();
    const catalog = await this.gameConfigService.getResolvedCatalog({ now, roundId: null });
    const defaultInternalSatisfaction = resolveFactionInternalSatisfactionDefault(catalog);
    const defaultRobberyPolicy = resolveDefaultFactionRobberyPolicy(catalog);
    let inserted = 0;
    let updated = 0;

    for (const factionSeed of FIXED_FACTIONS) {
      const [existing] = await db
        .select({
          id: factions.id,
        })
        .from(factions)
        .where(eq(factions.templateCode, factionSeed.templateCode))
        .limit(1);

      const payload = {
        abbreviation: factionSeed.abbreviation,
        bankDrugs: 0,
        bankMoney: '0',
        description: factionSeed.description,
        initialTerritory: factionSeed.initialTerritory,
        internalSatisfaction: defaultInternalSatisfaction,
        isActive: true,
        isFixed: true,
        leaderId: null,
        name: factionSeed.name,
        points: 0,
        robberyPolicyJson: toJsonRecord(defaultRobberyPolicy),
        sortOrder: factionSeed.sortOrder,
        templateCode: factionSeed.templateCode,
        thematicBonus: factionSeed.thematicBonus,
      };

      if (existing) {
        await db
          .update(factions)
          .set(payload)
          .where(eq(factions.id, existing.id));
        updated += 1;
        continue;
      }

      await db.insert(factions).values(payload);
      inserted += 1;
    }

    return `Facções fixas reidratadas (${inserted} criadas, ${updated} atualizadas).`;
  }

  private async reseedTerritories(): Promise<string> {
    const now = this.now();
    const catalog = await this.gameConfigService.getResolvedCatalog({ now, roundId: null });
    const defaultInternalSatisfaction = resolveFactionInternalSatisfactionDefault(catalog);
    const defaultRobberyPolicy = resolveDefaultFactionRobberyPolicy(catalog);

    await db.transaction(async (tx) => {
      await tx.delete(factionWars);
      await tx.delete(x9Events);
      await tx.delete(propinaPayments);
      await tx.delete(favelaBailes);
      await tx.delete(favelaBanditReturns);

      await tx
        .update(regions)
        .set({
          policePressure: sql`${regions.defaultPolicePressure}`,
        });

      const favelaRows = await tx
        .select({
          baseBanditTarget: favelas.baseBanditTarget,
          defaultSatisfaction: favelas.defaultSatisfaction,
          difficulty: favelas.difficulty,
          id: favelas.id,
          population: favelas.population,
        })
        .from(favelas);

      for (const row of favelaRows) {
        await tx
          .update(favelas)
          .set({
            banditsActive: resolveFavelaBanditTarget({
              baseBanditTarget: row.baseBanditTarget,
              difficulty: row.difficulty,
              internalSatisfaction: null,
              population: row.population,
              state: 'neutral',
            }),
            banditsArrested: 0,
            banditsDeadRecent: 0,
            banditsSyncedAt: now,
            contestingFactionId: null,
            controllingFactionId: null,
            defaultSatisfaction: row.defaultSatisfaction,
            lastX9RollAt: now,
            propinaDiscountRate: '0',
            propinaDueDate: null,
            propinaLastPaidAt: null,
            propinaNegotiatedAt: null,
            propinaNegotiatedByPlayerId: null,
            propinaValue: '0',
            satisfaction: row.defaultSatisfaction,
            satisfactionSyncedAt: now,
            stabilizationEndsAt: null,
            state: 'neutral',
            stateControlledUntil: null,
            warDeclaredAt: null,
          })
          .where(eq(favelas.id, row.id));
      }

      await tx
        .update(factions)
        .set({
          bankDrugs: 0,
          bankMoney: '0',
          internalSatisfaction: defaultInternalSatisfaction,
          points: 0,
          robberyPolicyJson: toJsonRecord(defaultRobberyPolicy),
        })
        .where(eq(factions.isFixed, true));

      await applyFixedFactionStarterTerritories(tx as never, now);
    });

    return 'Territórios resetados para o baseline das facções fixas.';
  }

  private async reseedSystemMarket(): Promise<string> {
    const now = this.now();
    const roundCycle = await this.readCurrentRoundCycle();
    const offers = await this.resolveMarketOfferSeedRows();

    if (offers.length === 0) {
      return 'Nenhuma oferta sistêmica válida pôde ser reidratada.';
    }

    await db
      .insert(marketSystemOffers)
      .values(
        offers.map((offer) => ({
          ...offer,
          isActive: true,
          lastRestockedGameDay: roundCycle.currentGameDay,
          lastRestockedRoundId: roundCycle.currentRoundId,
        })),
      )
      .onConflictDoUpdate({
        target: marketSystemOffers.code,
        set: {
          isActive: sql`excluded.is_active`,
          itemId: sql`excluded.item_id`,
          itemType: sql`excluded.item_type`,
          label: sql`excluded.label`,
          lastRestockedGameDay: sql`excluded.last_restocked_game_day`,
          lastRestockedRoundId: sql`excluded.last_restocked_round_id`,
          pricePerUnit: sql`excluded.price_per_unit`,
          restockAmount: sql`excluded.restock_amount`,
          restockIntervalGameDays: sql`excluded.restock_interval_game_days`,
          sortOrder: sql`excluded.sort_order`,
          stockAvailable: sql`excluded.stock_available`,
          stockMax: sql`excluded.stock_max`,
          updatedAt: now,
        },
      });

    return `${offers.length} oferta(s) sistêmica(s) reidratadas e reabastecidas.`;
  }

  private async rebuildWorldState(): Promise<string> {
    const now = this.now();
    const activeRound = await this.getResolvedRound({}, { allowMissing: true });

    await db.transaction(async (tx) => {
      await tx
        .update(gameEvents)
        .set({
          endsAt: now,
        })
        .where(gt(gameEvents.endsAt, now));

      if (activeRound) {
        await tx
          .delete(roundFeatureFlagOverrides)
          .where(eq(roundFeatureFlagOverrides.roundId, activeRound.id));
      }
    });

    const [factionsSummary, territoriesSummary, marketSummary] = await Promise.all([
      this.reseedFixedFactions(),
      this.reseedTerritories(),
      this.reseedSystemMarket(),
    ]);

    return `Mundo-base reidratado: ${factionsSummary} ${territoriesSummary} ${marketSummary}`;
  }

  private async triggerDocksEvent(
    now: Date,
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
    regionId?: RegionId,
  ): Promise<string> {
    const definition = this.resolveEventDefinition(catalog, 'navio_docas', {
      durationMs: 6 * 60 * 60 * 1000,
      headline: 'Navio nas Docas: janela premium manual para playtest.',
      regionIds: [RegionId.Centro],
    });
    const targetRegion = regionId ?? normalizeRegionArray(definition.regionIds)[0] ?? RegionId.Centro;

    await db.insert(gameEvents).values({
      dataJson: {
        headline: asString(definition.headline, 'Navio nas Docas'),
        manual: true,
        phase: 'ops:round',
        source: 'ops:round',
      },
      endsAt: new Date(now.getTime() + asInteger(definition.durationMs, 6 * 60 * 60 * 1000)),
      eventType: 'navio_docas',
      regionId: targetRegion,
      startedAt: now,
    });

    return `Navio nas Docas disparado manualmente em ${targetRegion}.`;
  }

  private async triggerOperacaoPolicial(
    now: Date,
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
    selector: RoundOpsSelector,
    operation: Extract<RoundOpsOperation, { type: 'trigger-event' }>,
  ): Promise<string> {
    const favela = await this.requireFavela(selector, operation);
    const definition = this.resolveEventDefinition(catalog, 'operacao_policial', {
      banditArrestRateMax: 0.22,
      banditArrestRateMin: 0.12,
      durationMs: 2 * 60 * 60 * 1000,
      headline: 'Operação policial manual em andamento.',
      pressureIncreaseBase: 12,
      satisfactionPenaltyBase: 8,
    });
    const [region] = await db
      .select({
        id: regions.id,
        policePressure: regions.policePressure,
      })
      .from(regions)
      .where(eq(regions.id, favela.regionId))
      .limit(1);

    if (!region) {
      throw new RoundOpsError('Região da favela não encontrada.');
    }

    const arrestRate = midpoint(
      asNumber(definition.banditArrestRateMin, 0.12),
      asNumber(definition.banditArrestRateMax, 0.22),
    );
    const banditsArrested = Math.min(
      favela.banditsActive,
      Math.max(0, Math.round(favela.banditsActive * arrestRate)),
    );
    const nextSatisfaction = clamp(
      favela.satisfaction - asInteger(definition.satisfactionPenaltyBase, 8),
      0,
      100,
    );
    const nextPolicePressure = clamp(
      region.policePressure + asInteger(definition.pressureIncreaseBase, 12),
      0,
      100,
    );

    await db.transaction(async (tx) => {
      await tx
        .update(regions)
        .set({
          policePressure: nextPolicePressure,
        })
        .where(eq(regions.id, region.id));

      await tx
        .update(favelas)
        .set({
          banditsActive: Math.max(0, favela.banditsActive - banditsArrested),
          banditsArrested: sql`${favelas.banditsArrested} + ${banditsArrested}`,
          satisfaction: nextSatisfaction,
          satisfactionSyncedAt: now,
        })
        .where(eq(favelas.id, favela.id));

      if (banditsArrested > 0) {
        const banditReturn = buildBanditReturnSchedule({
          now,
          quantity: banditsArrested,
          random: () => 0.5,
        });

        await tx.insert(favelaBanditReturns).values({
          favelaId: favela.id,
          quantity: banditsArrested,
          releaseAt: banditReturn.releaseAt,
          returnFlavor: banditReturn.flavor,
        });
      }

      await tx.insert(gameEvents).values({
        dataJson: {
          banditsArrested,
          headline: asString(definition.headline, 'Operação policial'),
          manual: true,
          phase: 'ops:round',
          policePressureAfter: nextPolicePressure,
          policePressureBefore: region.policePressure,
          satisfactionAfter: nextSatisfaction,
          satisfactionBefore: favela.satisfaction,
          source: 'ops:round',
        },
        endsAt: new Date(now.getTime() + asInteger(definition.durationMs, 2 * 60 * 60 * 1000)),
        eventType: 'operacao_policial',
        favelaId: favela.id,
        regionId: favela.regionId,
        startedAt: now,
      });
    });

    return `Operação policial disparada em ${favela.name}.`;
  }

  private async triggerBlitzPm(
    now: Date,
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
    regionId?: RegionId,
  ): Promise<string> {
    const targetRegion = regionId ?? RegionId.Centro;
    const definition = this.resolveEventDefinition(catalog, 'blitz_pm', {
      durationMs: 90 * 60 * 1000,
      headline: 'Blitz da PM manual em andamento.',
      pressureIncreaseBase: 10,
      satisfactionPenaltyBase: 6,
    });
    const [region] = await db
      .select({
        id: regions.id,
        policePressure: regions.policePressure,
      })
      .from(regions)
      .where(eq(regions.id, targetRegion))
      .limit(1);

    if (!region) {
      throw new RoundOpsError(`Região inválida para blitz: ${targetRegion}.`);
    }

    const nextPolicePressure = clamp(
      region.policePressure + asInteger(definition.pressureIncreaseBase, 10),
      0,
      100,
    );
    const satisfactionPenalty = asInteger(definition.satisfactionPenaltyBase, 6);

    await db.transaction(async (tx) => {
      await tx
        .update(regions)
        .set({
          policePressure: nextPolicePressure,
        })
        .where(eq(regions.id, targetRegion));

      await tx
        .update(favelas)
        .set({
          satisfaction: sql`greatest(${favelas.satisfaction} - ${satisfactionPenalty}, 0)`,
          satisfactionSyncedAt: now,
        })
        .where(and(eq(favelas.regionId, targetRegion), isNotNull(favelas.controllingFactionId)));

      await tx.insert(gameEvents).values({
        dataJson: {
          headline: asString(definition.headline, 'Blitz da PM'),
          manual: true,
          phase: 'ops:round',
          policePressureAfter: nextPolicePressure,
          policePressureBefore: region.policePressure,
          source: 'ops:round',
        },
        endsAt: new Date(now.getTime() + asInteger(definition.durationMs, 90 * 60 * 1000)),
        eventType: 'blitz_pm',
        regionId: targetRegion,
        startedAt: now,
      });
    });

    return `Blitz da PM disparada manualmente em ${targetRegion}.`;
  }

  private async triggerFacaNaCaveira(
    now: Date,
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
    selector: RoundOpsSelector,
    operation: Extract<RoundOpsOperation, { type: 'trigger-event' }>,
  ): Promise<string> {
    const favela = await this.requireFavela(selector, operation);
    const definition = this.resolveEventDefinition(catalog, 'faca_na_caveira', {
      banditKillRateMax: 0.17,
      banditKillRateMin: 0.12,
      durationMs: 75 * 60 * 1000,
      headline: 'Faca na Caveira manual em andamento.',
      internalSatisfactionPenalty: 10,
      pressureFloor: 15,
      pressureReduction: 20,
      satisfactionPenalty: 14,
      soldiersLossRateMax: 0.05,
      soldiersLossRateMin: 0.02,
    });
    const [region] = await db
      .select({
        id: regions.id,
        policePressure: regions.policePressure,
      })
      .from(regions)
      .where(eq(regions.id, favela.regionId))
      .limit(1);

    if (!region) {
      throw new RoundOpsError('Região da favela não encontrada.');
    }

    const soldierRows = await db
      .select({
        propertyId: properties.id,
        soldierId: soldiers.id,
      })
      .from(properties)
      .innerJoin(soldiers, eq(soldiers.propertyId, properties.id))
      .where(eq(properties.favelaId, favela.id));

    const soldierIds = soldierRows.map((row) => row.soldierId);
    const soldierLossRate = midpoint(
      asNumber(definition.soldiersLossRateMin, 0.02),
      asNumber(definition.soldiersLossRateMax, 0.05),
    );
    const banditLossRate = midpoint(
      asNumber(definition.banditKillRateMin, 0.12),
      asNumber(definition.banditKillRateMax, 0.17),
    );
    const soldiersLost = Math.min(
      soldierIds.length,
      Math.max(0, Math.round(soldierIds.length * soldierLossRate)),
    );
    const banditsKilled = Math.min(
      favela.banditsActive,
      Math.max(0, Math.round(favela.banditsActive * banditLossRate)),
    );
    const nextSatisfaction = clamp(
      favela.satisfaction - asInteger(definition.satisfactionPenalty, 14),
      0,
      100,
    );
    const nextPolicePressure = clamp(
      region.policePressure - asInteger(definition.pressureReduction, 20),
      asInteger(definition.pressureFloor, 15),
      100,
    );

    await db.transaction(async (tx) => {
      await tx
        .update(regions)
        .set({
          policePressure: nextPolicePressure,
        })
        .where(eq(regions.id, region.id));

      if (soldiersLost > 0) {
        const lostIds = soldierIds.slice(0, soldiersLost);
        await tx.delete(soldiers).where(inArray(soldiers.id, lostIds));

        const lossByPropertyId = new Map<string, number>();

        for (const row of soldierRows.filter((row) => lostIds.includes(row.soldierId))) {
          lossByPropertyId.set(row.propertyId, (lossByPropertyId.get(row.propertyId) ?? 0) + 1);
        }

        for (const [propertyId, count] of lossByPropertyId.entries()) {
          await tx
            .update(properties)
            .set({
              soldiersCount: sql`greatest(${properties.soldiersCount} - ${count}, 0)`,
            })
            .where(eq(properties.id, propertyId));
        }
      }

      await tx
        .update(favelas)
        .set({
          banditsActive: Math.max(0, favela.banditsActive - banditsKilled),
          banditsDeadRecent: sql`${favelas.banditsDeadRecent} + ${banditsKilled}`,
          satisfaction: nextSatisfaction,
          satisfactionSyncedAt: now,
        })
        .where(eq(favelas.id, favela.id));

      if (favela.controllingFactionId) {
        await tx
          .update(factions)
          .set({
            internalSatisfaction: sql`greatest(${factions.internalSatisfaction} - ${asInteger(
              definition.internalSatisfactionPenalty,
              10,
            )}, 0)`,
          })
          .where(eq(factions.id, favela.controllingFactionId));
      }

      await tx.insert(gameEvents).values({
        dataJson: {
          banditsKilledEstimate: banditsKilled,
          headline: asString(definition.headline, 'Faca na Caveira'),
          manual: true,
          phase: 'ops:round',
          policePressureAfter: nextPolicePressure,
          policePressureBefore: region.policePressure,
          satisfactionAfter: nextSatisfaction,
          satisfactionBefore: favela.satisfaction,
          soldiersLost,
          source: 'ops:round',
        },
        endsAt: new Date(now.getTime() + asInteger(definition.durationMs, 75 * 60 * 1000)),
        eventType: 'faca_na_caveira',
        favelaId: favela.id,
        regionId: favela.regionId,
        startedAt: now,
      });
    });

    return `Faca na Caveira disparado manualmente em ${favela.name}.`;
  }

  private async triggerSaidinhaNatal(
    now: Date,
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
  ): Promise<string> {
    const definition = this.resolveEventDefinition(catalog, 'saidinha_natal', {
      durationMs: 3 * 60 * 60 * 1000,
      headline: 'Saidinha de Natal manual liberada.',
    });
    const activePrisoners = await db
      .select({
        playerId: prisonRecords.playerId,
      })
      .from(prisonRecords)
      .where(gt(prisonRecords.releaseAt, now));
    const releasedPlayerIds = [...new Set(activePrisoners.map((row) => row.playerId))];
    const banditReturnRows = await db
      .select({
        favelaId: favelaBanditReturns.favelaId,
        id: favelaBanditReturns.id,
        quantity: favelaBanditReturns.quantity,
      })
      .from(favelaBanditReturns);

    await db.transaction(async (tx) => {
      if (releasedPlayerIds.length > 0) {
        await tx
          .update(prisonRecords)
          .set({
            releaseAt: now,
            releasedEarlyBy: null,
          })
          .where(gt(prisonRecords.releaseAt, now));
      }

      if (banditReturnRows.length > 0) {
        const quantityByFavelaId = new Map<string, number>();

        for (const row of banditReturnRows) {
          quantityByFavelaId.set(row.favelaId, (quantityByFavelaId.get(row.favelaId) ?? 0) + row.quantity);
        }

        await tx.delete(favelaBanditReturns);

        for (const [favelaId, quantity] of quantityByFavelaId.entries()) {
          await tx
            .update(favelas)
            .set({
              banditsActive: sql`${favelas.banditsActive} + ${quantity}`,
              banditsArrested: sql`greatest(${favelas.banditsArrested} - ${quantity}, 0)`,
            })
            .where(eq(favelas.id, favelaId));
        }
      }

      await tx.insert(gameEvents).values({
        dataJson: {
          headline: asString(definition.headline, 'Saidinha de Natal'),
          manual: true,
          phase: 'ops:round',
          releasedBanditsEstimate: banditReturnRows.reduce((sum, row) => sum + row.quantity, 0),
          releasedPlayerIds,
          releasedPlayers: releasedPlayerIds.length,
          source: 'ops:round',
        },
        endsAt: new Date(now.getTime() + asInteger(definition.durationMs, 3 * 60 * 60 * 1000)),
        eventType: 'saidinha_natal',
        startedAt: now,
      });
    });

    return `Saidinha de Natal disparada manualmente (${releasedPlayerIds.length} preso(s) liberado(s)).`;
  }

  private async triggerSeasonalEvent(
    now: Date,
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
    eventType: Extract<ConfigurableEventType, 'carnaval' | 'ano_novo_copa' | 'operacao_verao'>,
    regionId?: RegionId,
  ): Promise<string> {
    const fallbackRegion =
      eventType === 'operacao_verao'
        ? RegionId.ZonaSul
        : RegionId.Centro;
    const definition = this.resolveEventDefinition(catalog, eventType, {
      bonusSummary: [] as string[],
      durationMs: eventType === 'carnaval' ? 42 * 60 * 60 * 1000 : 18 * 60 * 60 * 1000,
      headline: `Evento sazonal manual: ${eventType}.`,
      regionIds: [fallbackRegion],
    });
    const targetRegion = regionId ?? normalizeRegionArray(definition.regionIds)[0] ?? fallbackRegion;

    await db.insert(gameEvents).values({
      dataJson: {
        bonusSummary: asStringArray(definition.bonusSummary),
        headline: asString(definition.headline, `Evento sazonal: ${eventType}`),
        manual: true,
        phase: 'ops:round',
        source: 'ops:round',
      },
      endsAt: new Date(
        now.getTime() +
          asInteger(
            definition.durationMs,
            eventType === 'carnaval' ? 42 * 60 * 60 * 1000 : 18 * 60 * 60 * 1000,
          ),
      ),
      eventType,
      regionId: targetRegion,
      startedAt: now,
    });

    return `Evento sazonal ${eventType} disparado manualmente em ${targetRegion}.`;
  }

  private resolveEventDefinition<T extends Record<string, unknown>>(
    catalog: Awaited<ReturnType<GameConfigService['getResolvedCatalog']>>,
    eventType: ConfigurableEventType,
    fallback: T,
  ): T {
    const entry =
      catalog.entries.find(
        (candidate) =>
          candidate.scope === 'event_type' &&
          candidate.targetKey === eventType &&
          candidate.key === 'event.definition',
      ) ?? null;

    if (!entry) {
      return fallback;
    }

    return {
      ...fallback,
      ...entry.valueJson,
    };
  }

  private async resolveMarketOfferSeedRows(): Promise<MarketOfferSeedResolved[]> {
    const [weaponRows, vestRows, drugRows, componentRows] = await Promise.all([
      db.select({ code: weapons.code, id: weapons.id }).from(weapons),
      db.select({ code: vests.code, id: vests.id }).from(vests),
      db.select({ code: drugs.code, id: drugs.id }).from(drugs),
      db.select({ code: components.code, id: components.id }).from(components),
    ]);

    const weaponIdsByCode = new Map(weaponRows.map((row) => [row.code, row.id]));
    const vestIdsByCode = new Map(vestRows.map((row) => [row.code, row.id]));
    const drugIdsByCode = new Map(drugRows.map((row) => [row.code, row.id]));
    const componentIdsByCode = new Map(componentRows.map((row) => [row.code, row.id]));

    return MARKET_SYSTEM_OFFER_SEED.flatMap((offer) => {
      const itemId =
        offer.itemType === 'weapon'
          ? weaponIdsByCode.get(offer.itemCode)
          : offer.itemType === 'vest'
            ? vestIdsByCode.get(offer.itemCode)
            : offer.itemType === 'drug'
              ? drugIdsByCode.get(offer.itemCode)
              : componentIdsByCode.get(offer.itemCode);

      if (!itemId) {
        return [];
      }

      return [
        {
          code: offer.code,
          itemId,
          itemType: offer.itemType,
          label: offer.label,
          pricePerUnit: offer.pricePerUnit,
          restockAmount: offer.restockAmount,
          restockIntervalGameDays: offer.restockIntervalGameDays,
          sortOrder: offer.sortOrder,
          stockAvailable: offer.stockAvailable,
          stockMax: offer.stockMax,
        },
      ];
    });
  }

  private async readCurrentRoundCycle(): Promise<{
    currentGameDay: number;
    currentRoundId: string | null;
  }> {
    const center = await this.roundService.getCenter();
    return {
      currentGameDay: center.round.currentGameDay,
      currentRoundId: center.round.id,
    };
  }

  private async requireRound(selector: RoundOpsSelector): Promise<RoundRecord> {
    const roundRecord = await this.getResolvedRound(selector, { allowMissing: false });
    if (!roundRecord) {
      throw new RoundOpsError('Nenhuma rodada ativa foi encontrada.');
    }

    return roundRecord;
  }

  private async getResolvedRound(
    selector: RoundOpsSelector,
    options: { allowMissing: boolean },
  ): Promise<RoundRecord | null> {
    if (selector.roundId) {
      const [byId] = await db
        .select({
          endsAt: round.endsAt,
          id: round.id,
          number: round.number,
          startedAt: round.startedAt,
          status: round.status,
        })
        .from(round)
        .where(eq(round.id, selector.roundId))
        .limit(1);

      if (!byId && !options.allowMissing) {
        throw new RoundOpsError(`Rodada não encontrada: ${selector.roundId}.`);
      }

      return byId ?? null;
    }

    if (selector.roundNumber !== undefined) {
      const [byNumber] = await db
        .select({
          endsAt: round.endsAt,
          id: round.id,
          number: round.number,
          startedAt: round.startedAt,
          status: round.status,
        })
        .from(round)
        .where(eq(round.number, selector.roundNumber))
        .limit(1);

      if (!byNumber && !options.allowMissing) {
        throw new RoundOpsError(`Rodada não encontrada: #${selector.roundNumber}.`);
      }

      return byNumber ?? null;
    }

    const [activeRound] = await db
      .select({
        endsAt: round.endsAt,
        id: round.id,
        number: round.number,
        startedAt: round.startedAt,
        status: round.status,
      })
      .from(round)
      .where(eq(round.status, 'active'))
      .orderBy(desc(round.startedAt))
      .limit(1);

    if (!activeRound && !options.allowMissing) {
      throw new RoundOpsError('Nenhuma rodada ativa foi encontrada.');
    }

    return activeRound ?? null;
  }

  private async requireFavela(
    selector: RoundOpsSelector,
    operation?: { favelaCode?: string; favelaId?: string },
  ): Promise<FavelaRecord> {
    const favelaId = operation?.favelaId ?? selector.favelaId;
    const favelaCode = operation?.favelaCode ?? selector.favelaCode;
    const filters = favelaId
      ? [eq(favelas.id, favelaId)]
      : favelaCode
        ? [eq(favelas.code, favelaCode)]
        : [];

    if (filters.length === 0) {
      throw new RoundOpsError('Informe --favela-code ou --favela-id para essa operação.');
    }

    const [favela] = await db
      .select({
        banditsActive: favelas.banditsActive,
        baseBanditTarget: favelas.baseBanditTarget,
        code: favelas.code,
        controllingFactionId: favelas.controllingFactionId,
        defaultSatisfaction: favelas.defaultSatisfaction,
        difficulty: favelas.difficulty,
        id: favelas.id,
        name: favelas.name,
        population: favelas.population,
        regionId: favelas.regionId,
        satisfaction: favelas.satisfaction,
      })
      .from(favelas)
      .where(and(...filters))
      .limit(1);

    if (!favela) {
      throw new RoundOpsError('Favela alvo não encontrada.');
    }

    return favela;
  }

  private async resolveFavelaId(
    selector: RoundOpsSelector,
    operation?: { favelaCode?: string; favelaId?: string },
  ): Promise<string | null> {
    try {
      return (await this.requireFavela(selector, operation)).id;
    } catch {
      return null;
    }
  }
}

function extractEventType(operation: RoundOpsOperation): ConfigurableEventType | null {
  switch (operation.type) {
    case 'disable-event':
    case 'enable-event':
      return operation.eventType;
    case 'expire-event':
    case 'trigger-event':
      return operation.eventType;
    default:
      return null;
  }
}

function extractRegionId(
  selector: RoundOpsSelector,
  operation: RoundOpsOperation,
): RegionId | null {
  if ('regionId' in operation && operation.regionId) {
    return operation.regionId;
  }

  return selector.regionId ?? null;
}

function extractFavelaSelector(
  operation: RoundOpsOperation,
): { favelaCode?: string; favelaId?: string } | undefined {
  if ('favelaCode' in operation || 'favelaId' in operation) {
    return {
      favelaCode: 'favelaCode' in operation ? operation.favelaCode : undefined,
      favelaId: 'favelaId' in operation ? operation.favelaId : undefined,
    };
  }

  return undefined;
}

function requireWholeNumber(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new RoundOpsError(`${label} precisa ser inteiro não-negativo.`);
  }

  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function midpoint(min: number, max: number): number {
  return (min + max) / 2;
}

function asInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    : [];
}

function normalizeRegionArray(value: unknown): RegionId[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is RegionId => Object.values(RegionId).includes(entry as RegionId))
    : [];
}

function exhaustiveGuard(value: never): never {
  throw new RoundOpsError(`Operação não suportada em dry-run: ${String(value)}.`);
}
