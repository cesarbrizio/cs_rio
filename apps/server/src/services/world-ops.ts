import { randomUUID } from 'node:crypto';

import type { FactionRank, FavelaControlState, PropertyType, RegionId } from '@cs-rio/shared';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  bocaDrugStocks,
  bocaOperations,
  drugFactories,
  drugs,
  factionMembers,
  factions,
  favelas,
  frontStoreOperations,
  marketSystemOffers,
  players,
  properties,
  puteiroOperations,
  raveDrugLineups,
  raveOperations,
  round,
  slotMachineOperations,
  worldOperationLogs,
} from '../db/schema.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import { invalidatePlayerProfileCaches } from './player-cache.js';

const BUSINESS_PROPERTY_TYPES = new Set<PropertyType>([
  'boca',
  'factory',
  'puteiro',
  'rave',
  'front_store',
  'slot_machine',
]);

type WorldFactionRecord = {
  abbreviation: string;
  bankMoney: string;
  id: string;
  internalSatisfaction: number;
  isFixed: boolean;
  name: string;
  points: number;
  templateCode: string | null;
};

type WorldFavelaRecord = {
  banditsActive: number;
  code: string;
  contestingFactionId: string | null;
  controllingFactionId: string | null;
  difficulty: number;
  id: string;
  maxSoldiers: number;
  name: string;
  regionId: RegionId;
  satisfaction: number;
  state: FavelaControlState;
};

type WorldPlayerRecord = {
  email: string;
  factionId: string | null;
  id: string;
  nickname: string;
  regionId: RegionId;
};

type WorldPropertyRecord = {
  favelaId: string | null;
  id: string;
  level: number;
  playerId: string;
  regionId: RegionId;
  soldiersCount: number;
  type: PropertyType;
};

type PropertyCashCarrier = 'boca' | 'front_store' | 'puteiro' | 'rave' | 'slot_machine';

type FactionOperation =
  | { type: 'join-faction'; value: string }
  | { type: 'leave-faction' }
  | { type: 'set-faction-bank-money'; value: number }
  | { type: 'set-faction-internal-satisfaction'; value: number }
  | { type: 'set-faction-points'; value: number }
  | { type: 'set-rank'; value: FactionRank };

type TerritoryOperation =
  | { type: 'neutralize-favela' }
  | { type: 'set-bandits'; value: number }
  | { type: 'set-favela-controller'; value: string }
  | { type: 'set-favela-satisfaction'; value: number }
  | { type: 'set-favela-state'; value: FavelaControlState }
  | { type: 'set-max-soldiers'; value: number };

type PropertyOperation =
  | { type: 'grant-property'; value: PropertyType }
  | { type: 'set-boca-stock'; drugCodeOrId: string; quantity: number }
  | { type: 'set-factory-output'; value: number }
  | { type: 'set-property-cash'; value: number }
  | { type: 'set-property-level'; value: number }
  | { type: 'set-property-soldiers'; value: number }
  | { type: 'set-rave-stock'; drugCodeOrId: string; priceMultiplier?: number; quantity: number };

type MarketOperation =
  | { type: 'clear-market-offers' }
  | { type: 'restock-system-offers' }
  | { type: 'seed-market-offers' };

export type WorldOpsOperation = FactionOperation | MarketOperation | PropertyOperation | TerritoryOperation;

export interface WorldOpsSelector {
  email?: string;
  factionCode?: string;
  factionId?: string;
  favelaCode?: string;
  favelaId?: string;
  nickname?: string;
  player?: string;
  playerId?: string;
  propertyId?: string;
  regionId?: RegionId;
}

export interface WorldOpsCommand {
  actor?: string;
  operation: WorldOpsOperation;
  origin?: string;
}

export interface WorldOpsResult {
  applied: Array<{
    operationType: WorldOpsOperation['type'];
    summary: string;
  }>;
  batchId: string;
  context: WorldOpsSnapshot;
}

export interface WorldOpsPreviewResult {
  context: WorldOpsSnapshot;
  dryRun: true;
  operations: Array<{
    changed: boolean;
    operationType: WorldOpsOperation['type'];
    summary: string;
  }>;
}

export interface WorldOpsSnapshot {
  faction: null | {
    abbreviation: string;
    bankMoney: number;
    id: string;
    internalSatisfaction: number;
    name: string;
    points: number;
  };
  favela: null | {
    banditsActive: number;
    code: string;
    contestingFactionId: string | null;
    controllingFactionId: string | null;
    id: string;
    maxSoldiers: number;
    name: string;
    regionId: RegionId;
    satisfaction: number;
    state: FavelaControlState;
  };
  market: {
    activeOffers: number;
    totalOffers: number;
    totalStockAvailable: number;
  };
  player: null | {
    factionId: string | null;
    id: string;
    nickname: string;
    regionId: RegionId;
  };
  property: null | {
    cashBalance: number | null;
    favelaId: string | null;
    id: string;
    level: number;
    playerId: string;
    regionId: RegionId;
    soldiersCount: number;
    storedOutput: number | null;
    type: PropertyType;
  };
  regionId: RegionId | null;
}

interface WorldOpsContext {
  faction: WorldFactionRecord | null;
  factionId: string | null;
  favela: WorldFavelaRecord | null;
  favelaId: string | null;
  player: WorldPlayerRecord | null;
  playerId: string | null;
  property: WorldPropertyRecord | null;
  propertyId: string | null;
  regionId: RegionId | null;
}

interface WorldOpsServiceOptions {
  keyValueStore?: KeyValueStore;
}

export class WorldOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorldOpsError';
  }
}

export class WorldOpsService {
  private readonly keyValueStore: KeyValueStore;

  constructor(options: WorldOpsServiceOptions = {}) {
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
  }

  async close(): Promise<void> {
    if (this.keyValueStore.close) {
      await this.keyValueStore.close();
    }
  }

  async applyCommands(selector: WorldOpsSelector, commands: WorldOpsCommand[]): Promise<WorldOpsResult> {
    if (commands.length === 0) {
      throw new WorldOpsError('Nenhuma operação de mundo foi informada.');
    }

    const batchId = randomUUID();
    const applied: WorldOpsResult['applied'] = [];
    let context = await this.resolveInitialContext(selector);

    for (const command of commands) {
      const before = await this.snapshotContext(context);
      const { summary, targetType } = await this.applyOperation(context, command.operation);
      context = await this.refreshContext(context);
      const after = await this.snapshotContext(context);

      await db.insert(worldOperationLogs).values({
        actor: command.actor ?? process.env.USER ?? 'local',
        afterJson: after as unknown as Record<string, unknown>,
        batchId,
        beforeJson: before as unknown as Record<string, unknown>,
        factionId: context.factionId,
        favelaId: context.favelaId,
        operationType: command.operation.type,
        origin: command.origin ?? 'ops:world',
        payloadJson: command.operation as unknown as Record<string, unknown>,
        playerId: context.playerId,
        propertyId: context.propertyId,
        summary,
        targetType,
      });

      applied.push({
        operationType: command.operation.type,
        summary,
      });
    }

    await this.invalidateContextCaches(context);

    return {
      applied,
      batchId,
      context: await this.snapshotContext(context),
    };
  }

