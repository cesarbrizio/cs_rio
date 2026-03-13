import {
  RegionId,
  type ResolvedGameConfigCatalog,
  type DocksEventStatusResponse,
  type PoliceEventStatusResponse,
  type PoliceEventType,
  type SeasonalEventStatusResponse,
  type SeasonalEventType,
} from '@cs-rio/shared';
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  bocaDrugStocks,
  drugFactories,
  factions,
  favelaBanditReturns,
  favelas,
  gameEvents,
  prisonRecords,
  properties,
  raveDrugLineups,
  regions,
  soldiers,
} from '../db/schema.js';
import {
  buildBanditReturnSchedule,
  type BanditReturnFlavor,
} from './favela-force.js';

const NAVIO_DOCKS_REGION_ID = RegionId.Centro;
const MIN_NEXT_DOCKS_ARRIVAL_DELAY_MS = 18 * 60 * 60 * 1000;
const MAX_NEXT_DOCKS_ARRIVAL_DELAY_MS = 30 * 60 * 60 * 1000;
const DOCKS_EVENT_DURATION_MS = 6 * 60 * 60 * 1000;
const OPERACAO_POLICIAL_DURATION_MS = 2 * 60 * 60 * 1000;
const BLITZ_PM_DURATION_MS = 90 * 60 * 1000;
const FACA_NA_CAVEIRA_DURATION_MS = 75 * 60 * 1000;
const SAIDINHA_NATAL_DURATION_MS = 3 * 60 * 60 * 1000;
const OPERACAO_POLICIAL_COOLDOWN_MS = 10 * 60 * 60 * 1000;
const BLITZ_PM_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const FACA_NA_CAVEIRA_COOLDOWN_MS = 14 * 60 * 60 * 1000;
const SAIDINHA_NATAL_COOLDOWN_MS = 16 * 24 * 60 * 60 * 1000;
const CARNAVAL_DURATION_MS = 42 * 60 * 60 * 1000;
const ANO_NOVO_COPA_DURATION_MS = 18 * 60 * 60 * 1000;
const OPERACAO_VERAO_DURATION_MS = 24 * 60 * 60 * 1000;
const CARNAVAL_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const ANO_NOVO_COPA_COOLDOWN_MS = 11 * 24 * 60 * 60 * 1000;
const OPERACAO_VERAO_COOLDOWN_MS = 9 * 24 * 60 * 60 * 1000;
const CARNAVAL_TARGET_REGIONS: RegionId[] = [RegionId.ZonaSul, RegionId.Centro];
const ANO_NOVO_COPA_TARGET_REGIONS: RegionId[] = [RegionId.ZonaSul, RegionId.Centro];
const OPERACAO_VERAO_TARGET_REGIONS: RegionId[] = [RegionId.ZonaSul];

type ConfigurableEventType =
  | 'navio_docas'
  | 'saidinha_natal'
  | PoliceEventType
  | SeasonalEventType;

interface DocksEventDefinition {
  durationMs: number;
  headline: string;
  maxNextDelayMs: number;
  minNextDelayMs: number;
  premiumMultiplier: number;
  regionIds: RegionId[];
  source: string;
  unlimitedDemand: boolean;
}

interface PoliceOperationEventDefinition {
  banditArrestRateMax: number;
  banditArrestRateMin: number;
  candidateScoreBase: number;
  candidateScoreDifficultyWeight: number;
  candidateScorePolicePressureWeight: number;
  candidateScoreSatisfactionWeight: number;
  cooldownMs: number;
  durationMs: number;
  headline: string;
  lowSatisfactionRollWeight: number;
  lowSatisfactionRollWeightBaseline: number;
  policePressureRollWeight: number;
  pressureIncreaseBase: number;
  pressureIncreaseLowSatisfaction: number;
  pressureIncreaseLowSatisfactionThreshold: number;
  rollChanceBase: number;
  satisfactionPenaltyBase: number;
  satisfactionPenaltyLowSatisfaction: number;
  satisfactionPenaltyThreshold: number;
  source: string;
}

interface BlitzPmEventDefinition {
  candidateScoreBase: number;
  candidateScorePolicePressureWeight: number;
  cooldownMs: number;
  crowdedFavelaThreshold: number;
  durationMs: number;
  highPressureThreshold: number;
  headline: string;
  operacaoVeraoPressureBonus: number;
  policePressureRollWeight: number;
  pressureIncreaseBase: number;
  pressureIncreaseHighPressure: number;
  rollChanceBase: number;
  satisfactionPenaltyBase: number;
  satisfactionPenaltyCrowded: number;
  source: string;
}

interface FacaNaCaveiraEventDefinition {
  banditKillRateMax: number;
  banditKillRateMin: number;
  candidateScoreDifficultyWeight: number;
  candidateScorePolicePressureWeight: number;
  candidateScoreSatisfactionWeight: number;
  cooldownMs: number;
  drugsLossRateMax: number;
  drugsLossRateMin: number;
  durationMs: number;
  headline: string;
  internalSatisfactionPenalty: number;
  lowSatisfactionRollWeight: number;
  lowSatisfactionRollWeightBaseline: number;
  minPolicePressure: number;
  policePressureExcessDivisor: number;
  pressureFloor: number;
  pressureReduction: number;
  rollChanceBase: number;
  satisfactionPenalty: number;
  soldiersLossRateMax: number;
  soldiersLossRateMin: number;
  source: string;
  weaponsLossRateMax: number;
  weaponsLossRateMin: number;
}

interface SaidinhaNatalEventDefinition {
  arrestedBanditsCap: number;
  arrestedBanditsWeight: number;
  controlledFavelaCap: number;
  controlledFavelaWeight: number;
  cooldownMs: number;
  durationMs: number;
  headline: string;
  prisonerCap: number;
  prisonerWeight: number;
  rollChanceBase: number;
  source: string;
}

interface SeasonalEventDefinition {
  bonusSummary: string[];
  cooldownMs: number;
  durationMs: number;
  headline: string;
  policeMood: 'distracted' | 'reinforced';
  policeRollMultiplier: number;
  regionIds: RegionId[];
  rollChance: number;
  source: string;
}

interface DocksEventRecord {
  endsAt: Date;
  id: string;
  regionId: RegionId;
  startedAt: Date;
}

interface RegionSnapshot {
  id: RegionId;
  name: string;
  policePressure: number;
}

interface ControlledFavelaSnapshot {
  banditsActive: number;
  banditsArrested: number;
  controllingFactionId: string | null;
  difficulty: number;
  factionInternalSatisfaction: number | null;
  id: string;
  name: string;
  population: number;
  regionId: RegionId;
  satisfaction: number;
}

interface FavelaDrugExposureRecord {
  drugId: string;
  kind: 'boca' | 'factory' | 'rave';
  propertyId: string;
  quantity: number;
}

interface FavelaSoldierTargetRecord {
  propertyId: string;
  soldierIds: string[];
  soldiersCount: number;
}

interface FavelaBopeExposure {
  drugTargets: FavelaDrugExposureRecord[];
  soldierTargets: FavelaSoldierTargetRecord[];
}

interface ActivePoliceEventRecord {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: PoliceEventType;
  favelaId: string | null;
  favelaName: string | null;
  regionId: RegionId;
  regionName: string;
  startedAt: Date;
}

interface ActiveSeasonalEventRecord {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: SeasonalEventType;
  regionId: RegionId;
  regionName: string;
  startedAt: Date;
}

interface CreatePoliceEventInput {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: PoliceEventType;
  favelaId?: string | null;
  regionId: RegionId;
  startedAt: Date;
}

interface CreateGlobalEventInput {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: 'saidinha_natal';
  startedAt: Date;
}

interface CreateSeasonalEventInput {
  dataJson: Record<string, unknown>;
  endsAt: Date;
  eventType: SeasonalEventType;
  regionId: RegionId;
  startedAt: Date;
}

interface SaidinhaReleaseResult {
  playerIds: string[];
  releasedPlayers: number;
}

const DOCKS_EVENT_FALLBACK: DocksEventDefinition = {
  durationMs: DOCKS_EVENT_DURATION_MS,
  headline: 'Navio nas Docas: a janela premium de escoamento abriu no Centro.',
  maxNextDelayMs: MAX_NEXT_DOCKS_ARRIVAL_DELAY_MS,
  minNextDelayMs: MIN_NEXT_DOCKS_ARRIVAL_DELAY_MS,
  premiumMultiplier: 1.5,
  regionIds: [NAVIO_DOCKS_REGION_ID],
  source: 'scheduled_docks_ship',
  unlimitedDemand: true,
};