  async previewCommands(
    selector: WorldOpsSelector,
    commands: WorldOpsCommand[],
  ): Promise<WorldOpsPreviewResult> {
    if (commands.length === 0) {
      throw new WorldOpsError('Nenhuma operação de mundo foi informada.');
    }

    const context = await this.resolveInitialContext(selector);
    const previewContext = cloneContext(context);
    const operations: WorldOpsPreviewResult['operations'] = [];

    for (const command of commands) {
      operations.push(await this.previewOperation(previewContext, command.operation));
    }

    return {
      context: await this.snapshotContext(context),
      dryRun: true,
      operations,
    };
  }

  private async applyOperation(
    context: WorldOpsContext,
    operation: WorldOpsOperation,
  ): Promise<{ summary: string; targetType: string }> {
    switch (operation.type) {
      case 'join-faction':
        return {
          summary: await this.joinFaction(context, operation.value),
          targetType: 'faction_membership',
        };
      case 'leave-faction':
        return {
          summary: await this.leaveFaction(context),
          targetType: 'faction_membership',
        };
      case 'set-rank':
        return {
          summary: await this.setRank(context, operation.value),
          targetType: 'faction_membership',
        };
      case 'set-faction-bank-money':
        return {
          summary: await this.updateFactionNumbers(context, { bankMoney: toMoneyString(requireNonNegative(operation.value, operation.type)) }),
          targetType: 'faction',
        };
      case 'set-faction-points':
        return {
          summary: await this.updateFactionNumbers(context, { points: requireWholeNumber(operation.value, operation.type) }),
          targetType: 'faction',
        };
      case 'set-faction-internal-satisfaction':
        return {
          summary: await this.updateFactionNumbers(context, {
            internalSatisfaction: clampPercent(operation.value, operation.type),
          }),
          targetType: 'faction',
        };
      case 'set-favela-controller':
        return {
          summary: await this.setFavelaController(context, operation.value),
          targetType: 'favela',
        };
      case 'neutralize-favela':
        return {
          summary: await this.neutralizeFavela(context),
          targetType: 'favela',
        };
      case 'set-favela-satisfaction':
        return {
          summary: await this.updateFavela(context, {
            satisfaction: clampPercent(operation.value, operation.type),
          }),
          targetType: 'favela',
        };
      case 'set-favela-state':
        return {
          summary: await this.setFavelaState(context, operation.value),
          targetType: 'favela',
        };
      case 'set-bandits':
        return {
          summary: await this.updateFavela(context, {
            banditsActive: requireWholeNumber(operation.value, operation.type),
          }),
          targetType: 'favela',
        };
      case 'set-max-soldiers':
        return {
          summary: await this.updateFavela(context, {
            maxSoldiers: requireWholeNumber(operation.value, operation.type),
          }),
          targetType: 'favela',
        };
      case 'grant-property':
        return {
          summary: await this.grantProperty(context, operation.value),
          targetType: 'property',
        };
      case 'set-property-level':
        return {
          summary: await this.updateProperty(context, {
            level: requireWholeNumber(operation.value, operation.type),
          }),
          targetType: 'property',
        };
      case 'set-property-soldiers':
        return {
          summary: await this.updateProperty(context, {
            soldiersCount: requireWholeNumber(operation.value, operation.type),
          }),
          targetType: 'property',
        };
      case 'set-property-cash':
        return {
          summary: await this.setPropertyCash(context, operation.value),
          targetType: 'property_operation',
        };
      case 'set-factory-output':
        return {
          summary: await this.setFactoryOutput(context, operation.value),
          targetType: 'property_operation',
        };
      case 'set-boca-stock':
        return {
          summary: await this.setBocaStock(context, operation.drugCodeOrId, operation.quantity),
          targetType: 'property_operation',
        };
      case 'set-rave-stock':
        return {
          summary: await this.setRaveStock(context, operation.drugCodeOrId, operation.quantity, operation.priceMultiplier),
          targetType: 'property_operation',
        };
      case 'seed-market-offers':
        return {
          summary: await this.seedMarketOffers(),
          targetType: 'market',
        };
      case 'clear-market-offers':
        return {
          summary: await this.clearMarketOffers(),
          targetType: 'market',
        };
      case 'restock-system-offers':
        return {
          summary: await this.restockMarketOffers(),
          targetType: 'market',
        };
      default:
        return exhaustiveGuard(operation);
    }
  }

  private async previewOperation(
    context: WorldOpsContext,
    operation: WorldOpsOperation,
  ): Promise<{ changed: boolean; operationType: WorldOpsOperation['type']; summary: string }> {
    switch (operation.type) {
      case 'join-faction': {
        const player = this.requirePlayer(context);
        const faction = await this.requireFactionByIdentifier(operation.value);
        const changed = player.factionId !== faction.id;
        context.player = { ...player, factionId: faction.id };
        context.playerId = player.id;
        context.faction = faction;
        context.factionId = faction.id;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: ${player.nickname} entraria na facção ${faction.abbreviation} como cria.`
            : `${player.nickname} já pertence à facção ${faction.abbreviation}.`,
        };
      }
      case 'leave-faction': {
        const player = this.requirePlayer(context);
        if (!player.factionId) {
          return {
            changed: false,
            operationType: operation.type,
            summary: `${player.nickname} já está sem facção.`,
          };
        }
        context.player = { ...player, factionId: null };
        context.faction = null;
        context.factionId = null;
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: ${player.nickname} sairia da facção atual.`,
        };
      }
      case 'set-rank': {
        const player = this.requirePlayer(context);
        const faction = await this.requireContextFaction(context);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: rank de ${player.nickname} iria para ${operation.value} em ${faction.abbreviation}.`,
        };
      }
      case 'set-faction-bank-money': {
        const faction = await this.requireContextFaction(context);
        const nextValue = toMoneyString(requireNonNegative(operation.value, operation.type));
        const changed = faction.bankMoney !== nextValue;
        context.faction = { ...faction, bankMoney: nextValue };
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: caixa da facção ${faction.abbreviation} iria para R$ ${formatMoney(nextValue)}.`
            : `Caixa da facção ${faction.abbreviation} já está em R$ ${formatMoney(nextValue)}.`,
        };
      }
      case 'set-faction-points': {
        const faction = await this.requireContextFaction(context);
        const nextValue = requireWholeNumber(operation.value, operation.type);
        const changed = faction.points !== nextValue;
        context.faction = { ...faction, points: nextValue };
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: pontos da facção ${faction.abbreviation} iriam para ${nextValue}.`
            : `Pontos da facção ${faction.abbreviation} já estão em ${nextValue}.`,
        };
      }
      case 'set-faction-internal-satisfaction': {
        const faction = await this.requireContextFaction(context);
        const nextValue = clampPercent(operation.value, operation.type);
        const changed = faction.internalSatisfaction !== nextValue;
        context.faction = { ...faction, internalSatisfaction: nextValue };
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: satisfação interna da facção ${faction.abbreviation} iria para ${nextValue}.`
            : `Satisfação interna da facção ${faction.abbreviation} já está em ${nextValue}.`,
        };
      }
      case 'set-favela-controller': {
        const favela = await this.requireContextFavela(context);
        if (operation.value === 'neutral' || operation.value === 'neutra') {
          const changed = Boolean(favela.controllingFactionId) || favela.state !== 'neutral';
          context.favela = {
            ...favela,
            contestingFactionId: null,
            controllingFactionId: null,
            state: 'neutral',
          };
          return {
            changed,
            operationType: operation.type,
            summary: changed
              ? `Dry-run: ${favela.name} seria neutralizada.`
              : `${favela.name} já está neutra.`,
          };
        }
        const faction = await this.requireFactionByIdentifier(operation.value);
        const changed = favela.controllingFactionId !== faction.id || favela.state !== 'controlled';
        context.favela = {
          ...favela,
          contestingFactionId: null,
          controllingFactionId: faction.id,
          state: 'controlled',
        };
        context.faction = faction;
        context.factionId = faction.id;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: ${favela.name} passaria a ser controlada por ${faction.abbreviation}.`
            : `${favela.name} já é controlada por ${faction.abbreviation}.`,
        };
      }
      case 'neutralize-favela': {
        const favela = await this.requireContextFavela(context);
        const changed = Boolean(favela.controllingFactionId) || favela.state !== 'neutral';
        context.favela = {
          ...favela,
          contestingFactionId: null,
          controllingFactionId: null,
          state: 'neutral',
        };
        return {
          changed,
          operationType: operation.type,
          summary: changed ? `Dry-run: ${favela.name} seria neutralizada.` : `${favela.name} já está neutra.`,
        };
      }
      case 'set-favela-satisfaction':
        return previewFavelaNumber(context, operation, 'satisfaction', 'satisfação', clampPercent(operation.value, operation.type));
      case 'set-bandits':
        return previewFavelaNumber(context, operation, 'banditsActive', 'bandidos', requireWholeNumber(operation.value, operation.type));
      case 'set-max-soldiers':
        return previewFavelaNumber(context, operation, 'maxSoldiers', 'limite de soldados', requireWholeNumber(operation.value, operation.type));
      case 'set-favela-state': {
        const favela = await this.requireContextFavela(context);
        const nextState = operation.value;
        if (nextState === 'at_war' && !favela.controllingFactionId && !context.factionId) {
          throw new WorldOpsError('Favela em guerra exige facção controladora atual ou facção em contexto.');
        }
        const changed = favela.state !== nextState;
        context.favela = { ...favela, state: nextState };
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? `Dry-run: estado de ${favela.name} iria para ${nextState}.`
            : `${favela.name} já está em ${nextState}.`,
        };
      }
      case 'grant-property': {
        const player = this.requirePlayer(context);
        const regionId = await this.resolveTargetRegionId(context);
        const favelaId = BUSINESS_PROPERTY_TYPES.has(operation.value)
          ? await this.resolveDefaultFavelaId(context, regionId)
          : null;
        const changed = true;
        context.property = {
          favelaId,
          id: 'preview-property',
          level: 1,
          playerId: player.id,
          regionId,
          soldiersCount: 0,
          type: operation.value,
        };
        context.propertyId = 'preview-property';
        context.regionId = regionId;
        if (favelaId) {
          context.favelaId = favelaId;
          context.favela = await this.requireFavelaById(favelaId);
        }
        return {
          changed,
          operationType: operation.type,
          summary: `Dry-run: propriedade ${operation.value} seria concedida para ${player.nickname} em ${regionId}.`,
        };
      }
      case 'set-property-level':
        return previewPropertyNumber(context, operation, 'level', 'nível', requireWholeNumber(operation.value, operation.type));
      case 'set-property-soldiers':
        return previewPropertyNumber(context, operation, 'soldiersCount', 'soldados', requireWholeNumber(operation.value, operation.type));
      case 'set-property-cash': {
        const property = await this.requireContextProperty(context);
        this.requireCashCarrier(property.type);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: caixa da propriedade ${property.type} iria para R$ ${formatMoney(requireNonNegative(operation.value, operation.type))}.`,
        };
      }
      case 'set-factory-output': {
        await this.requireContextProperty(context, 'factory');
        const nextValue = requireWholeNumber(operation.value, operation.type);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: produção armazenada da fábrica iria para ${nextValue}.`,
        };
      }
      case 'set-boca-stock': {
        await this.requireContextProperty(context, 'boca');
        const drug = await this.requireDrugByCodeOrId(operation.drugCodeOrId);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: estoque da boca iria para ${drug.code} = ${requireWholeNumber(operation.quantity, operation.type)}.`,
        };
      }
      case 'set-rave-stock': {
        await this.requireContextProperty(context, 'rave');
        const drug = await this.requireDrugByCodeOrId(operation.drugCodeOrId);
        return {
          changed: true,
          operationType: operation.type,
          summary: `Dry-run: lineup da rave iria para ${drug.code} = ${requireWholeNumber(operation.quantity, operation.type)}.`,
        };
      }
      case 'seed-market-offers': {
        const snapshot = await this.snapshotContext(context);
        const changed = snapshot.market.activeOffers === 0 || snapshot.market.totalStockAvailable === 0;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? 'Dry-run: ofertas sistêmicas seriam ativadas e reabastecidas.'
            : 'Ofertas sistêmicas já parecem ativas e abastecidas.',
        };
      }
      case 'clear-market-offers': {
        const snapshot = await this.snapshotContext(context);
        const changed = snapshot.market.totalStockAvailable > 0;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? 'Dry-run: ofertas sistêmicas seriam zeradas.'
            : 'Ofertas sistêmicas já estão zeradas.',
        };
      }
      case 'restock-system-offers': {
        const snapshot = await this.snapshotContext(context);
        const changed = snapshot.market.activeOffers > 0;
        return {
          changed,
          operationType: operation.type,
          summary: changed
            ? 'Dry-run: ofertas sistêmicas ativas seriam reabastecidas.'
            : 'Não há ofertas ativas para reabastecer.',
        };
      }
      default:
        return exhaustiveGuard(operation);
    }
  }

  private async joinFaction(context: WorldOpsContext, factionIdentifier: string): Promise<string> {
    const player = this.requirePlayer(context);
    const faction = await this.requireFactionByIdentifier(factionIdentifier);
    const existingMemberships = await db
      .select({
        factionId: factionMembers.factionId,
      })
      .from(factionMembers)
      .where(eq(factionMembers.playerId, player.id));

    if (existingMemberships.length > 0) {
      await db.delete(factionMembers).where(eq(factionMembers.playerId, player.id));
    }

    await db.update(players).set({ factionId: faction.id }).where(eq(players.id, player.id));
    await db.insert(factionMembers).values({
      factionId: faction.id,
      playerId: player.id,
      rank: 'cria',
    });

    context.factionId = faction.id;
    context.faction = faction;
    return `${player.nickname} entrou na facção ${faction.abbreviation} como cria.`;
  }

  private async leaveFaction(context: WorldOpsContext): Promise<string> {
    const player = this.requirePlayer(context);
    if (!player.factionId) {
      context.faction = null;
      context.factionId = null;
      return `${player.nickname} já estava sem facção.`;
    }

    await db.delete(factionMembers).where(eq(factionMembers.playerId, player.id));
    await db.update(players).set({ factionId: null }).where(eq(players.id, player.id));
    context.faction = null;
    context.factionId = null;
    return `${player.nickname} saiu da facção atual.`;
  }

  private async setRank(context: WorldOpsContext, rank: FactionRank): Promise<string> {
    const player = this.requirePlayer(context);
    const faction = await this.requireContextFaction(context);
    const [membership] = await db
      .select({
        factionId: factionMembers.factionId,
        playerId: factionMembers.playerId,
      })
      .from(factionMembers)
      .where(and(eq(factionMembers.playerId, player.id), eq(factionMembers.factionId, faction.id)))
      .limit(1);

    if (!membership) {
      throw new WorldOpsError(`${player.nickname} não pertence à facção ${faction.abbreviation}.`);
    }

    await db
      .update(factionMembers)
      .set({ rank })
      .where(and(eq(factionMembers.playerId, player.id), eq(factionMembers.factionId, faction.id)));

    return `Rank de ${player.nickname} ajustado para ${rank} em ${faction.abbreviation}.`;
  }

  private async updateFactionNumbers(
    context: WorldOpsContext,
    values: Partial<{
      bankMoney: string;
      internalSatisfaction: number;
      points: number;
    }>,
  ): Promise<string> {
    const faction = await this.requireContextFaction(context);
    await db.update(factions).set(values).where(eq(factions.id, faction.id));

    const parts: string[] = [];
    if (values.bankMoney) {
      parts.push(`caixa = R$ ${formatMoney(values.bankMoney)}`);
    }
    if (typeof values.points === 'number') {
      parts.push(`pontos = ${values.points}`);
    }
    if (typeof values.internalSatisfaction === 'number') {
      parts.push(`satisfação interna = ${values.internalSatisfaction}`);
    }

    return `Facção ${faction.abbreviation} atualizada (${parts.join(', ')}).`;
  }

  private async setFavelaController(context: WorldOpsContext, value: string): Promise<string> {
    const favela = await this.requireContextFavela(context);
    if (value === 'neutral' || value === 'neutra') {
      await db
        .update(favelas)
        .set({
          contestingFactionId: null,
          controllingFactionId: null,
          state: 'neutral',
          stabilizationEndsAt: null,
          warDeclaredAt: null,
        })
        .where(eq(favelas.id, favela.id));
      context.faction = null;
      context.factionId = null;
      return `${favela.name} neutralizada.`;
    }

    const faction = await this.requireFactionByIdentifier(value);
    await db
      .update(favelas)
      .set({
        contestingFactionId: null,
        controllingFactionId: faction.id,
        state: 'controlled',
        stabilizationEndsAt: null,
        warDeclaredAt: null,
      })
      .where(eq(favelas.id, favela.id));
    context.faction = faction;
    context.factionId = faction.id;
    return `${favela.name} agora é controlada por ${faction.abbreviation}.`;
  }

  private async neutralizeFavela(context: WorldOpsContext): Promise<string> {
    return this.setFavelaController(context, 'neutral');
  }

  private async setFavelaState(context: WorldOpsContext, nextState: FavelaControlState): Promise<string> {
    const favela = await this.requireContextFavela(context);
    const current = await this.requireFavelaById(favela.id);
    const patch: {
      contestingFactionId?: string | null;
      controllingFactionId?: string | null;
      stabilizationEndsAt?: Date | null;
      state: FavelaControlState;
      warDeclaredAt?: Date | null;
    } = {
      state: nextState,
    };

    if (nextState === 'neutral') {
      patch.contestingFactionId = null;
      patch.controllingFactionId = null;
      patch.stabilizationEndsAt = null;
      patch.warDeclaredAt = null;
    }

    if (nextState === 'controlled' && !current.controllingFactionId) {
      const faction = await this.requireContextFaction(context);
      patch.controllingFactionId = faction.id;
      patch.contestingFactionId = null;
    }

    if (nextState === 'at_war' && !current.controllingFactionId && !context.factionId) {
      throw new WorldOpsError('Favela em guerra exige facção controladora atual ou facção em contexto.');
    }

    if (nextState === 'at_war' && context.factionId && current.controllingFactionId !== context.factionId) {
      patch.contestingFactionId = context.factionId;
      patch.warDeclaredAt = new Date();
      if (!current.controllingFactionId) {
        patch.controllingFactionId = context.factionId;
      }
    }

    await db.update(favelas).set(patch).where(eq(favelas.id, favela.id));
    return `Estado de ${favela.name} ajustado para ${nextState}.`;
  }

  private async updateFavela(
    context: WorldOpsContext,
    values: Partial<{
      banditsActive: number;
      maxSoldiers: number;
      satisfaction: number;
    }>,
  ): Promise<string> {
    const favela = await this.requireContextFavela(context);
    await db.update(favelas).set(values).where(eq(favelas.id, favela.id));

    const parts: string[] = [];
    if (typeof values.banditsActive === 'number') {
      parts.push(`bandidos = ${values.banditsActive}`);
    }
    if (typeof values.maxSoldiers === 'number') {
      parts.push(`limite de soldados = ${values.maxSoldiers}`);
    }
    if (typeof values.satisfaction === 'number') {
      parts.push(`satisfação = ${values.satisfaction}`);
    }

    return `Favela ${favela.name} atualizada (${parts.join(', ')}).`;
  }

  private async grantProperty(context: WorldOpsContext, propertyType: PropertyType): Promise<string> {
    const player = this.requirePlayer(context);
    const regionId = await this.resolveTargetRegionId(context);
    const favelaId = BUSINESS_PROPERTY_TYPES.has(propertyType)
      ? await this.resolveDefaultFavelaId(context, regionId)
      : null;
    const now = new Date();

    const [property] = await db
      .insert(properties)
      .values({
        favelaId,
        lastMaintenanceAt: now,
        level: 1,
        playerId: player.id,
        regionId,
        soldiersCount: 0,
        type: propertyType,
      })
      .returning({
        favelaId: properties.favelaId,
        id: properties.id,
        level: properties.level,
        playerId: properties.playerId,
        regionId: properties.regionId,
        soldiersCount: properties.soldiersCount,
        type: properties.type,
      });

    if (!property) {
      throw new WorldOpsError('Falha ao conceder propriedade.');
    }

    if (propertyType === 'factory') {
      const drug = await this.requireDefaultFactoryDrug();
      await db.insert(drugFactories).values({
        drugId: drug.id,
        lastCycleAt: now,
        lastMaintenanceAt: now,
        propertyId: property.id,
      });
    }

    if (propertyType === 'boca') {
      await db.insert(bocaOperations).values({
        lastSaleAt: now,
        propertyId: property.id,
      });
    }

    if (propertyType === 'rave') {
      await db.insert(raveOperations).values({
        lastSaleAt: now,
        propertyId: property.id,
      });
    }

    if (propertyType === 'puteiro') {
      await db.insert(puteiroOperations).values({
        lastRevenueAt: now,
        propertyId: property.id,
      });
    }

    if (propertyType === 'front_store') {
      await db.insert(frontStoreOperations).values({
        lastRevenueAt: now,
        propertyId: property.id,
        storeKind: 'oficina',
      });
    }

    if (propertyType === 'slot_machine') {
      await db.insert(slotMachineOperations).values({
        lastPlayAt: now,
        machinesInstalled: 4,
        propertyId: property.id,
      });
    }

    context.property = {
      ...property,
      regionId: property.regionId as RegionId,
      type: property.type as PropertyType,
    };
    context.propertyId = property.id;
    context.regionId = property.regionId as RegionId;
    if (favelaId) {
      context.favelaId = favelaId;
    }

    return `Propriedade ${propertyType} concedida para ${player.nickname} em ${regionId}.`;
  }

  private async updateProperty(
    context: WorldOpsContext,
    values: Partial<{
      level: number;
      soldiersCount: number;
    }>,
  ): Promise<string> {
    const property = await this.requireContextProperty(context);
    await db.update(properties).set(values).where(eq(properties.id, property.id));

    const parts: string[] = [];
    if (typeof values.level === 'number') {
      parts.push(`nível = ${values.level}`);
    }
    if (typeof values.soldiersCount === 'number') {
      parts.push(`soldados = ${values.soldiersCount}`);
    }
    return `Propriedade ${property.type} atualizada (${parts.join(', ')}).`;
  }

  private async setPropertyCash(context: WorldOpsContext, nextCash: number): Promise<string> {
    const property = await this.requireContextProperty(context);
    const cashBalance = toMoneyString(requireNonNegative(nextCash, 'set-property-cash'));
    const carrier = this.requireCashCarrier(property.type);

    if (carrier === 'boca') {
      await db.update(bocaOperations).set({ cashBalance }).where(eq(bocaOperations.propertyId, property.id));
    } else if (carrier === 'rave') {
      await db.update(raveOperations).set({ cashBalance }).where(eq(raveOperations.propertyId, property.id));
    } else if (carrier === 'puteiro') {
      await db.update(puteiroOperations).set({ cashBalance }).where(eq(puteiroOperations.propertyId, property.id));
    } else if (carrier === 'front_store') {
      await db.update(frontStoreOperations).set({ cashBalance }).where(eq(frontStoreOperations.propertyId, property.id));
    } else if (carrier === 'slot_machine') {
      await db
        .update(slotMachineOperations)
        .set({ cashBalance })
        .where(eq(slotMachineOperations.propertyId, property.id));
    }

    return `Caixa da propriedade ${property.type} ajustado para R$ ${formatMoney(nextCash)}.`;
  }

  private async setFactoryOutput(context: WorldOpsContext, nextOutput: number): Promise<string> {
    const property = await this.requireContextProperty(context, 'factory');
    const storedOutput = requireWholeNumber(nextOutput, 'set-factory-output');
    await db
      .update(drugFactories)
      .set({ storedOutput })
      .where(eq(drugFactories.propertyId, property.id));
    return `Produção armazenada da fábrica ajustada para ${storedOutput}.`;
  }

  private async setBocaStock(context: WorldOpsContext, drugCodeOrId: string, quantity: number): Promise<string> {
    const property = await this.requireContextProperty(context, 'boca');
    const drug = await this.requireDrugByCodeOrId(drugCodeOrId);
    const nextQuantity = requireWholeNumber(quantity, 'set-boca-stock');

    await db
      .insert(bocaDrugStocks)
      .values({
        drugId: drug.id,
        propertyId: property.id,
        quantity: nextQuantity,
      })
      .onConflictDoUpdate({
        set: {
          quantity: nextQuantity,
        },
        target: [bocaDrugStocks.propertyId, bocaDrugStocks.drugId],
      });

    return `Estoque da boca ajustado: ${drug.code} = ${nextQuantity}.`;
  }

  private async setRaveStock(
    context: WorldOpsContext,
    drugCodeOrId: string,
    quantity: number,
    priceMultiplier?: number,
  ): Promise<string> {
    const property = await this.requireContextProperty(context, 'rave');
    const drug = await this.requireDrugByCodeOrId(drugCodeOrId);
    const nextQuantity = requireWholeNumber(quantity, 'set-rave-stock');
    const nextMultiplier = typeof priceMultiplier === 'number' ? clampMultiplier(priceMultiplier) : 1.55;

    await db
      .insert(raveDrugLineups)
      .values({
        drugId: drug.id,
        priceMultiplier: nextMultiplier.toFixed(2),
        propertyId: property.id,
        quantity: nextQuantity,
      })
      .onConflictDoUpdate({
        set: {
          priceMultiplier: nextMultiplier.toFixed(2),
          quantity: nextQuantity,
        },
        target: [raveDrugLineups.propertyId, raveDrugLineups.drugId],
      });

    return `Lineup da rave ajustado: ${drug.code} = ${nextQuantity} (x${nextMultiplier.toFixed(2)}).`;
  }

  private async seedMarketOffers(): Promise<string> {
    const { currentGameDay, currentRoundId } = await this.readCurrentRoundCycle();
    const result = await db
      .update(marketSystemOffers)
      .set({
        isActive: true,
        lastRestockedGameDay: currentGameDay,
        lastRestockedRoundId: currentRoundId,
        stockAvailable: sql`${marketSystemOffers.stockMax}`,
        updatedAt: new Date(),
      })
      .returning({
        code: marketSystemOffers.code,
      });

    return `${result.length} oferta(s) sistêmica(s) ativadas e reabastecidas.`;
  }

  private async clearMarketOffers(): Promise<string> {
    const result = await db
      .update(marketSystemOffers)
      .set({
        stockAvailable: 0,
        updatedAt: new Date(),
      })
      .returning({
        code: marketSystemOffers.code,
      });

    return `${result.length} oferta(s) sistêmica(s) zeradas.`;
  }

  private async restockMarketOffers(): Promise<string> {
    const { currentGameDay, currentRoundId } = await this.readCurrentRoundCycle();
    const result = await db
      .update(marketSystemOffers)
      .set({
        lastRestockedGameDay: currentGameDay,
        lastRestockedRoundId: currentRoundId,
        stockAvailable: sql`${marketSystemOffers.stockMax}`,
        updatedAt: new Date(),
      })
      .where(eq(marketSystemOffers.isActive, true))
      .returning({
        code: marketSystemOffers.code,
      });

    return `${result.length} oferta(s) sistêmica(s) reabastecidas.`;
  }

  private async resolveInitialContext(selector: WorldOpsSelector): Promise<WorldOpsContext> {
    const player = await this.resolvePlayer(selector);
    const faction = await this.resolveFaction({
      factionCode: selector.factionCode,
      factionId: selector.factionId,
      playerFactionId: player?.factionId ?? null,
    });
    const favela = await this.resolveFavela(selector);
    const property = await this.resolveProperty(selector.propertyId);
    const regionId =
      selector.regionId ??
      favela?.regionId ??
      property?.regionId ??
      player?.regionId ??
      null;

    return {
      faction,
      factionId: faction?.id ?? player?.factionId ?? null,
      favela,
      favelaId: favela?.id ?? null,
      player,
      playerId: player?.id ?? null,
      property,
      propertyId: property?.id ?? null,
      regionId,
    };
  }

  private async refreshContext(context: WorldOpsContext): Promise<WorldOpsContext> {
    const player = context.playerId ? await this.requirePlayerById(context.playerId) : null;
    const faction = context.factionId ? await this.requireFactionById(context.factionId) : null;
    const favela = context.favelaId ? await this.requireFavelaById(context.favelaId) : null;
    const property = context.propertyId ? await this.requirePropertyById(context.propertyId) : null;

    return {
      faction,
      factionId: faction?.id ?? player?.factionId ?? null,
      favela,
      favelaId: favela?.id ?? null,
      player,
      playerId: player?.id ?? null,
      property,
      propertyId: property?.id ?? null,
      regionId: context.regionId ?? favela?.regionId ?? property?.regionId ?? player?.regionId ?? null,
    };
  }

  private async snapshotContext(context: WorldOpsContext): Promise<WorldOpsSnapshot> {
    const refreshed = await this.refreshContext(context);
    const [marketTotals, propertyCash, propertyOutput] = await Promise.all([
      readMarketSnapshot(),
      refreshed.property ? this.readPropertyCashBalance(refreshed.property) : Promise.resolve(null),
      refreshed.property?.type === 'factory'
        ? this.readPropertyOutput(refreshed.property.id)
        : Promise.resolve(null),
    ]);

    return {
      faction: refreshed.faction
        ? {
            abbreviation: refreshed.faction.abbreviation,
            bankMoney: Number.parseFloat(refreshed.faction.bankMoney),
            id: refreshed.faction.id,
            internalSatisfaction: refreshed.faction.internalSatisfaction,
            name: refreshed.faction.name,
            points: refreshed.faction.points,
          }
        : null,
      favela: refreshed.favela
        ? {
            banditsActive: refreshed.favela.banditsActive,
            code: refreshed.favela.code,
            contestingFactionId: refreshed.favela.contestingFactionId,
            controllingFactionId: refreshed.favela.controllingFactionId,
            id: refreshed.favela.id,
            maxSoldiers: refreshed.favela.maxSoldiers,
            name: refreshed.favela.name,
            regionId: refreshed.favela.regionId,
            satisfaction: refreshed.favela.satisfaction,
            state: refreshed.favela.state,
          }
        : null,
      market: marketTotals,
      player: refreshed.player
        ? {
            factionId: refreshed.player.factionId,
            id: refreshed.player.id,
            nickname: refreshed.player.nickname,
            regionId: refreshed.player.regionId,
          }
        : null,
      property: refreshed.property
        ? {
            cashBalance: propertyCash,
            favelaId: refreshed.property.favelaId,
            id: refreshed.property.id,
            level: refreshed.property.level,
            playerId: refreshed.property.playerId,
            regionId: refreshed.property.regionId,
            soldiersCount: refreshed.property.soldiersCount,
            storedOutput: propertyOutput,
            type: refreshed.property.type,
          }
        : null,
      regionId: refreshed.regionId,
    };
  }

  private async invalidateContextCaches(context: WorldOpsContext): Promise<void> {
    const playerIds = new Set<string>();
    if (context.playerId) {
      playerIds.add(context.playerId);
    }
    if (context.factionId) {
      const memberRows = await db
        .select({
          playerId: factionMembers.playerId,
        })
        .from(factionMembers)
        .where(eq(factionMembers.factionId, context.factionId));
      for (const member of memberRows) {
        playerIds.add(member.playerId);
      }
    }

    await invalidatePlayerProfileCaches(this.keyValueStore, playerIds);
  }

  private async resolvePlayer(selector: WorldOpsSelector): Promise<WorldPlayerRecord | null> {
    const filters = [];

    if (selector.playerId) {
      filters.push(eq(players.id, selector.playerId));
    }
    if (selector.nickname) {
      filters.push(eq(players.nickname, selector.nickname));
    }
    if (selector.email) {
      filters.push(eq(players.email, selector.email));
    }
    if (selector.player) {
      if (selector.player.includes('@')) {
        filters.push(eq(players.email, selector.player));
      } else if (isUuid(selector.player)) {
        filters.push(eq(players.id, selector.player));
      } else {
        filters.push(eq(players.nickname, selector.player));
      }
    }

    if (filters.length === 0) {
      return null;
    }

    const [player] = await db
      .select({
        email: players.email,
        factionId: players.factionId,
        id: players.id,
        nickname: players.nickname,
        regionId: players.regionId,
      })
      .from(players)
      .where(or(...filters))
      .limit(1);

    return player
      ? {
          ...player,
          regionId: player.regionId as RegionId,
        }
      : null;
  }

  private async requirePlayerById(playerId: string): Promise<WorldPlayerRecord> {
    const [player] = await db
      .select({
        email: players.email,
        factionId: players.factionId,
        id: players.id,
        nickname: players.nickname,
        regionId: players.regionId,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1);

    if (!player) {
      throw new WorldOpsError('Jogador não encontrado.');
    }

    return {
      ...player,
      regionId: player.regionId as RegionId,
    };
  }

  private async resolveFaction(input: {
    factionCode?: string;
    factionId?: string;
    playerFactionId?: string | null;
  }): Promise<WorldFactionRecord | null> {
    if (input.factionId) {
      return this.requireFactionById(input.factionId);
    }

    if (input.factionCode) {
      return this.requireFactionByIdentifier(input.factionCode);
    }

    if (input.playerFactionId) {
      return this.requireFactionById(input.playerFactionId);
    }

    return null;
  }

  private async requireFactionById(factionId: string): Promise<WorldFactionRecord> {
    const [faction] = await db
      .select({
        abbreviation: factions.abbreviation,
        bankMoney: factions.bankMoney,
        id: factions.id,
        internalSatisfaction: factions.internalSatisfaction,
        isFixed: factions.isFixed,
        name: factions.name,
        points: factions.points,
        templateCode: factions.templateCode,
      })
      .from(factions)
      .where(eq(factions.id, factionId))
      .limit(1);

    if (!faction) {
      throw new WorldOpsError('Facção não encontrada.');
    }

    return faction;
  }

  private async requireFactionByIdentifier(identifier: string): Promise<WorldFactionRecord> {
    if (isUuid(identifier)) {
      return this.requireFactionById(identifier);
    }

    const upper = identifier.toUpperCase();
    const [faction] = await db
      .select({
        abbreviation: factions.abbreviation,
        bankMoney: factions.bankMoney,
        id: factions.id,
        internalSatisfaction: factions.internalSatisfaction,
        isFixed: factions.isFixed,
        name: factions.name,
        points: factions.points,
        templateCode: factions.templateCode,
      })
      .from(factions)
      .where(
        or(
          eq(factions.abbreviation, upper),
          eq(factions.templateCode, identifier),
          eq(factions.name, identifier),
        ),
      )
      .limit(1);

    if (!faction) {
      throw new WorldOpsError(`Facção não encontrada para ${identifier}.`);
    }

    return faction;
  }

  private async resolveFavela(selector: WorldOpsSelector): Promise<WorldFavelaRecord | null> {
    if (selector.favelaId) {
      return this.requireFavelaById(selector.favelaId);
    }
    if (selector.favelaCode) {
      return this.requireFavelaByCode(selector.favelaCode);
    }
    return null;
  }

  private async requireFavelaById(favelaId: string): Promise<WorldFavelaRecord> {
    const [favela] = await db
      .select({
        banditsActive: favelas.banditsActive,
        code: favelas.code,
        contestingFactionId: favelas.contestingFactionId,
        controllingFactionId: favelas.controllingFactionId,
        difficulty: favelas.difficulty,
        id: favelas.id,
        maxSoldiers: favelas.maxSoldiers,
        name: favelas.name,
        regionId: favelas.regionId,
        satisfaction: favelas.satisfaction,
        state: favelas.state,
      })
      .from(favelas)
      .where(eq(favelas.id, favelaId))
      .limit(1);

    if (!favela) {
      throw new WorldOpsError('Favela não encontrada.');
    }

    return {
      ...favela,
      regionId: favela.regionId as RegionId,
      state: favela.state as FavelaControlState,
    };
  }

  private async requireFavelaByCode(code: string): Promise<WorldFavelaRecord> {
    const [favela] = await db
      .select({
        banditsActive: favelas.banditsActive,
        code: favelas.code,
        contestingFactionId: favelas.contestingFactionId,
        controllingFactionId: favelas.controllingFactionId,
        difficulty: favelas.difficulty,
        id: favelas.id,
        maxSoldiers: favelas.maxSoldiers,
        name: favelas.name,
        regionId: favelas.regionId,
        satisfaction: favelas.satisfaction,
        state: favelas.state,
      })
      .from(favelas)
      .where(eq(favelas.code, code))
      .limit(1);

    if (!favela) {
      throw new WorldOpsError(`Favela não encontrada para ${code}.`);
    }

    return {
      ...favela,
      regionId: favela.regionId as RegionId,
      state: favela.state as FavelaControlState,
    };
  }

  private async resolveProperty(propertyId?: string): Promise<WorldPropertyRecord | null> {
    if (!propertyId) {
      return null;
    }
    return this.requirePropertyById(propertyId);
  }

  private async requirePropertyById(propertyId: string): Promise<WorldPropertyRecord> {
    const [property] = await db
      .select({
        favelaId: properties.favelaId,
        id: properties.id,
        level: properties.level,
        playerId: properties.playerId,
        regionId: properties.regionId,
        soldiersCount: properties.soldiersCount,
        type: properties.type,
      })
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) {
      throw new WorldOpsError('Propriedade não encontrada.');
    }

    return {
      ...property,
      regionId: property.regionId as RegionId,
      type: property.type as PropertyType,
    };
  }

  private requirePlayer(context: WorldOpsContext): WorldPlayerRecord {
    if (!context.player) {
      throw new WorldOpsError('Informe --player, --player-id, --nickname ou --email.');
    }
    return context.player;
  }

  private async requireContextFaction(context: WorldOpsContext): Promise<WorldFactionRecord> {
    if (context.faction) {
      return context.faction;
    }
    if (context.player?.factionId) {
      const faction = await this.requireFactionById(context.player.factionId);
      context.faction = faction;
      context.factionId = faction.id;
      return faction;
    }
    throw new WorldOpsError('Informe --faction-id/--faction-code ou selecione um jogador com facção.');
  }

  private async requireContextFavela(context: WorldOpsContext): Promise<WorldFavelaRecord> {
    if (context.favela) {
      return context.favela;
    }
    throw new WorldOpsError('Informe --favela-id ou --favela-code.');
  }

  private async requireContextProperty(
    context: WorldOpsContext,
    expectedType?: PropertyType,
  ): Promise<WorldPropertyRecord> {
    if (!context.property && context.player) {
      const [latest] = await db
        .select({
          favelaId: properties.favelaId,
          id: properties.id,
          level: properties.level,
          playerId: properties.playerId,
          regionId: properties.regionId,
          soldiersCount: properties.soldiersCount,
          type: properties.type,
        })
        .from(properties)
        .where(eq(properties.playerId, context.player.id))
        .orderBy(desc(properties.createdAt))
        .limit(1);
      if (latest) {
        context.property = {
          ...latest,
          regionId: latest.regionId as RegionId,
          type: latest.type as PropertyType,
        };
        context.propertyId = latest.id;
      }
    }

    if (!context.property) {
      throw new WorldOpsError('Informe --property-id ou conceda uma propriedade antes do ajuste.');
    }
    if (expectedType && context.property.type !== expectedType) {
      throw new WorldOpsError(`A propriedade atual é ${context.property.type}; era esperado ${expectedType}.`);
    }
    return context.property;
  }

  private async resolveTargetRegionId(context: WorldOpsContext): Promise<RegionId> {
    if (context.regionId) {
      return context.regionId;
    }
    if (context.player?.regionId) {
      context.regionId = context.player.regionId;
      return context.player.regionId;
    }
    if (context.favela?.regionId) {
      context.regionId = context.favela.regionId;
      return context.favela.regionId;
    }
    throw new WorldOpsError('Informe --region-id ou selecione um jogador/favela com região conhecida.');
  }

  private async resolveDefaultFavelaId(context: WorldOpsContext, regionId: RegionId): Promise<string> {
    if (context.favelaId) {
      return context.favelaId;
    }

    const [favela] = await db
      .select({
        id: favelas.id,
      })
      .from(favelas)
      .where(and(eq(favelas.regionId, regionId), eq(favelas.isActive, true)))
      .orderBy(asc(favelas.sortOrder), asc(favelas.name))
      .limit(1);

    if (!favela) {
      throw new WorldOpsError(`Nenhuma favela ativa encontrada em ${regionId} para vincular o negócio.`);
    }

    context.favelaId = favela.id;
    return favela.id;
  }

  private async requireDefaultFactoryDrug(): Promise<{ code: string; id: string }> {
    const [drug] = await db
      .select({
        code: drugs.code,
        id: drugs.id,
      })
      .from(drugs)
      .orderBy(asc(drugs.price), asc(drugs.name))
      .limit(1);

    if (!drug) {
      throw new WorldOpsError('Nenhuma droga cadastrada para inicializar a fábrica.');
    }

    return drug;
  }

  private async requireDrugByCodeOrId(drugCodeOrId: string): Promise<{ code: string; id: string }> {
    const [drug] = await db
      .select({
        code: drugs.code,
        id: drugs.id,
      })
      .from(drugs)
      .where(isUuid(drugCodeOrId) ? or(eq(drugs.id, drugCodeOrId), eq(drugs.code, drugCodeOrId)) : eq(drugs.code, drugCodeOrId))
      .limit(1);

    if (!drug) {
      throw new WorldOpsError(`Droga não encontrada para ${drugCodeOrId}.`);
    }

    return drug;
  }

  private requireCashCarrier(propertyType: PropertyType): PropertyCashCarrier {
    if (
      propertyType === 'boca' ||
      propertyType === 'rave' ||
      propertyType === 'puteiro' ||
      propertyType === 'front_store' ||
      propertyType === 'slot_machine'
    ) {
      return propertyType;
    }

    throw new WorldOpsError(`A propriedade ${propertyType} não possui caixa operacional ajustável.`);
  }

  private async readPropertyCashBalance(property: WorldPropertyRecord): Promise<number | null> {
    const carrier = resolveCashCarrier(property.type);
    if (!carrier) {
      return null;
    }

    if (carrier === 'boca') {
      const [row] = await db
        .select({ cashBalance: bocaOperations.cashBalance })
        .from(bocaOperations)
        .where(eq(bocaOperations.propertyId, property.id))
        .limit(1);
      return row ? Number.parseFloat(row.cashBalance) : 0;
    }
    if (carrier === 'rave') {
      const [row] = await db
        .select({ cashBalance: raveOperations.cashBalance })
        .from(raveOperations)
        .where(eq(raveOperations.propertyId, property.id))
        .limit(1);
      return row ? Number.parseFloat(row.cashBalance) : 0;
    }
    if (carrier === 'puteiro') {
      const [row] = await db
        .select({ cashBalance: puteiroOperations.cashBalance })
        .from(puteiroOperations)
        .where(eq(puteiroOperations.propertyId, property.id))
        .limit(1);
      return row ? Number.parseFloat(row.cashBalance) : 0;
    }
    if (carrier === 'front_store') {
      const [row] = await db
        .select({ cashBalance: frontStoreOperations.cashBalance })
        .from(frontStoreOperations)
        .where(eq(frontStoreOperations.propertyId, property.id))
        .limit(1);
      return row ? Number.parseFloat(row.cashBalance) : 0;
    }
    const [row] = await db
      .select({ cashBalance: slotMachineOperations.cashBalance })
      .from(slotMachineOperations)
      .where(eq(slotMachineOperations.propertyId, property.id))
      .limit(1);
    return row ? Number.parseFloat(row.cashBalance) : 0;
  }

  private async readPropertyOutput(propertyId: string): Promise<number | null> {
    const [row] = await db
      .select({
        storedOutput: drugFactories.storedOutput,
      })
      .from(drugFactories)
      .where(eq(drugFactories.propertyId, propertyId))
      .limit(1);
    return row?.storedOutput ?? null;
  }

  private async readCurrentRoundCycle(): Promise<{ currentGameDay: number; currentRoundId: string | null }> {
    const [activeRound] = await db
      .select({
        endsAt: round.endsAt,
        id: round.id,
        startedAt: round.startedAt,
      })
      .from(round)
      .where(eq(round.status, 'active'))
      .orderBy(desc(round.startedAt))
      .limit(1);

    if (!activeRound) {
      return { currentGameDay: 1, currentRoundId: null };
    }

    const elapsedMs = Math.max(0, Date.now() - activeRound.startedAt.getTime());
    return {
      currentGameDay: Math.max(1, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)) + 1),
      currentRoundId: activeRound.id,
    };
  }
}