const OPERACAO_POLICIAL_EVENT_FALLBACK: PoliceOperationEventDefinition = {
  banditArrestRateMax: 0.12,
  banditArrestRateMin: 0.05,
  candidateScoreBase: 10,
  candidateScoreDifficultyWeight: 4,
  candidateScorePolicePressureWeight: 0.8,
  candidateScoreSatisfactionWeight: 0.9,
  cooldownMs: OPERACAO_POLICIAL_COOLDOWN_MS,
  durationMs: OPERACAO_POLICIAL_DURATION_MS,
  headline: 'Operação Policial: a pressão subiu e a rua ficou mais quente.',
  lowSatisfactionRollWeight: 1 / 1200,
  lowSatisfactionRollWeightBaseline: 100,
  policePressureRollWeight: 1 / 1000,
  pressureIncreaseBase: 9,
  pressureIncreaseLowSatisfaction: 12,
  pressureIncreaseLowSatisfactionThreshold: 40,
  rollChanceBase: 0.04,
  satisfactionPenaltyBase: 6,
  satisfactionPenaltyLowSatisfaction: 8,
  satisfactionPenaltyThreshold: 35,
  source: 'scheduled_police_operation',
};

const BLITZ_PM_EVENT_FALLBACK: BlitzPmEventDefinition = {
  candidateScoreBase: 10,
  candidateScorePolicePressureWeight: 1,
  cooldownMs: BLITZ_PM_COOLDOWN_MS,
  crowdedFavelaThreshold: 2,
  durationMs: BLITZ_PM_DURATION_MS,
  highPressureThreshold: 70,
  headline: 'Blitz da PM: o cerco apertou e a circulação ficou mais arriscada.',
  operacaoVeraoPressureBonus: 2,
  policePressureRollWeight: 1 / 1100,
  pressureIncreaseBase: 6,
  pressureIncreaseHighPressure: 9,
  rollChanceBase: 0.05,
  satisfactionPenaltyBase: 2,
  satisfactionPenaltyCrowded: 3,
  source: 'scheduled_police_blitz',
};

const FACA_NA_CAVEIRA_EVENT_FALLBACK: FacaNaCaveiraEventDefinition = {
  banditKillRateMax: 0.17,
  banditKillRateMin: 0.12,
  candidateScoreDifficultyWeight: 5,
  candidateScorePolicePressureWeight: 1.4,
  candidateScoreSatisfactionWeight: 0.6,
  cooldownMs: FACA_NA_CAVEIRA_COOLDOWN_MS,
  drugsLossRateMax: 0.65,
  drugsLossRateMin: 0.35,
  durationMs: FACA_NA_CAVEIRA_DURATION_MS,
  headline:
    'As operações do BOPE não fazem prisioneiros, não tem desenrolo, é faca na caveira! Eles entram, tomam armas, drogas e matam!',
  internalSatisfactionPenalty: 8,
  lowSatisfactionRollWeight: 1 / 450,
  lowSatisfactionRollWeightBaseline: 45,
  minPolicePressure: 60,
  policePressureExcessDivisor: 180,
  pressureFloor: 10,
  pressureReduction: 25,
  rollChanceBase: 0.01,
  satisfactionPenalty: 14,
  soldiersLossRateMax: 0.05,
  soldiersLossRateMin: 0.02,
  source: 'scheduled_bope_operation',
  weaponsLossRateMax: 0.5,
  weaponsLossRateMin: 0.25,
};

const SAIDINHA_NATAL_EVENT_FALLBACK: SaidinhaNatalEventDefinition = {
  arrestedBanditsCap: 0.035,
  arrestedBanditsWeight: 0.0012,
  controlledFavelaCap: 0.02,
  controlledFavelaWeight: 0.002,
  cooldownMs: SAIDINHA_NATAL_COOLDOWN_MS,
  durationMs: SAIDINHA_NATAL_DURATION_MS,
  headline:
    'Saidinha de Natal! Os presos elegíveis ganharam a rua de novo e os bandidos voltaram para as favelas.',
  prisonerCap: 0.04,
  prisonerWeight: 0.004,
  rollChanceBase: 0.005,
  source: 'scheduled_saidinha_natal',
};

const SEASONAL_EVENT_FALLBACKS: Record<SeasonalEventType, SeasonalEventDefinition> = {
  ano_novo_copa: {
    bonusSummary: [
      'Zona Sul e Centro entram em pico de demanda noturna.',
      'Raves, tráfego e casas de entretenimento recebem bônus moderado de receita.',
      'A PM fica mais dispersa durante a virada, reduzindo a pressão imediata.',
    ],
    cooldownMs: ANO_NOVO_COPA_COOLDOWN_MS,
    durationMs: ANO_NOVO_COPA_DURATION_MS,
    headline:
      'Ano Novo em Copa: a virada lotou a Zona Sul e o Centro, com consumo em alta e policiamento espalhado.',
    policeMood: 'distracted',
    policeRollMultiplier: 0.72,
    regionIds: ANO_NOVO_COPA_TARGET_REGIONS,
    rollChance: 0.025,
    source: 'scheduled_ano_novo_copa',
  },
  carnaval: {
    bonusSummary: [
      'Raves e pontos de venda em Zona Sul e Centro faturam mais com turistas.',
      'Puteiros ficam mais cheios e lucrativos nas áreas quentes do evento.',
      'Polícia mais distraída reduz a frequência de blitz e operação policial nas regiões afetadas.',
    ],
    cooldownMs: CARNAVAL_COOLDOWN_MS,
    durationMs: CARNAVAL_DURATION_MS,
    headline:
      'Carnaval no Rio: turistas na pista, caixa quente na Zona Sul e a polícia distraída atrás do trio.',
    policeMood: 'distracted',
    policeRollMultiplier: 0.55,
    regionIds: CARNAVAL_TARGET_REGIONS,
    rollChance: 0.02,
    source: 'scheduled_carnaval',
  },
  operacao_verao: {
    bonusSummary: [
      'Fachadas da Zona Sul recebem fluxo extra da temporada.',
      'A polícia reforça a orla e aumenta o risco territorial na região.',
      'O evento prepara o terreno para crimes mais arriscados e lucrativos na fase econômica seguinte.',
    ],
    cooldownMs: OPERACAO_VERAO_COOLDOWN_MS,
    durationMs: OPERACAO_VERAO_DURATION_MS,
    headline:
      'Operação Verão: a PM reforçou a Zona Sul e o clima esquentou para quem insiste em operar na temporada.',
    policeMood: 'reinforced',
    policeRollMultiplier: 1.28,
    regionIds: OPERACAO_VERAO_TARGET_REGIONS,
    rollChance: 0.03,
    source: 'scheduled_operacao_verao',
  },
};

export interface GameEventRepository {
  applyFavelaSatisfactionImpact(input: {
    favelaId: string;
    nextSatisfaction: number;
    now: Date;
  }): Promise<void>;
  applyFactionInternalSatisfactionImpact(input: {
    factionId: string;
    nextInternalSatisfaction: number;
  }): Promise<void>;
  applyOperationPolicialBanditImpact(input: {
    arrests: Array<{
      quantity: number;
      releaseAt: Date;
      returnFlavor: BanditReturnFlavor;
    }>;
    favelaId: string;
  }): Promise<void>;
  applyFacaNaCaveiraImpact(input: {
    banditsKilled: number;
    drugImpacts: Array<{
      drugId: string;
      kind: 'boca' | 'factory' | 'rave';
      lostQuantity: number;
      propertyId: string;
    }>;
    favelaId: string;
    nextSatisfaction: number;
    now: Date;
    soldierImpacts: Array<{
      count: number;
      propertyId: string;
      soldierIds: string[];
    }>;
  }): Promise<void>;
  countArrestedBandits(): Promise<number>;
  countActivePrisoners(now: Date): Promise<number>;
  createDocksEvent(input: { endsAt: Date; regionId: RegionId; startedAt: Date }): Promise<void>;
  createGlobalEvent(input: CreateGlobalEventInput): Promise<void>;
  createPoliceEvent(input: CreatePoliceEventInput): Promise<void>;
  createSeasonalEvent(input: CreateSeasonalEventInput): Promise<void>;
  getFavelaBopeExposure(favelaId: string): Promise<FavelaBopeExposure>;
  hasRecentGlobalEvent(input: { eventType: 'saidinha_natal'; since: Date }): Promise<boolean>;
  hasRecentPoliceEvent(input: {
    eventType: PoliceEventType;
    regionId: RegionId;
    since: Date;
  }): Promise<boolean>;
  hasRecentSeasonalEvent(input: {
    eventType: SeasonalEventType;
    regionId: RegionId;
    since: Date;
  }): Promise<boolean>;
  listActivePoliceEvents(now: Date): Promise<ActivePoliceEventRecord[]>;
  listActiveSeasonalEvents(now: Date): Promise<ActiveSeasonalEventRecord[]>;
  listControlledFavelas(): Promise<ControlledFavelaSnapshot[]>;
  listRegions(): Promise<RegionSnapshot[]>;
  listUpcomingOrActiveDocksEvents(now: Date): Promise<DocksEventRecord[]>;
  releaseBanditsForSaidinha(): Promise<number>;
  releasePrisonersForSaidinha(now: Date): Promise<SaidinhaReleaseResult>;
  updateRegionPolicePressure(input: { nextPolicePressure: number; regionId: RegionId }): Promise<void>;
}