async function readMarketSnapshot(): Promise<WorldOpsSnapshot['market']> {
  const rows = await db
    .select({
      isActive: marketSystemOffers.isActive,
      stockAvailable: marketSystemOffers.stockAvailable,
    })
    .from(marketSystemOffers);

  return {
    activeOffers: rows.filter((row) => row.isActive).length,
    totalOffers: rows.length,
    totalStockAvailable: rows.reduce((sum, row) => sum + row.stockAvailable, 0),
  };
}

function resolveCashCarrier(propertyType: PropertyType): PropertyCashCarrier | null {
  if (
    propertyType === 'boca' ||
    propertyType === 'rave' ||
    propertyType === 'puteiro' ||
    propertyType === 'front_store' ||
    propertyType === 'slot_machine'
  ) {
    return propertyType;
  }

  return null;
}

function clampPercent(value: number, operationType: string): number {
  return clampWhole(value, 0, 100, operationType);
}

function requireNonNegative(value: number, operationType: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new WorldOpsError(`${operationType} exige número maior ou igual a zero.`);
  }
  return Number(value);
}

function requireWholeNumber(value: number, operationType: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new WorldOpsError(`${operationType} exige número inteiro maior ou igual a zero.`);
  }
  return value;
}

function clampWhole(value: number, min: number, max: number, operationType: string): number {
  const next = requireWholeNumber(value, operationType);
  return Math.min(max, Math.max(min, next));
}