class DatabaseGameEventRepository implements GameEventRepository {
  async applyFavelaSatisfactionImpact(input: {
    favelaId: string;
    nextSatisfaction: number;
    now: Date;
  }): Promise<void> {
    await db
      .update(favelas)
      .set({
        satisfaction: input.nextSatisfaction,
        satisfactionSyncedAt: input.now,
      })
      .where(eq(favelas.id, input.favelaId));
  }

  async applyFactionInternalSatisfactionImpact(input: {
    factionId: string;
    nextInternalSatisfaction: number;
  }): Promise<void> {
    await db
      .update(factions)
      .set({
        internalSatisfaction: input.nextInternalSatisfaction,
      })
      .where(eq(factions.id, input.factionId));
  }

  async applyOperationPolicialBanditImpact(input: {
    arrests: Array<{
      quantity: number;
      releaseAt: Date;
      returnFlavor: BanditReturnFlavor;
    }>;
    favelaId: string;
  }): Promise<void> {
    const totalArrested = input.arrests.reduce((sum, entry) => sum + entry.quantity, 0);

    if (totalArrested <= 0) {
      return;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(favelas)
        .set({
          banditsActive: sql`greatest(${favelas.banditsActive} - ${totalArrested}, 0)`,
          banditsArrested: sql`${favelas.banditsArrested} + ${totalArrested}`,
        })
        .where(eq(favelas.id, input.favelaId));

      await tx.insert(favelaBanditReturns).values(
        input.arrests.map((entry) => ({
          favelaId: input.favelaId,
          quantity: entry.quantity,
          releaseAt: entry.releaseAt,
          returnFlavor: entry.returnFlavor,
        })),
      );
    });
  }

  async applyFacaNaCaveiraImpact(input: {
    banditsKilled: number;
    drugImpacts: Array<{
      drugId: string;
      kind: 'boca' | 'factory' | 'rave';
      lostQuantity: number;
      propertyId: string;
    }>;
    favelaId: string;
    nextSatisfaction: number;
    now: Date;
    soldierImpacts: Array<{
      count: number;
      propertyId: string;
      soldierIds: string[];
    }>;
  }): Promise<void> {
    await db.transaction(async (tx) => {
      for (const impact of input.drugImpacts) {
        if (impact.lostQuantity <= 0) {
          continue;
        }

        switch (impact.kind) {
          case 'boca':
            await tx
              .update(bocaDrugStocks)
              .set({
                quantity: sql`${bocaDrugStocks.quantity} - ${impact.lostQuantity}`,
              })
              .where(
                and(
                  eq(bocaDrugStocks.propertyId, impact.propertyId),
                  eq(bocaDrugStocks.drugId, impact.drugId),
                ),
              );
            break;
          case 'rave':
            await tx
              .update(raveDrugLineups)
              .set({
                quantity: sql`${raveDrugLineups.quantity} - ${impact.lostQuantity}`,
              })
              .where(
                and(
                  eq(raveDrugLineups.propertyId, impact.propertyId),
                  eq(raveDrugLineups.drugId, impact.drugId),
                ),
              );
            break;
          case 'factory':
            await tx
              .update(drugFactories)
              .set({
                storedOutput: sql`${drugFactories.storedOutput} - ${impact.lostQuantity}`,
              })
              .where(eq(drugFactories.propertyId, impact.propertyId));
            break;
        }
      }

      for (const impact of input.soldierImpacts) {
        if (impact.count <= 0 || impact.soldierIds.length === 0) {
          continue;
        }

        await tx.delete(soldiers).where(inArray(soldiers.id, impact.soldierIds));
        await tx
          .update(properties)
          .set({
            soldiersCount: sql`${properties.soldiersCount} - ${impact.count}`,
          })
          .where(eq(properties.id, impact.propertyId));
      }

      await tx
        .update(favelas)
        .set({
          banditsActive: sql`greatest(${favelas.banditsActive} - ${input.banditsKilled}, 0)`,
          banditsDeadRecent: sql`${favelas.banditsDeadRecent} + ${input.banditsKilled}`,
          satisfaction: input.nextSatisfaction,
          satisfactionSyncedAt: input.now,
        })
        .where(eq(favelas.id, input.favelaId));
    });
  }

  async createDocksEvent(input: { endsAt: Date; regionId: RegionId; startedAt: Date }): Promise<void> {
    await db.insert(gameEvents).values({
      dataJson: {
        phase: '14.2',
        source: 'scheduled_docks_ship',
      },
      endsAt: input.endsAt,
      eventType: 'navio_docas',
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async countActivePrisoners(now: Date): Promise<number> {
    const rows = await db
      .select({
        playerId: prisonRecords.playerId,
      })
      .from(prisonRecords)
      .where(gt(prisonRecords.releaseAt, now));

    return new Set(rows.map((row) => row.playerId)).size;
  }

  async countArrestedBandits(): Promise<number> {
    const [row] = await db
      .select({
        total: sql<number>`coalesce(sum(${favelas.banditsArrested}), 0)`.as('total'),
      })
      .from(favelas);

    return Number(row?.total ?? 0);
  }

  async createGlobalEvent(input: CreateGlobalEventInput): Promise<void> {
    await db.insert(gameEvents).values({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      favelaId: null,
      regionId: null,
      startedAt: input.startedAt,
    });
  }

  async createPoliceEvent(input: CreatePoliceEventInput): Promise<void> {
    await db.insert(gameEvents).values({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      favelaId: input.favelaId ?? null,
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async createSeasonalEvent(input: CreateSeasonalEventInput): Promise<void> {
    await db.insert(gameEvents).values({
      dataJson: input.dataJson,
      endsAt: input.endsAt,
      eventType: input.eventType,
      favelaId: null,
      regionId: input.regionId,
      startedAt: input.startedAt,
    });
  }

  async getFavelaBopeExposure(favelaId: string): Promise<FavelaBopeExposure> {
    const [soldierRows, bocaDrugRows, raveDrugRows, factoryDrugRows] = await Promise.all([
      db
        .select({
          propertyId: properties.id,
          soldierId: soldiers.id,
        })
        .from(properties)
        .innerJoin(soldiers, eq(soldiers.propertyId, properties.id))
        .where(and(eq(properties.favelaId, favelaId), eq(properties.suspended, false))),
      db
        .select({
          drugId: bocaDrugStocks.drugId,
          propertyId: properties.id,
          quantity: bocaDrugStocks.quantity,
        })
        .from(properties)
        .innerJoin(bocaDrugStocks, eq(bocaDrugStocks.propertyId, properties.id))
        .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'boca'))),
      db
        .select({
          drugId: raveDrugLineups.drugId,
          propertyId: properties.id,
          quantity: raveDrugLineups.quantity,
        })
        .from(properties)
        .innerJoin(raveDrugLineups, eq(raveDrugLineups.propertyId, properties.id))
        .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'rave'))),
      db
        .select({
          drugId: drugFactories.drugId,
          propertyId: properties.id,
          quantity: drugFactories.storedOutput,
        })
        .from(properties)
        .innerJoin(drugFactories, eq(drugFactories.propertyId, properties.id))
        .where(and(eq(properties.favelaId, favelaId), eq(properties.type, 'factory'))),
    ]);

    const soldierMap = new Map<string, string[]>();

    for (const row of soldierRows) {
      const current = soldierMap.get(row.propertyId) ?? [];
      current.push(row.soldierId);
      soldierMap.set(row.propertyId, current);
    }

    return {
      drugTargets: [
        ...bocaDrugRows.map((row) => ({
          drugId: row.drugId,
          kind: 'boca' as const,
          propertyId: row.propertyId,
          quantity: row.quantity,
        })),
        ...raveDrugRows.map((row) => ({
          drugId: row.drugId,
          kind: 'rave' as const,
          propertyId: row.propertyId,
          quantity: row.quantity,
        })),
        ...factoryDrugRows.map((row) => ({
          drugId: row.drugId,
          kind: 'factory' as const,
          propertyId: row.propertyId,
          quantity: row.quantity,
        })),
      ],
      soldierTargets: [...soldierMap.entries()].map(([propertyId, soldierIds]) => ({
        propertyId,
        soldierIds,
        soldiersCount: soldierIds.length,
      })),
    };
  }

  async hasRecentPoliceEvent(input: {
    eventType: PoliceEventType;
    regionId: RegionId;
    since: Date;
  }): Promise<boolean> {
    const rows = await db
      .select({
        id: gameEvents.id,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.eventType, input.eventType),
          eq(gameEvents.regionId, input.regionId),
          gte(gameEvents.endsAt, input.since),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async hasRecentGlobalEvent(input: {
    eventType: 'saidinha_natal';
    since: Date;
  }): Promise<boolean> {
    const rows = await db
      .select({
        id: gameEvents.id,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.eventType, input.eventType),
          isNull(gameEvents.regionId),
          gte(gameEvents.endsAt, input.since),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async hasRecentSeasonalEvent(input: {
    eventType: SeasonalEventType;
    regionId: RegionId;
    since: Date;
  }): Promise<boolean> {
    const rows = await db
      .select({
        id: gameEvents.id,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.eventType, input.eventType),
          eq(gameEvents.regionId, input.regionId),
          gte(gameEvents.endsAt, input.since),
        ),
      )
      .limit(1);

    return rows.length > 0;
  }

  async listActivePoliceEvents(now: Date): Promise<ActivePoliceEventRecord[]> {
    const rows = await db
      .select({
        dataJson: gameEvents.dataJson,
        endsAt: gameEvents.endsAt,
        eventType: gameEvents.eventType,
        favelaId: gameEvents.favelaId,
        favelaName: favelas.name,
        regionId: gameEvents.regionId,
        regionName: regions.name,
        startedAt: gameEvents.startedAt,
      })
      .from(gameEvents)
      .innerJoin(regions, eq(gameEvents.regionId, regions.id))
      .leftJoin(favelas, eq(gameEvents.favelaId, favelas.id))
      .where(
        and(
          inArray(gameEvents.eventType, ['operacao_policial', 'blitz_pm', 'faca_na_caveira']),
          lte(gameEvents.startedAt, now),
          gte(gameEvents.endsAt, now),
        ),
      )
      .orderBy(desc(gameEvents.startedAt));

    return rows.map((row) => ({
      dataJson: row.dataJson as Record<string, unknown>,
      endsAt: row.endsAt,
      eventType: row.eventType as PoliceEventType,
      favelaId: row.favelaId,
      favelaName: row.favelaName,
      regionId: row.regionId as RegionId,
      regionName: row.regionName,
      startedAt: row.startedAt,
    }));
  }

  async listActiveSeasonalEvents(now: Date): Promise<ActiveSeasonalEventRecord[]> {
    const rows = await db
      .select({
        dataJson: gameEvents.dataJson,
        endsAt: gameEvents.endsAt,
        eventType: gameEvents.eventType,
        regionId: gameEvents.regionId,
        regionName: regions.name,
        startedAt: gameEvents.startedAt,
      })
      .from(gameEvents)
      .innerJoin(regions, eq(gameEvents.regionId, regions.id))
      .where(
        and(
          inArray(gameEvents.eventType, ['ano_novo_copa', 'carnaval', 'operacao_verao']),
          lte(gameEvents.startedAt, now),
          gte(gameEvents.endsAt, now),
        ),
      )
      .orderBy(desc(gameEvents.startedAt), asc(regions.name));

    return rows.map((row) => ({
      dataJson: row.dataJson as Record<string, unknown>,
      endsAt: row.endsAt,
      eventType: row.eventType as SeasonalEventType,
      regionId: row.regionId as RegionId,
      regionName: row.regionName,
      startedAt: row.startedAt,
    }));
  }

  async listControlledFavelas(): Promise<ControlledFavelaSnapshot[]> {
    const rows = await db
      .select({
        banditsActive: favelas.banditsActive,
        banditsArrested: favelas.banditsArrested,
        controllingFactionId: favelas.controllingFactionId,
        difficulty: favelas.difficulty,
        factionInternalSatisfaction: factions.internalSatisfaction,
        id: favelas.id,
        name: favelas.name,
        population: favelas.population,
        regionId: favelas.regionId,
        satisfaction: favelas.satisfaction,
      })
      .from(favelas)
      .leftJoin(factions, eq(favelas.controllingFactionId, factions.id))
      .where(and(eq(favelas.state, 'controlled'), isNotNull(favelas.controllingFactionId)))
      .orderBy(asc(favelas.name));

    return rows.map((row) => ({
      banditsActive: row.banditsActive,
      banditsArrested: row.banditsArrested,
      controllingFactionId: row.controllingFactionId,
      difficulty: row.difficulty,
      factionInternalSatisfaction: row.factionInternalSatisfaction,
      id: row.id,
      name: row.name,
      population: row.population,
      regionId: row.regionId as RegionId,
      satisfaction: row.satisfaction,
    }));
  }

  async listRegions(): Promise<RegionSnapshot[]> {
    const rows = await db
      .select({
        id: regions.id,
        name: regions.name,
        policePressure: regions.policePressure,
      })
      .from(regions)
      .where(eq(regions.isActive, true))
      .orderBy(asc(regions.sortOrder), asc(regions.name));

    return rows.map((row) => ({
      id: row.id as RegionId,
      name: row.name,
      policePressure: row.policePressure,
    }));
  }

  async listUpcomingOrActiveDocksEvents(now: Date): Promise<DocksEventRecord[]> {
    const rows = await db
      .select({
        endsAt: gameEvents.endsAt,
        id: gameEvents.id,
        regionId: gameEvents.regionId,
        startedAt: gameEvents.startedAt,
      })
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.eventType, 'navio_docas'),
          gte(gameEvents.endsAt, now),
        ),
      )
      .orderBy(asc(gameEvents.startedAt))
      .limit(2);

    return rows.map((row) => ({
      endsAt: row.endsAt,
      id: row.id,
      regionId: row.regionId as RegionId,
      startedAt: row.startedAt,
    }));
  }

  async updateRegionPolicePressure(input: {
    nextPolicePressure: number;
    regionId: RegionId;
  }): Promise<void> {
    await db
      .update(regions)
      .set({
        policePressure: input.nextPolicePressure,
      })
      .where(eq(regions.id, input.regionId));
  }

  async releasePrisonersForSaidinha(now: Date): Promise<SaidinhaReleaseResult> {
    const activeRows = await db
      .select({
        playerId: prisonRecords.playerId,
      })
      .from(prisonRecords)
      .where(gt(prisonRecords.releaseAt, now));

    const playerIds = [...new Set(activeRows.map((row) => row.playerId))];

    if (playerIds.length === 0) {
      return {
        playerIds: [],
        releasedPlayers: 0,
      };
    }

    await db
      .update(prisonRecords)
      .set({
        releaseAt: now,
        releasedEarlyBy: null,
      })
      .where(gt(prisonRecords.releaseAt, now));

    return {
      playerIds,
      releasedPlayers: playerIds.length,
    };
  }

  async releaseBanditsForSaidinha(): Promise<number> {
    const rows = await db
      .select({
        favelaId: favelaBanditReturns.favelaId,
        id: favelaBanditReturns.id,
        quantity: favelaBanditReturns.quantity,
      })
      .from(favelaBanditReturns);

    if (rows.length === 0) {
      return 0;
    }

    const quantityByFavelaId = new Map<string, number>();

    for (const row of rows) {
      quantityByFavelaId.set(row.favelaId, (quantityByFavelaId.get(row.favelaId) ?? 0) + row.quantity);
    }

    await db.transaction(async (tx) => {
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
    });

    return rows.reduce((sum, row) => sum + row.quantity, 0);
  }
}

export interface GameEventServiceContract {
  getDocksStatus(now?: Date): Promise<DocksEventStatusResponse>;
  getPoliceStatus(now?: Date): Promise<PoliceEventStatusResponse>;
  getSeasonalStatus(now?: Date): Promise<SeasonalEventStatusResponse>;
  syncScheduledEvents(now?: Date): Promise<void>;
}

export interface GameEventConfigReaderContract {
  getResolvedCatalog(options?: {
    now?: Date;
    roundId?: string | null;
  }): Promise<ResolvedGameConfigCatalog>;
}

export interface GameEventServiceOptions {
  gameConfigService?: GameEventConfigReaderContract;
  random?: () => number;
  repository?: GameEventRepository;
}

class NoopGameEventConfigReader implements GameEventConfigReaderContract {
  async getResolvedCatalog(options: { now?: Date } = {}): Promise<ResolvedGameConfigCatalog> {
    return {
      activeRoundId: null,
      activeSet: null,
      entries: [],
      featureFlags: [],
      resolvedAt: (options.now ?? new Date()).toISOString(),
    };
  }
}

interface PoliceOperationCandidate {
  favela: ControlledFavelaSnapshot;
  region: RegionSnapshot;
  score: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function coerceNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function pickWeighted<T>(items: T[], getWeight: (item: T) => number, random: () => number): T | null {
  if (items.length === 0) {
    return null;
  }

  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, getWeight(item)), 0);

  if (totalWeight <= 0) {
    return items[0] ?? null;
  }

  let cursor = clamp01(random()) * totalWeight;

  for (const item of items) {
    cursor -= Math.max(0, getWeight(item));

    if (cursor <= 0) {
      return item;
    }
  }

  return items[items.length - 1] ?? null;
}