function clampMultiplier(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new WorldOpsError('priceMultiplier deve ser maior que zero.');
  }
  return Math.min(9.99, Math.max(0.1, value));
}

function toMoneyString(value: number): string {
  return value.toFixed(2);
}

function formatMoney(value: number | string): string {
  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value;
  return numeric.toLocaleString('pt-BR', {
    currency: 'BRL',
    minimumFractionDigits: 2,
    style: 'currency',
  });
}

function exhaustiveGuard(value: never): never {
  throw new WorldOpsError(`Operação de mundo não suportada: ${JSON.stringify(value)}`);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cloneContext(context: WorldOpsContext): WorldOpsContext {
  return {
    faction: context.faction ? { ...context.faction } : null,
    factionId: context.factionId,
    favela: context.favela ? { ...context.favela } : null,
    favelaId: context.favelaId,
    player: context.player ? { ...context.player } : null,
    playerId: context.playerId,
    property: context.property ? { ...context.property } : null,
    propertyId: context.propertyId,
    regionId: context.regionId,
  };
}

async function previewFavelaNumber(
  context: WorldOpsContext,
  operation: Extract<
    WorldOpsOperation,
    { type: 'set-bandits' } | { type: 'set-favela-satisfaction' } | { type: 'set-max-soldiers' }
  >,
  key: 'banditsActive' | 'maxSoldiers' | 'satisfaction',
  label: string,
  nextValue: number,
): Promise<{ changed: boolean; operationType: WorldOpsOperation['type']; summary: string }> {
  const service = new WorldOpsService();
  try {
    const favela = await service['requireContextFavela'](context);
    const changed = favela[key] !== nextValue;
    context.favela = { ...favela, [key]: nextValue };
    return {
      changed,
      operationType: operation.type,
      summary: changed
        ? `Dry-run: ${label} de ${favela.name} iria para ${nextValue}.`
        : `${label} de ${favela.name} já está em ${nextValue}.`,
    };
  } finally {
    await service.close();
  }
}

async function previewPropertyNumber(
  context: WorldOpsContext,
  operation: Extract<WorldOpsOperation, { type: 'set-property-level' } | { type: 'set-property-soldiers' }>,
  key: 'level' | 'soldiersCount',
  label: string,
  nextValue: number,
): Promise<{ changed: boolean; operationType: WorldOpsOperation['type']; summary: string }> {
  const service = new WorldOpsService();
  try {
    const property = await service['requireContextProperty'](context);
    const changed = property[key] !== nextValue;
    context.property = { ...property, [key]: nextValue };
    return {
      changed,
      operationType: operation.type,
      summary: changed
        ? `Dry-run: ${label} da propriedade ${property.type} iria para ${nextValue}.`
        : `${label} da propriedade ${property.type} já está em ${nextValue}.`,
    };
  } finally {
    await service.close();
  }
}