function resolveLossRate(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

function resolveQuantityLoss(quantity: number, rate: number): number {
  if (quantity <= 0) {
    return 0;
  }

  return Math.min(quantity, Math.max(1, Math.floor(quantity * rate)));
}

function allocateSoldierLosses(
  soldierTargets: FavelaSoldierTargetRecord[],
  totalLosses: number,
): Array<{
  count: number;
  propertyId: string;
  soldierIds: string[];
}> {
  if (totalLosses <= 0) {
    return [];
  }

  let remaining = totalLosses;
  const impacts: Array<{
    count: number;
    propertyId: string;
    soldierIds: string[];
  }> = [];

  for (const target of [...soldierTargets].sort((left, right) => right.soldiersCount - left.soldiersCount)) {
    if (remaining <= 0) {
      break;
    }

    const count = Math.min(target.soldiersCount, remaining);

    if (count <= 0) {
      continue;
    }

    impacts.push({
      count,
      propertyId: target.propertyId,
      soldierIds: target.soldierIds.slice(0, count),
    });
    remaining -= count;
  }

  return impacts;
}

function resolveSaidinhaNatalRollChance(
  activePrisoners: number,
  arrestedBandits: number,
  controlledFavelaCount: number,
  definition: SaidinhaNatalEventDefinition,
): number {
  if (activePrisoners <= 0 && arrestedBandits <= 0 && controlledFavelaCount <= 0) {
    return 0;
  }

  return clamp01(
    definition.rollChanceBase +
      Math.min(definition.prisonerCap, activePrisoners * definition.prisonerWeight) +
      Math.min(definition.arrestedBanditsCap, arrestedBandits * definition.arrestedBanditsWeight) +
      Math.min(definition.controlledFavelaCap, controlledFavelaCount * definition.controlledFavelaWeight),
  );
}

function hasActiveSeasonalEvent(
  events: ActiveSeasonalEventRecord[],
  eventType: SeasonalEventType,
  regionId: RegionId,
): boolean {
  return events.some((event) => event.eventType === eventType && event.regionId === regionId);
}

function resolveSeasonalPoliceRollMultiplier(
  events: ActiveSeasonalEventRecord[],
  catalog: ResolvedGameConfigCatalog,
  regionId: RegionId,
): number {
  let multiplier = 1;

  if (hasActiveSeasonalEvent(events, 'carnaval', regionId)) {
    multiplier *= resolveSeasonalEventDefinition(catalog, 'carnaval').policeRollMultiplier;
  }

  if (hasActiveSeasonalEvent(events, 'ano_novo_copa', regionId)) {
    multiplier *= resolveSeasonalEventDefinition(catalog, 'ano_novo_copa').policeRollMultiplier;
  }

  if (hasActiveSeasonalEvent(events, 'operacao_verao', regionId)) {
    multiplier *= resolveSeasonalEventDefinition(catalog, 'operacao_verao').policeRollMultiplier;
  }

  return multiplier;
}

function pickConfiguredRegionId(
  regionIds: RegionId[],
  fallbackRegionId: RegionId,
  random: () => number,
): RegionId {
  if (regionIds.length === 0) {
    return fallbackRegionId;
  }

  const index = Math.min(regionIds.length - 1, Math.floor(clamp01(random()) * regionIds.length));

  return regionIds[index] ?? fallbackRegionId;
}

function resolveEventFeatureEnabled(
  catalog: ResolvedGameConfigCatalog,
  eventType: ConfigurableEventType,
): boolean {
  const entry = catalog.featureFlags.find(
    (flag) =>
      flag.key === `events.${eventType}.enabled` &&
      flag.scope === 'event_type' &&
      flag.targetKey === eventType,
  );

  return entry ? entry.status === 'active' : true;
}

function resolveDocksEventDefinition(catalog: ResolvedGameConfigCatalog): DocksEventDefinition {
  return mergeEventDefinition(DOCKS_EVENT_FALLBACK, getEventDefinitionValue(catalog, 'navio_docas'));
}

function resolvePoliceOperationEventDefinition(
  catalog: ResolvedGameConfigCatalog,
): PoliceOperationEventDefinition {
  return mergeEventDefinition(
    OPERACAO_POLICIAL_EVENT_FALLBACK,
    getEventDefinitionValue(catalog, 'operacao_policial'),
  );
}

function resolveBlitzPmEventDefinition(catalog: ResolvedGameConfigCatalog): BlitzPmEventDefinition {
  return mergeEventDefinition(BLITZ_PM_EVENT_FALLBACK, getEventDefinitionValue(catalog, 'blitz_pm'));
}

function resolveFacaNaCaveiraEventDefinition(
  catalog: ResolvedGameConfigCatalog,
): FacaNaCaveiraEventDefinition {
  return mergeEventDefinition(
    FACA_NA_CAVEIRA_EVENT_FALLBACK,
    getEventDefinitionValue(catalog, 'faca_na_caveira'),
  );
}

function resolveSaidinhaNatalEventDefinition(
  catalog: ResolvedGameConfigCatalog,
): SaidinhaNatalEventDefinition {
  return mergeEventDefinition(
    SAIDINHA_NATAL_EVENT_FALLBACK,
    getEventDefinitionValue(catalog, 'saidinha_natal'),
  );
}

function resolveSeasonalEventDefinition(
  catalog: ResolvedGameConfigCatalog,
  eventType: SeasonalEventType,
): SeasonalEventDefinition {
  return mergeEventDefinition(SEASONAL_EVENT_FALLBACKS[eventType], getEventDefinitionValue(catalog, eventType));
}

function getEventDefinitionValue(
  catalog: ResolvedGameConfigCatalog,
  eventType: ConfigurableEventType,
): Record<string, unknown> {
  const entry = catalog.entries.find(
    (resolvedEntry) =>
      resolvedEntry.key === 'event.definition' &&
      resolvedEntry.scope === 'event_type' &&
      resolvedEntry.targetKey === eventType,
  );

  return entry?.valueJson ?? {};
}

function mergeEventDefinition<TDefinition extends object>(
  fallback: TDefinition,
  valueJson: Record<string, unknown>,
): TDefinition {
  const fallbackRecord = fallback as Record<string, unknown>;
  const resolved = { ...fallbackRecord } as Record<string, unknown>;

  for (const [key, fallbackValue] of Object.entries(fallbackRecord)) {
    const candidate = valueJson[key];

    if (typeof fallbackValue === 'number' && typeof candidate === 'number' && Number.isFinite(candidate)) {
      resolved[key] = candidate;
      continue;
    }

    if (typeof fallbackValue === 'string' && typeof candidate === 'string') {
      resolved[key] = candidate;
      continue;
    }

    if (typeof fallbackValue === 'boolean' && typeof candidate === 'boolean') {
      resolved[key] = candidate;
      continue;
    }

    if (
      Array.isArray(fallbackValue) &&
      Array.isArray(candidate) &&
      candidate.every((entry) => typeof entry === 'string')
    ) {
      resolved[key] = [...candidate];
    }
  }

  return resolved as TDefinition;
}

export class GameEventService implements GameEventServiceContract {
  private readonly gameConfigService: GameEventConfigReaderContract;

  private readonly random: () => number;

  private readonly repository: GameEventRepository;

  constructor(options: GameEventServiceOptions = {}) {
    this.gameConfigService = options.gameConfigService ?? new NoopGameEventConfigReader();
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseGameEventRepository();
  }

  async getDocksStatus(now: Date = new Date()): Promise<DocksEventStatusResponse> {
    const docksDefinition = resolveDocksEventDefinition(
      await this.gameConfigService.getResolvedCatalog({ now }),
    );
    const events = await this.repository.listUpcomingOrActiveDocksEvents(now);
    const current = events[0] ?? null;
    const regionId = docksDefinition.regionIds[0] ?? NAVIO_DOCKS_REGION_ID;

    if (!current) {
      return {
        endsAt: null,
        isActive: false,
        phase: 'idle',
        premiumMultiplier: docksDefinition.premiumMultiplier,
        regionId,
        remainingSeconds: 0,
        secondsUntilStart: 0,
        startsAt: null,
        unlimitedDemand: false,
      };
    }

    const isActive = current.startedAt.getTime() <= now.getTime();
    const remainingSeconds = isActive
      ? Math.max(0, Math.ceil((current.endsAt.getTime() - now.getTime()) / 1000))
      : 0;
    const secondsUntilStart = isActive
      ? 0
      : Math.max(0, Math.ceil((current.startedAt.getTime() - now.getTime()) / 1000));

    return {
      endsAt: current.endsAt.toISOString(),
      isActive,
      phase: isActive ? 'active' : 'scheduled',
      premiumMultiplier: docksDefinition.premiumMultiplier,
      regionId: current.regionId ?? regionId,
      remainingSeconds,
      secondsUntilStart,
      startsAt: current.startedAt.toISOString(),
      unlimitedDemand: isActive ? docksDefinition.unlimitedDemand : false,
    };
  }

  async getPoliceStatus(now: Date = new Date()): Promise<PoliceEventStatusResponse> {
    const events = await this.repository.listActivePoliceEvents(now);

    return {
      events: events.map((event) => ({
        banditsArrested: coerceNumberOrNull(event.dataJson.banditsArrested),
        banditsKilledEstimate: coerceNumberOrNull(event.dataJson.banditsKilledEstimate),
        drugsLost: coerceNumberOrNull(event.dataJson.drugsLost),
        endsAt: event.endsAt.toISOString(),
        eventType: event.eventType,
        favelaId: event.favelaId,
        favelaName: event.favelaName,
        headline:
          typeof event.dataJson.headline === 'string' ? event.dataJson.headline : null,
        internalSatisfactionAfter: coerceNumberOrNull(event.dataJson.internalSatisfactionAfter),
        internalSatisfactionBefore: coerceNumberOrNull(event.dataJson.internalSatisfactionBefore),
        policePressureAfter: coerceNumberOrNull(event.dataJson.policePressureAfter),
        policePressureBefore: coerceNumberOrNull(event.dataJson.policePressureBefore),
        regionId: event.regionId,
        regionName: event.regionName,
        remainingSeconds: Math.max(0, Math.ceil((event.endsAt.getTime() - now.getTime()) / 1000)),
        satisfactionAfter: coerceNumberOrNull(event.dataJson.satisfactionAfter),
        satisfactionBefore: coerceNumberOrNull(event.dataJson.satisfactionBefore),
        soldiersLost: coerceNumberOrNull(event.dataJson.soldiersLost),
        startedAt: event.startedAt.toISOString(),
        weaponsLost: coerceNumberOrNull(event.dataJson.weaponsLost),
      })),
      generatedAt: now.toISOString(),
    };
  }

  async getSeasonalStatus(now: Date = new Date()): Promise<SeasonalEventStatusResponse> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog({ now });
    const events = await this.repository.listActiveSeasonalEvents(now);

    return {
      events: events.map((event) => ({
        ...(() => {
          const definition = resolveSeasonalEventDefinition(configCatalog, event.eventType);

          return {
            bonusSummary:
              Array.isArray(event.dataJson.bonusSummary) &&
              event.dataJson.bonusSummary.every((entry) => typeof entry === 'string')
                ? [...event.dataJson.bonusSummary]
                : definition.bonusSummary,
            headline:
              typeof event.dataJson.headline === 'string'
                ? event.dataJson.headline
                : definition.headline,
            policeMood: definition.policeMood,
          };
        })(),
        endsAt: event.endsAt.toISOString(),
        eventType: event.eventType,
        regionId: event.regionId,
        regionName: event.regionName,
        remainingSeconds: Math.max(0, Math.ceil((event.endsAt.getTime() - now.getTime()) / 1000)),
        startedAt: event.startedAt.toISOString(),
      })),
      generatedAt: now.toISOString(),
    };
  }

  async syncScheduledEvents(now: Date = new Date()): Promise<void> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog({ now });
    await this.syncDocks(now, configCatalog);
    await this.syncOperationPolicial(now, configCatalog);
    await this.syncBlitzPm(now, configCatalog);
    await this.syncFacaNaCaveira(now, configCatalog);
    await this.syncSaidinhaNatal(now, configCatalog);
    await this.syncSeasonalEvents(now, configCatalog);
  }

  private async syncBlitzPm(
    now: Date,
    configCatalog?: ResolvedGameConfigCatalog,
  ): Promise<void> {
    const catalog = configCatalog ?? (await this.gameConfigService.getResolvedCatalog({ now }));
    const blitzDefinition = resolveBlitzPmEventDefinition(catalog);

    if (!resolveEventFeatureEnabled(catalog, 'blitz_pm')) {
      return;
    }

    const [regionsList, controlledFavelas, activeSeasonalEvents] = await Promise.all([
      this.repository.listRegions(),
      this.repository.listControlledFavelas(),
      this.repository.listActiveSeasonalEvents(now),
    ]);
    const controlledByRegion = new Map<RegionId, ControlledFavelaSnapshot[]>();

    for (const favela of controlledFavelas) {
      const current = controlledByRegion.get(favela.regionId) ?? [];
      current.push(favela);
      controlledByRegion.set(favela.regionId, current);
    }

    const eligibleRegions: RegionSnapshot[] = [];

    for (const region of regionsList) {
      if ((controlledByRegion.get(region.id) ?? []).length === 0) {
        continue;
      }

      const hasRecentEvent = await this.repository.hasRecentPoliceEvent({
        eventType: 'blitz_pm',
        regionId: region.id,
        since: new Date(now.getTime() - blitzDefinition.cooldownMs),
      });

      if (!hasRecentEvent) {
        eligibleRegions.push(region);
      }
    }

    const selectedRegion = pickWeighted(
      eligibleRegions,
      (region) =>
        blitzDefinition.candidateScoreBase +
        region.policePressure * blitzDefinition.candidateScorePolicePressureWeight,
      this.random,
    );

    const seasonalRollMultiplier =
      selectedRegion !== null
        ? resolveSeasonalPoliceRollMultiplier(activeSeasonalEvents, catalog, selectedRegion.id)
        : 1;

    if (
      !selectedRegion ||
      this.random() >
        clamp01(
          (blitzDefinition.rollChanceBase +
            selectedRegion.policePressure * blitzDefinition.policePressureRollWeight) *
            seasonalRollMultiplier,
        )
    ) {
      return;
    }

    const pressureIncreaseBase =
      selectedRegion.policePressure >= blitzDefinition.highPressureThreshold
        ? blitzDefinition.pressureIncreaseHighPressure
        : blitzDefinition.pressureIncreaseBase;
    const pressureIncrease = hasActiveSeasonalEvent(activeSeasonalEvents, 'operacao_verao', selectedRegion.id)
      ? pressureIncreaseBase + blitzDefinition.operacaoVeraoPressureBonus
      : pressureIncreaseBase;
    const nextPolicePressure = clamp(selectedRegion.policePressure + pressureIncrease, 0, 100);
    const affectedFavelas = controlledByRegion.get(selectedRegion.id) ?? [];
    const satisfactionPenalty =
      affectedFavelas.length > blitzDefinition.crowdedFavelaThreshold
        ? blitzDefinition.satisfactionPenaltyCrowded
        : blitzDefinition.satisfactionPenaltyBase;
    const firstAffectedFavela = affectedFavelas[0] ?? null;

    await this.repository.updateRegionPolicePressure({
      nextPolicePressure,
      regionId: selectedRegion.id,
    });

    for (const favela of affectedFavelas) {
      await this.repository.applyFavelaSatisfactionImpact({
        favelaId: favela.id,
        nextSatisfaction: clamp(favela.satisfaction - satisfactionPenalty, 0, 100),
        now,
      });
    }

    await this.repository.createPoliceEvent({
      dataJson: {
        affectedFavelas: affectedFavelas.length,
        headline: blitzDefinition.headline,
        phase: '14.3',
        policePressureAfter: nextPolicePressure,
        policePressureBefore: selectedRegion.policePressure,
        pressureType: 'regional',
        seasonalPoliceMultiplier: Number(seasonalRollMultiplier.toFixed(2)),
        satisfactionAfter:
          firstAffectedFavela !== null
            ? clamp(firstAffectedFavela.satisfaction - satisfactionPenalty, 0, 100)
            : null,
        satisfactionBefore: firstAffectedFavela?.satisfaction ?? null,
        source: blitzDefinition.source,
      },
      endsAt: new Date(now.getTime() + blitzDefinition.durationMs),
      eventType: 'blitz_pm',
      regionId: selectedRegion.id,
      startedAt: now,
    });
  }

  private async syncDocks(
    now: Date,
    configCatalog?: ResolvedGameConfigCatalog,
  ): Promise<void> {
    const catalog = configCatalog ?? (await this.gameConfigService.getResolvedCatalog({ now }));
    const docksDefinition = resolveDocksEventDefinition(catalog);

    if (!resolveEventFeatureEnabled(catalog, 'navio_docas')) {
      return;
    }

    const events = await this.repository.listUpcomingOrActiveDocksEvents(now);

    if (events.length > 0) {
      return;
    }

    const nextDelayMs =
      docksDefinition.minNextDelayMs +
      Math.round(
        clamp01(this.random()) *
          (docksDefinition.maxNextDelayMs - docksDefinition.minNextDelayMs),
      );
    const targetRegionId = pickConfiguredRegionId(
      docksDefinition.regionIds,
      NAVIO_DOCKS_REGION_ID,
      this.random,
    );
    const startedAt = new Date(now.getTime() + nextDelayMs);
    const endsAt = new Date(startedAt.getTime() + docksDefinition.durationMs);

    await this.repository.createDocksEvent({
      endsAt,
      regionId: targetRegionId,
      startedAt,
    });
  }

  private async syncOperationPolicial(
    now: Date,
    configCatalog?: ResolvedGameConfigCatalog,
  ): Promise<void> {
    const catalog = configCatalog ?? (await this.gameConfigService.getResolvedCatalog({ now }));
    const operationDefinition = resolvePoliceOperationEventDefinition(catalog);

    if (!resolveEventFeatureEnabled(catalog, 'operacao_policial')) {
      return;
    }

    const [regionsList, controlledFavelas, activeSeasonalEvents] = await Promise.all([
      this.repository.listRegions(),
      this.repository.listControlledFavelas(),
      this.repository.listActiveSeasonalEvents(now),
    ]);
    const regionsById = new Map(regionsList.map((region) => [region.id, region]));
    const candidates: PoliceOperationCandidate[] = [];

    for (const favela of controlledFavelas) {
      const region = regionsById.get(favela.regionId);

      if (!region) {
        continue;
      }

      const hasRecentEvent = await this.repository.hasRecentPoliceEvent({
        eventType: 'operacao_policial',
        regionId: favela.regionId,
        since: new Date(now.getTime() - operationDefinition.cooldownMs),
      });

      if (hasRecentEvent) {
        continue;
      }

      const candidate: PoliceOperationCandidate = {
        favela,
        region,
        score: 0,
      };

      candidate.score =
        operationDefinition.candidateScoreBase +
        candidate.region.policePressure * operationDefinition.candidateScorePolicePressureWeight +
        (100 - candidate.favela.satisfaction) * operationDefinition.candidateScoreSatisfactionWeight +
        candidate.favela.difficulty * operationDefinition.candidateScoreDifficultyWeight;
      candidates.push(candidate);
    }

    const selectedCandidate = pickWeighted(candidates, (candidate) => candidate.score, this.random);

    const seasonalRollMultiplier =
      selectedCandidate !== null
        ? resolveSeasonalPoliceRollMultiplier(activeSeasonalEvents, catalog, selectedCandidate.region.id)
        : 1;

    if (
      !selectedCandidate ||
      this.random() >
        clamp01(
          (operationDefinition.rollChanceBase +
            selectedCandidate.region.policePressure * operationDefinition.policePressureRollWeight +
            (100 - selectedCandidate.favela.satisfaction) * operationDefinition.lowSatisfactionRollWeight +
            selectedCandidate.favela.difficulty * operationDefinition.candidateScoreDifficultyWeight * 0.001) *
            seasonalRollMultiplier,
        )
    ) {
      return;
    }

    const pressureIncrease =
      selectedCandidate.favela.satisfaction < operationDefinition.pressureIncreaseLowSatisfactionThreshold
        ? operationDefinition.pressureIncreaseLowSatisfaction
        : operationDefinition.pressureIncreaseBase;
    const nextPolicePressure = clamp(
      selectedCandidate.region.policePressure + pressureIncrease,
      0,
      100,
    );
    const satisfactionPenalty =
      selectedCandidate.favela.satisfaction < operationDefinition.satisfactionPenaltyThreshold
        ? operationDefinition.satisfactionPenaltyLowSatisfaction
        : operationDefinition.satisfactionPenaltyBase;
    const nextSatisfaction = clamp(
      selectedCandidate.favela.satisfaction - satisfactionPenalty,
      0,
      100,
    );
    const banditsArrested =
      selectedCandidate.favela.banditsActive > 0
        ? resolveQuantityLoss(
            selectedCandidate.favela.banditsActive,
            resolveLossRate(
              this.random,
              operationDefinition.banditArrestRateMin,
              operationDefinition.banditArrestRateMax,
            ),
          )
        : 0;
    const banditReturnSchedule =
      banditsArrested > 0
        ? buildBanditReturnSchedule({
            now,
            quantity: banditsArrested,
            random: this.random,
          })
        : null;

    await this.repository.updateRegionPolicePressure({
      nextPolicePressure,
      regionId: selectedCandidate.region.id,
    });
    await this.repository.applyFavelaSatisfactionImpact({
      favelaId: selectedCandidate.favela.id,
      nextSatisfaction,
      now,
    });
    await this.repository.applyOperationPolicialBanditImpact({
      arrests:
        banditReturnSchedule && banditsArrested > 0
          ? [
              {
                quantity: banditsArrested,
                releaseAt: banditReturnSchedule.releaseAt,
                returnFlavor: banditReturnSchedule.flavor,
              },
            ]
          : [],
      favelaId: selectedCandidate.favela.id,
    });
    await this.repository.createPoliceEvent({
      dataJson: {
        banditsArrested,
        headline: operationDefinition.headline,
        phase: '14.3',
        policePressureAfter: nextPolicePressure,
        policePressureBefore: selectedCandidate.region.policePressure,
        seasonalPoliceMultiplier: Number(seasonalRollMultiplier.toFixed(2)),
        satisfactionAfter: nextSatisfaction,
        satisfactionBefore: selectedCandidate.favela.satisfaction,
        score: Number(selectedCandidate.score.toFixed(2)),
        source: operationDefinition.source,
      },
      endsAt: new Date(now.getTime() + operationDefinition.durationMs),
      eventType: 'operacao_policial',
      favelaId: selectedCandidate.favela.id,
      regionId: selectedCandidate.region.id,
      startedAt: now,
    });
  }

  private async syncFacaNaCaveira(
    now: Date,
    configCatalog?: ResolvedGameConfigCatalog,
  ): Promise<void> {
    const catalog = configCatalog ?? (await this.gameConfigService.getResolvedCatalog({ now }));
    const bopeDefinition = resolveFacaNaCaveiraEventDefinition(catalog);

    if (!resolveEventFeatureEnabled(catalog, 'faca_na_caveira')) {
      return;
    }

    const [regionsList, controlledFavelas, activeSeasonalEvents] = await Promise.all([
      this.repository.listRegions(),
      this.repository.listControlledFavelas(),
      this.repository.listActiveSeasonalEvents(now),
    ]);
    const regionsById = new Map(regionsList.map((region) => [region.id, region]));
    const candidates: PoliceOperationCandidate[] = [];

    for (const favela of controlledFavelas) {
      const region = regionsById.get(favela.regionId);

      if (!region || region.policePressure < bopeDefinition.minPolicePressure) {
        continue;
      }

      const hasRecentEvent = await this.repository.hasRecentPoliceEvent({
        eventType: 'faca_na_caveira',
        regionId: favela.regionId,
        since: new Date(now.getTime() - bopeDefinition.cooldownMs),
      });

      if (hasRecentEvent) {
        continue;
      }

      const candidate: PoliceOperationCandidate = {
        favela,
        region,
        score: 0,
      };

      candidate.score =
        candidate.region.policePressure * bopeDefinition.candidateScorePolicePressureWeight +
        (100 - candidate.favela.satisfaction) * bopeDefinition.candidateScoreSatisfactionWeight +
        candidate.favela.difficulty * bopeDefinition.candidateScoreDifficultyWeight;
      candidates.push(candidate);
    }

    const selectedCandidate = pickWeighted(candidates, (candidate) => candidate.score, this.random);

    const seasonalRollMultiplier =
      selectedCandidate !== null
        ? resolveSeasonalPoliceRollMultiplier(activeSeasonalEvents, catalog, selectedCandidate.region.id)
        : 1;

    if (
      !selectedCandidate ||
      this.random() >
        clamp01(
          (bopeDefinition.rollChanceBase +
            Math.max(0, selectedCandidate.region.policePressure - bopeDefinition.minPolicePressure) /
              bopeDefinition.policePressureExcessDivisor +
            Math.max(
              0,
              bopeDefinition.lowSatisfactionRollWeightBaseline - selectedCandidate.favela.satisfaction,
            ) *
              bopeDefinition.lowSatisfactionRollWeight) *
            Math.max(0.7, seasonalRollMultiplier),
        )
    ) {
      return;
    }

    const exposure = await this.repository.getFavelaBopeExposure(selectedCandidate.favela.id);
    const drugsLossRate = resolveLossRate(
      this.random,
      bopeDefinition.drugsLossRateMin,
      bopeDefinition.drugsLossRateMax,
    );
    const soldiersLossRate = resolveLossRate(
      this.random,
      bopeDefinition.soldiersLossRateMin,
      bopeDefinition.soldiersLossRateMax,
    );
    const totalSoldiers = exposure.soldierTargets.reduce((sum, target) => sum + target.soldiersCount, 0);
    const soldiersLost = totalSoldiers > 0 ? resolveQuantityLoss(totalSoldiers, soldiersLossRate) : 0;
    const soldierImpacts = allocateSoldierLosses(exposure.soldierTargets, soldiersLost);
    const drugImpacts = exposure.drugTargets
      .map((target) => ({
        drugId: target.drugId,
        kind: target.kind,
        lostQuantity: resolveQuantityLoss(target.quantity, drugsLossRate),
        propertyId: target.propertyId,
      }))
      .filter((impact) => impact.lostQuantity > 0);
    const drugsLost = drugImpacts.reduce((sum, impact) => sum + impact.lostQuantity, 0);
    const weaponsLossRate = resolveLossRate(
      this.random,
      bopeDefinition.weaponsLossRateMin,
      bopeDefinition.weaponsLossRateMax,
    );
    const weaponsLost =
      totalSoldiers > 0 ? Math.max(soldiersLost, resolveQuantityLoss(totalSoldiers, weaponsLossRate)) : 0;
    const banditsKilled =
      selectedCandidate.favela.banditsActive > 0
        ? resolveQuantityLoss(
            selectedCandidate.favela.banditsActive,
            resolveLossRate(
              this.random,
              bopeDefinition.banditKillRateMin,
              bopeDefinition.banditKillRateMax,
            ),
          )
        : 0;
    const nextPolicePressure = clamp(
      selectedCandidate.region.policePressure - bopeDefinition.pressureReduction,
      bopeDefinition.pressureFloor,
      100,
    );
    const nextSatisfaction = clamp(
      selectedCandidate.favela.satisfaction - bopeDefinition.satisfactionPenalty,
      0,
      100,
    );
    const internalSatisfactionBefore = selectedCandidate.favela.factionInternalSatisfaction;
    const internalSatisfactionAfter =
      internalSatisfactionBefore !== null
        ? clamp(internalSatisfactionBefore - bopeDefinition.internalSatisfactionPenalty, 0, 100)
        : null;

    await this.repository.updateRegionPolicePressure({
      nextPolicePressure,
      regionId: selectedCandidate.region.id,
    });
    await this.repository.applyFacaNaCaveiraImpact({
      banditsKilled,
      drugImpacts,
      favelaId: selectedCandidate.favela.id,
      nextSatisfaction,
      now,
      soldierImpacts,
    });

    if (
      selectedCandidate.favela.controllingFactionId &&
      internalSatisfactionAfter !== null
    ) {
      await this.repository.applyFactionInternalSatisfactionImpact({
        factionId: selectedCandidate.favela.controllingFactionId,
        nextInternalSatisfaction: internalSatisfactionAfter,
      });
    }

    await this.repository.createPoliceEvent({
      dataJson: {
        banditsKilledEstimate: banditsKilled,
        drugsLost,
        headline: bopeDefinition.headline,
        internalSatisfactionAfter,
        internalSatisfactionBefore,
        phase: '14.4',
        policePressureAfter: nextPolicePressure,
        policePressureBefore: selectedCandidate.region.policePressure,
        seasonalPoliceMultiplier: Number(seasonalRollMultiplier.toFixed(2)),
        satisfactionAfter: nextSatisfaction,
        satisfactionBefore: selectedCandidate.favela.satisfaction,
        soldiersLost,
        source: bopeDefinition.source,
        weaponsLost,
      },
      endsAt: new Date(now.getTime() + bopeDefinition.durationMs),
      eventType: 'faca_na_caveira',
      favelaId: selectedCandidate.favela.id,
      regionId: selectedCandidate.region.id,
      startedAt: now,
    });
  }

  private async syncSaidinhaNatal(
    now: Date,
    configCatalog?: ResolvedGameConfigCatalog,
  ): Promise<void> {
    const catalog = configCatalog ?? (await this.gameConfigService.getResolvedCatalog({ now }));
    const saidinhaDefinition = resolveSaidinhaNatalEventDefinition(catalog);

    if (!resolveEventFeatureEnabled(catalog, 'saidinha_natal')) {
      return;
    }

    const [controlledFavelas, activePrisoners, arrestedBandits, hasRecentEvent] = await Promise.all([
      this.repository.listControlledFavelas(),
      this.repository.countActivePrisoners(now),
      this.repository.countArrestedBandits(),
      this.repository.hasRecentGlobalEvent({
        eventType: 'saidinha_natal',
        since: new Date(now.getTime() - saidinhaDefinition.cooldownMs),
      }),
    ]);

    if (hasRecentEvent) {
      return;
    }

    const rollChance = resolveSaidinhaNatalRollChance(
      activePrisoners,
      arrestedBandits,
      controlledFavelas.length,
      saidinhaDefinition,
    );

    if (rollChance <= 0 || this.random() > rollChance) {
      return;
    }

    const [releasedPlayers, releasedBandits] = await Promise.all([
      this.repository.releasePrisonersForSaidinha(now),
      this.repository.releaseBanditsForSaidinha(),
    ]);

    await this.repository.createGlobalEvent({
      dataJson: {
        headline: saidinhaDefinition.headline,
        phase: '14.5',
        releasedBanditsEstimate: releasedBandits,
        releasedPlayers: releasedPlayers.releasedPlayers,
        releasedPlayerIds: releasedPlayers.playerIds,
        source: saidinhaDefinition.source,
      },
      endsAt: new Date(now.getTime() + saidinhaDefinition.durationMs),
      eventType: 'saidinha_natal',
      startedAt: now,
    });
  }

  private async syncSeasonalEvents(
    now: Date,
    configCatalog?: ResolvedGameConfigCatalog,
  ): Promise<void> {
    const catalog = configCatalog ?? (await this.gameConfigService.getResolvedCatalog({ now }));

    await this.syncRegionalSeasonalEvent({
      catalog,
      definition: resolveSeasonalEventDefinition(catalog, 'carnaval'),
      eventType: 'carnaval',
      now,
    });
    await this.syncRegionalSeasonalEvent({
      catalog,
      definition: resolveSeasonalEventDefinition(catalog, 'ano_novo_copa'),
      eventType: 'ano_novo_copa',
      now,
    });
    await this.syncRegionalSeasonalEvent({
      catalog,
      definition: resolveSeasonalEventDefinition(catalog, 'operacao_verao'),
      eventType: 'operacao_verao',
      now,
    });
  }

  private async syncRegionalSeasonalEvent(input: {
    catalog: ResolvedGameConfigCatalog;
    definition: SeasonalEventDefinition;
    eventType: SeasonalEventType;
    now: Date;
  }): Promise<void> {
    if (!resolveEventFeatureEnabled(input.catalog, input.eventType)) {
      return;
    }
    const recentChecks = await Promise.all(
      input.definition.regionIds.map((regionId) =>
        this.repository.hasRecentSeasonalEvent({
          eventType: input.eventType,
          regionId,
          since: new Date(input.now.getTime() - input.definition.cooldownMs),
        }),
      ),
    );

    if (recentChecks.some(Boolean) || this.random() > input.definition.rollChance) {
      return;
    }

    const endsAt = new Date(input.now.getTime() + input.definition.durationMs);

    for (const regionId of input.definition.regionIds) {
      await this.repository.createSeasonalEvent({
        dataJson: {
          bonusSummary: input.definition.bonusSummary,
          headline: input.definition.headline,
          phase: '14.6',
          source: input.definition.source,
        },
        endsAt,
        eventType: input.eventType,
        regionId,
        startedAt: input.now,
      });
    }
  }
}
