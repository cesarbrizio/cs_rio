import {
  DEFAULT_PLAYER_HOSPITALIZATION_STATUS,
  DEFAULT_PLAYER_PRISON_STATUS,
  ROBBERY_DEFINITIONS,
  VEHICLE_ROBBERY_ROUTE_DEFINITIONS,
  type ResolvedGameConfigCatalog,
  type PlayerPrisonStatus,
  type FavelaControlState,
  type RegionId,
  type RobberyAttemptInput,
  type RobberyAttemptResponse as SharedRobberyAttemptResponse,
  type RobberyCatalogBanditFavelaSummary,
  type RobberyCatalogResponse as SharedRobberyCatalogResponse,
  type RobberyDefinitionSummary,
  type RobberyExecutorType,
  type RobberyFailureOutcome,
  type RobberyType,
  type VehicleRobberyRoute,
  type VehicleRobberyRouteDefinitionSummary,
  VocationType,
} from '@cs-rio/shared';
import { eq, inArray, sql } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import {
  factions,
  favelaBanditReturns,
  favelas,
  players,
  prisonRecords,
  regions,
  transactions,
} from '../db/schema.js';
import { DomainError, inferDomainErrorCategory } from '../errors/domain-error.js';
import { CooldownSystem } from '../systems/CooldownSystem.js';
import { OverdoseSystem } from '../systems/OverdoseSystem.js';
import { PoliceHeatSystem } from '../systems/PoliceHeatSystem.js';
import { PrisonSystem, type PrisonSystemContract, resolvePoliceHeatTier } from '../systems/PrisonSystem.js';
import { RedisKeyValueStore, type KeyValueStore } from './auth.js';
import {
  assertPlayerActionUnlocked,
  type HospitalizationSystemContract,
} from './action-readiness.js';
import {
  buildBanditReturnSchedule,
  resolveFavelaBanditTarget,
  syncFavelaBanditPool,
  type BanditReturnFlavor,
} from './favela-force.js';
import {
  applyFactionInternalSatisfactionDelta,
  type FactionRobberyPolicy,
  resolveFactionRobberyOutcomeSatisfactionDelta,
} from './faction-internal-satisfaction.js';
import {
  buildEmptyResolvedCatalog,
  resolveDefaultFactionRobberyPolicy,
} from './gameplay-config.js';
import { calculateFactionPointsDelta, insertFactionBankLedgerEntry } from './faction.js';
import { applyFactionBankDelta, applyPlayerResourceDeltas } from './financial-updates.js';
import { GameConfigService } from './game-config.js';
import { invalidatePlayerProfileCache } from './player-cache.js';
import { roundCurrency } from './property.js';
import {
  NoopUniversityEffectReader,
  type UniversityEffectReaderContract,
} from './university.js';

const ROBBERY_COOLDOWN_PREFIX = 'robbery';

interface RobberyPlayerRecord {
  carisma: number;
  characterCreatedAt: Date | null;
  factionId: string | null;
  factionInternalSatisfaction: number | null;
  forca: number;
  hp: number;
  id: string;
  level: number;
  money: number;
  disposicao: number;
  nickname: string;
  regionId: RegionId;
  resistencia: number;
  cansaco: number;
  vocation: VocationType;
}

interface RobberyRegionRecord {
  densityIndex: number;
  id: RegionId;
  name: string;
  operationCostMultiplier: number;
  policePressure: number;
  wealthIndex: number;
}

interface RobberyFavelaRecord {
  baseBanditTarget: number;
  banditsActive: number;
  banditsArrested: number;
  banditsDeadRecent: number;
  banditsSyncedAt: Date;
  controllingFactionId: string | null;
  difficulty: number;
  id: string;
  internalSatisfaction: number | null;
  name: string;
  population: number;
  regionId: RegionId;
  state: FavelaControlState;
}

interface RobberyBanditReturnRecord {
  favelaId: string;
  id: string;
  quantity: number;
  releaseAt: Date;
  returnFlavor: BanditReturnFlavor;
}

interface SyncedFavelaBanditState {
  favela: RobberyFavelaRecord;
  nextReturnAt: string | null;
  releasedReturnIds: string[];
}

interface PlayerRobberyResolution {
  effectiveCommissionRate: number;
  grossAmount: number;
  heatDelta: number;
  hpDelta: number;
  hospitalizationDurationMinutes: number | null;
  message: string;
  netAmount: number;
  disposicaoCost: number;
  outcome: RobberyFailureOutcome | 'success';
  prisonDurationMinutes: number | null;
  regionPolicePressureDelta: number;
  cansacoCost: number;
  success: boolean;
}

interface BanditRobberyResolution {
  arrestedNow: number;
  committed: number;
  effectiveCommissionRate: number;
  grossAmount: number;
  heatDelta: number;
  message: string;
  netAmount: number;
  outcome: RobberyFailureOutcome | 'success';
  returnSchedule: Array<{
    quantity: number;
    releaseAt: Date;
    returnFlavor: BanditReturnFlavor;
  }>;
  success: boolean;
}

interface ResolvedRobberyDefinition {
  baseCooldownSeconds: number;
  baseFactionCommissionRate: number;
  baseHeatDeltaRange: {
    max: number;
    min: number;
  };
  baseRewardRange: {
    max: number;
    min: number;
  };
  defaultBanditsCommitted: number;
  displayLabel: string;
  executorTypes: RobberyExecutorType[];
  id: RobberyType;
  maxBanditsCommitted: number;
  minimumLevel: number;
  riskLabel: 'alto' | 'baixo_medio' | 'medio' | 'medio_alto';
  vehicleRoute: VehicleRobberyRoute | null;
}

interface ResolvedRobberyCatalog {
  robberies: RobberyDefinitionSummary[];
  vehicleRoutes: VehicleRobberyRouteDefinitionSummary[];
}

interface RobberyCatalogResponse extends SharedRobberyCatalogResponse {
  factionRobberyPolicy: FactionRobberyPolicy | null;
}

interface RobberyAttemptResponse extends SharedRobberyAttemptResponse {
  policyDisplacedFromRegionId: RegionId | null;
}

export interface RobberyServiceOptions {
  cooldownSystem?: CooldownSystem;
  gameConfigService?: GameConfigService;
  hospitalizationSystem?: HospitalizationSystemContract;
  keyValueStore?: KeyValueStore;
  now?: () => Date;
  policeHeatSystem?: PoliceHeatSystem;
  prisonSystem?: PrisonSystemContract;
  random?: () => number;
  universityReader?: UniversityEffectReaderContract;
}

export interface RobberyServiceContract {
  attemptRobbery(
    playerId: string,
    robberyType: RobberyType,
    input: RobberyAttemptInput,
  ): Promise<RobberyAttemptResponse>;
  close?(): Promise<void>;
  getCatalog(playerId: string): Promise<RobberyCatalogResponse>;
}

type RobberyErrorCode =
  | 'character_not_ready'
  | 'conflict'
  | 'cooldown_active'
  | 'forbidden'
  | 'insufficient_resources'
  | 'not_found'
  | 'validation';

export function robberyError(code: RobberyErrorCode, message: string): DomainError {
  return new DomainError('robbery', code, inferDomainErrorCategory(code), message);
}

export class RobberyError extends DomainError {
  constructor(
    code: RobberyErrorCode,
    message: string,
  ) {
    super('robbery', code, inferDomainErrorCategory(code), message);
    this.name = 'RobberyError';
  }
}

export class RobberyService implements RobberyServiceContract {
  private readonly cooldownSystem: CooldownSystem;

  private readonly hospitalizationSystem: HospitalizationSystemContract;

  private readonly gameConfigService: GameConfigService;

  private readonly keyValueStore: KeyValueStore;

  private readonly now: () => Date;

  private readonly ownsCooldownSystem: boolean;

  private readonly ownsHospitalizationSystem: boolean;

  private readonly ownsPrisonSystem: boolean;

  private readonly ownsKeyValueStore: boolean;

  private readonly ownsPoliceHeatSystem: boolean;

  private readonly policeHeatSystem: PoliceHeatSystem;

  private readonly prisonSystem: PrisonSystemContract;

  private readonly random: () => number;

  private readonly universityReader: UniversityEffectReaderContract;

  constructor(options: RobberyServiceOptions = {}) {
    this.ownsKeyValueStore = !options.keyValueStore;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.ownsCooldownSystem = !options.cooldownSystem;
    this.ownsPoliceHeatSystem = !options.policeHeatSystem;
    this.ownsHospitalizationSystem = !options.hospitalizationSystem;
    this.ownsPrisonSystem = !options.prisonSystem;
    this.now = options.now ?? (() => new Date());
    this.cooldownSystem =
      options.cooldownSystem ??
      new CooldownSystem({
        keyValueStore: this.keyValueStore,
      });
    this.policeHeatSystem =
      options.policeHeatSystem ??
      new PoliceHeatSystem({
        keyValueStore: this.keyValueStore,
      });
    this.hospitalizationSystem =
      options.hospitalizationSystem ??
      new OverdoseSystem({
        keyValueStore: this.keyValueStore,
      });
    this.prisonSystem =
      options.prisonSystem ??
      new PrisonSystem({
        keyValueStore: this.keyValueStore,
        now: this.now,
      });
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.random = options.random ?? Math.random;
    this.universityReader = options.universityReader ?? new NoopUniversityEffectReader();
  }

  async close(): Promise<void> {
    if (this.ownsCooldownSystem) {
      await this.cooldownSystem.close?.();
    }

    if (this.ownsPoliceHeatSystem) {
      await this.policeHeatSystem.close?.();
    }

    if (this.ownsHospitalizationSystem) {
      await this.hospitalizationSystem.close?.();
    }

    if (this.ownsPrisonSystem) {
      await this.prisonSystem.close?.();
    }

    if (this.ownsKeyValueStore) {
      await this.keyValueStore.close?.();
    }
  }

  async getCatalog(playerId: string): Promise<RobberyCatalogResponse> {
    const player = await getRobberyPlayer(playerId);

    if (!player?.characterCreatedAt) {
      throw new RobberyError('character_not_ready', 'Crie seu personagem antes de acessar os roubos.');
    }

    const playerRegion = await getRobberyRegion(player.regionId);

    if (!playerRegion) {
      throw new RobberyError('not_found', 'Regiao atual do jogador nao encontrada.');
    }

    const banditFavelas =
      player.factionId !== null
        ? await this.listFactionBanditFavelas(player.factionId)
        : [];
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const catalog = await this.resolveRobberyCatalog(configCatalog);
    const factionRobberyPolicy =
      player.factionId !== null
        ? await getFactionRobberyPolicy(player.factionId, configCatalog)
        : null;

    return {
      banditFavelas,
      factionRobberyPolicy,
      playerRegion: {
        densityIndex: playerRegion.densityIndex,
        name: playerRegion.name,
        policePressure: playerRegion.policePressure,
        regionId: playerRegion.id,
        wealthIndex: playerRegion.wealthIndex,
      },
      robberies: catalog.robberies,
      vehicleRoutes: catalog.vehicleRoutes,
    };
  }

  async attemptRobbery(
    playerId: string,
    robberyType: RobberyType,
    input: RobberyAttemptInput,
  ): Promise<RobberyAttemptResponse> {
    const configCatalog = await this.gameConfigService.getResolvedCatalog();
    const definition = requireResolvedRobberyDefinition(
      robberyType,
      input.vehicleRoute,
      await this.resolveRobberyCatalog(configCatalog),
    );
    const player = await getRobberyPlayer(playerId);

    if (!player?.characterCreatedAt) {
      throw new RobberyError('character_not_ready', 'Crie seu personagem antes de iniciar roubos.');
    }

    const playerRegion = await getRobberyRegion(player.regionId);

    if (!playerRegion) {
      throw new RobberyError('not_found', 'Regiao atual do jogador nao encontrada.');
    }

    const executionRegion = await resolveFactionRobberyExecutionRegion(
      player.factionId,
      playerRegion,
      configCatalog,
    );

    const currentTime = this.now();
    await this.assertRobberyActionUnlocked(playerId);

    if (player.level < definition.minimumLevel) {
      throw new RobberyError(
        'forbidden',
        `Esse roubo desbloqueia apenas a partir do nivel ${definition.minimumLevel}.`,
      );
    }

    if (input.executorType === 'player') {
      return this.attemptPlayerRobbery(player, executionRegion.region, definition, currentTime, {
        policyDisplacedFromRegionId: executionRegion.policyDisplacedFromRegionId,
        policyTravelRiskPenalty: executionRegion.policyTravelRiskPenalty,
      });
    }

    return this.attemptBanditRobbery(player, executionRegion.region, definition, input, currentTime, {
      policyDisplacedFromRegionId: executionRegion.policyDisplacedFromRegionId,
      policyTravelRiskPenalty: executionRegion.policyTravelRiskPenalty,
    });
  }

  private async resolveRobberyCatalog(
    catalog?: ResolvedGameConfigCatalog,
  ): Promise<ResolvedRobberyCatalog> {
    const activeCatalog = catalog ?? (await this.gameConfigService.getResolvedCatalog());
    const robberies = ROBBERY_DEFINITIONS.filter((definition) =>
      isRobberyTypeEnabled(activeCatalog, definition.id),
    ).map((definition) => resolveConfiguredRobberyDefinition(activeCatalog, definition));

    const vehicleRoutes =
      robberies.some((definition) => definition.id === 'vehicle')
        ? VEHICLE_ROBBERY_ROUTE_DEFINITIONS.filter((definition) =>
            isVehicleRouteEnabled(activeCatalog, definition.id),
          ).map((definition) => resolveConfiguredVehicleRouteDefinition(activeCatalog, definition))
        : [];

    return {
      robberies,
      vehicleRoutes,
    };
  }

  private async attemptPlayerRobbery(
    player: RobberyPlayerRecord,
    region: RobberyRegionRecord,
    definition: ResolvedRobberyDefinition,
    currentTime: Date,
    policyContext: {
      policyDisplacedFromRegionId: RegionId | null;
      policyTravelRiskPenalty: number;
    },
  ): Promise<RobberyAttemptResponse> {
    const cooldown = await this.cooldownSystem.getCrimeCooldown(
      player.id,
      buildRobberyCooldownId('player', player.id, definition.id, definition.vehicleRoute),
    );

    if (cooldown.active) {
      throw new RobberyError(
        'cooldown_active',
        `Esse roubo ainda esta esfriando. Aguarde ${cooldown.remainingSeconds}s.`,
      );
    }

    if (player.cansaco < definitionPlayerCansacoCost(definition.id)) {
      throw new RobberyError('insufficient_resources', 'Cansaço insuficiente para esse roubo.');
    }

    if (player.disposicao < definitionPlayerDisposicaoCost(definition.id)) {
      throw new RobberyError('insufficient_resources', 'Disposição insuficiente para esse roubo.');
    }

    const [heatBefore, passiveProfile] = await Promise.all([
      this.policeHeatSystem.getHeat(player.id),
      this.universityReader.getPassiveProfile(player.id),
    ]);
    const resolution = resolvePlayerRobbery({
      definition,
      heatScore: heatBefore.score,
      passiveProfile,
      player,
      policyTravelRiskPenalty: policyContext.policyTravelRiskPenalty,
      random: this.random,
      region,
    });
    const nextPolicePressure = clamp(region.policePressure + resolution.regionPolicePressureDelta, 0, 100);
    let nextMoney = roundCurrency(player.money + resolution.netAmount);
    const nextCansaco = Math.max(0, player.cansaco - resolution.cansacoCost);
    const nextDisposicao = Math.max(0, player.disposicao - resolution.disposicaoCost);
    const nextHp = clamp(player.hp + resolution.hpDelta, 1, 100);
    const effectiveCommissionAmount =
      player.factionId !== null ? roundCurrency(resolution.grossAmount * resolution.effectiveCommissionRate) : 0;
    const effectiveNetAmount =
      player.factionId !== null
        ? roundCurrency(resolution.grossAmount - effectiveCommissionAmount)
        : resolution.grossAmount;
    const factionInternalSatisfactionAfter =
      player.factionId !== null && player.factionInternalSatisfaction !== null
        ? applyFactionInternalSatisfactionDelta(
            player.factionInternalSatisfaction,
            resolveFactionRobberyOutcomeSatisfactionDelta({
              executorType: 'player',
              outcome: resolution.outcome,
              robberyType: definition.id,
              success: resolution.success,
              vehicleRoute: definition.vehicleRoute,
            }),
          )
        : null;

    await this.assertRobberyActionUnlocked(player.id);
    await db.transaction(async (tx) => {
      const balanceMutation = await applyPlayerResourceDeltas(tx, player.id, {
        cansacoDelta: -resolution.cansacoCost,
        disposicaoDelta: -resolution.disposicaoCost,
        moneyDelta: resolution.netAmount,
      });

      if (balanceMutation.status !== 'updated') {
        throw new RobberyError('insufficient_resources', 'Nao foi possivel concluir o roubo com os recursos atuais.');
      }

      nextMoney = balanceMutation.player.money;

      await tx
        .update(players)
        .set({
          hp: nextHp,
        })
        .where(eq(players.id, player.id));

      await tx
        .update(regions)
        .set({
          policePressure: nextPolicePressure,
        })
        .where(eq(regions.id, region.id));

      if (resolution.success) {
        await tx.insert(transactions).values({
          amount: effectiveNetAmount.toFixed(2),
          description: `Lucro do roubo: ${definition.displayLabel}`,
          playerId: player.id,
          type: 'robbery_gain',
        });
      }

      if (effectiveCommissionAmount > 0 && player.factionId) {
        await creditFactionRobberyCommission(tx as never, {
          amount: effectiveCommissionAmount,
          factionId: player.factionId,
          now: currentTime,
          playerId: player.id,
          robberyLabel: definition.displayLabel,
        });
      }

      if (player.factionId && factionInternalSatisfactionAfter !== null) {
        await tx
          .update(factions)
          .set({
            internalSatisfaction: factionInternalSatisfactionAfter,
          })
          .where(eq(factions.id, player.factionId));
      }

      if (resolution.outcome === 'imprisoned' && resolution.prisonDurationMinutes !== null) {
        await tx.insert(prisonRecords).values({
          playerId: player.id,
          reason: `Flagrado em ${definition.displayLabel}`,
          releaseAt: new Date(currentTime.getTime() + resolution.prisonDurationMinutes * 60 * 1000),
          sentencedAt: currentTime,
        });
      }
    });

    const heatAfter = await this.policeHeatSystem.addHeat(player.id, resolution.heatDelta);
    const hospitalizationStatus =
      resolution.outcome === 'hospitalized' && resolution.hospitalizationDurationMinutes !== null
        ? await this.hospitalizationSystem.hospitalize(player.id, {
            durationMs: resolution.hospitalizationDurationMinutes * 60 * 1000,
            reason: 'combat',
          })
        : DEFAULT_PLAYER_HOSPITALIZATION_STATUS;
    const prisonStatus =
      resolution.outcome === 'imprisoned' && resolution.prisonDurationMinutes !== null
        ? buildPlayerPrisonStatus(
            new Date(currentTime.getTime() + resolution.prisonDurationMinutes * 60 * 1000),
            heatAfter.score,
            `Flagrado em ${definition.displayLabel}`,
            currentTime,
          )
        : DEFAULT_PLAYER_PRISON_STATUS;

    await Promise.all([
      this.cooldownSystem.activateCrimeCooldown(
        player.id,
        buildRobberyCooldownId('player', player.id, definition.id, definition.vehicleRoute),
        definition.baseCooldownSeconds,
      ),
      invalidatePlayerProfileCache(this.keyValueStore, player.id),
    ]);

    return {
      bandits: null,
      executorType: 'player',
      factionCommissionAmount: effectiveCommissionAmount,
      factionCommissionRatePercent: roundPercentage(
        player.factionId !== null ? resolution.effectiveCommissionRate * 100 : 0,
      ),
      grossAmount: resolution.grossAmount,
      message: resolution.message,
      netAmount: effectiveNetAmount,
      outcome: resolution.outcome,
      player: {
        heatAfter: heatAfter.score,
        heatBefore: heatBefore.score,
        heatDelta: resolution.heatDelta,
        heatTierAfter: resolvePoliceHeatTier(heatAfter.score),
        heatTierBefore: resolvePoliceHeatTier(heatBefore.score),
        hospitalization: hospitalizationStatus,
        hpAfter: nextHp,
        hpBefore: player.hp,
        hpDelta: nextHp - player.hp,
        moneyAfter: nextMoney,
        moneyBefore: player.money,
        moneyDelta: effectiveNetAmount,
        disposicaoAfter: nextDisposicao,
        disposicaoBefore: player.disposicao,
        disposicaoDelta: nextDisposicao - player.disposicao,
        prison: prisonStatus,
        cansacoAfter: nextCansaco,
        cansacoBefore: player.cansaco,
        cansacoDelta: nextCansaco - player.cansaco,
      },
      policyDisplacedFromRegionId: policyContext.policyDisplacedFromRegionId,
      regionId: region.id,
      regionName: region.name,
      regionPolicePressureAfter: nextPolicePressure,
      regionPolicePressureBefore: region.policePressure,
      regionPolicePressureDelta: resolution.regionPolicePressureDelta,
      robberyType: definition.id,
      success: resolution.success,
      vehicleRoute: definition.vehicleRoute,
    };
  }

  private async attemptBanditRobbery(
    player: RobberyPlayerRecord,
    region: RobberyRegionRecord,
    definition: ResolvedRobberyDefinition,
    input: RobberyAttemptInput,
    currentTime: Date,
    policyContext: {
      policyDisplacedFromRegionId: RegionId | null;
      policyTravelRiskPenalty: number;
    },
  ): Promise<RobberyAttemptResponse> {
    if (!player.factionId) {
      throw new RobberyError('forbidden', 'E preciso pertencer a uma faccao para usar bandidos da favela.');
    }

    if (!input.favelaId) {
      throw new RobberyError('validation', 'Informe a favela que vai executar o roubo.');
    }

    const syncedFavela = await this.syncFavelaBandits(input.favelaId, currentTime);
    const favela = syncedFavela.favela;

    if (favela.controllingFactionId !== player.factionId) {
      throw new RobberyError('forbidden', 'A favela informada nao esta sob controle da sua faccao.');
    }

    if (favela.regionId !== player.regionId) {
      throw new RobberyError(
        'forbidden',
        'Para coordenar os bandidos, o jogador precisa estar fisicamente na mesma regiao da favela.',
      );
    }

    const cooldown = await this.cooldownSystem.getCrimeCooldown(
      player.id,
      buildRobberyCooldownId('bandits', favela.id, definition.id, definition.vehicleRoute),
    );

    if (cooldown.active) {
      throw new RobberyError(
        'cooldown_active',
        `Os bandidos dessa favela ainda estao esfriando. Aguarde ${cooldown.remainingSeconds}s.`,
      );
    }

    const committed = normalizeCommittedBandits(input.banditsCommitted, definition, favela.banditsActive);

    if (committed > favela.banditsActive) {
      throw new RobberyError('conflict', 'Nao ha bandidos ativos suficientes nessa favela.');
    }

    const resolution = resolveBanditRobbery({
      committed,
      definition,
      now: currentTime,
      policyTravelRiskPenalty: policyContext.policyTravelRiskPenalty,
      random: this.random,
      region,
    });
    const nextPolicePressure = clamp(region.policePressure + resolution.heatDelta, 0, 100);
    const effectiveCommissionAmount = roundCurrency(resolution.grossAmount * resolution.effectiveCommissionRate);
    const effectiveNetAmount = roundCurrency(resolution.grossAmount - effectiveCommissionAmount);
    const arrestedNow = resolution.success ? 0 : resolution.arrestedNow;
    const activeAfter = Math.max(0, favela.banditsActive - arrestedNow);
    const arrestedAfter = favela.banditsArrested + arrestedNow;
    const nextReturnAt = resolution.returnSchedule[0]?.releaseAt.toISOString() ?? syncedFavela.nextReturnAt;
    const factionInternalSatisfactionAfter =
      favela.internalSatisfaction !== null
        ? applyFactionInternalSatisfactionDelta(
            favela.internalSatisfaction,
            resolveFactionRobberyOutcomeSatisfactionDelta({
              executorType: 'bandits',
              outcome: resolution.outcome,
              robberyType: definition.id,
              success: resolution.success,
              vehicleRoute: definition.vehicleRoute,
            }),
          )
        : null;

    await this.assertRobberyActionUnlocked(player.id);
    await db.transaction(async (tx) => {
      await tx
        .update(regions)
        .set({
          policePressure: nextPolicePressure,
        })
        .where(eq(regions.id, region.id));

      if (resolution.success) {
        const balanceMutation = await applyPlayerResourceDeltas(tx, player.id, {
          moneyDelta: effectiveNetAmount,
        });

        if (balanceMutation.status !== 'updated') {
          throw new RobberyError('not_found', 'Jogador nao encontrado para credito do roubo da favela.');
        }

        await tx.insert(transactions).values({
          amount: effectiveNetAmount.toFixed(2),
          description: `Caixa operacional do roubo da favela: ${definition.displayLabel}`,
          playerId: player.id,
          type: 'bandit_robbery_gain',
        });

        await creditFactionRobberyCommission(tx as never, {
          amount: effectiveCommissionAmount,
          factionId: player.factionId!,
          now: currentTime,
          playerId: player.id,
          robberyLabel: definition.displayLabel,
        });
      } else {
        await tx
          .update(favelas)
          .set({
            banditsActive: activeAfter,
            banditsArrested: arrestedAfter,
            banditsSyncedAt: currentTime,
          })
          .where(eq(favelas.id, favela.id));

        if (resolution.returnSchedule.length > 0) {
          await tx.insert(favelaBanditReturns).values(
            resolution.returnSchedule.map((entry) => ({
              favelaId: favela.id,
              quantity: entry.quantity,
              releaseAt: entry.releaseAt,
              returnFlavor: entry.returnFlavor,
            })),
          );
        }
      }

      if (factionInternalSatisfactionAfter !== null) {
        await tx
          .update(factions)
          .set({
            internalSatisfaction: factionInternalSatisfactionAfter,
          })
          .where(eq(factions.id, player.factionId!));
      }
    });

    await Promise.all([
      this.cooldownSystem.activateCrimeCooldown(
        player.id,
        buildRobberyCooldownId('bandits', favela.id, definition.id, definition.vehicleRoute),
        definition.baseCooldownSeconds,
      ),
      invalidatePlayerProfileCache(this.keyValueStore, player.id),
    ]);

    return {
      bandits: {
        activeAfter,
        arrestedAfter,
        arrestedNow,
        committed,
        deadRecentAfter: favela.banditsDeadRecent,
        killedNow: 0,
        nextReturnAt,
        returnBatchesCreated: resolution.returnSchedule.length,
      },
      executorType: 'bandits',
      factionCommissionAmount: effectiveCommissionAmount,
      factionCommissionRatePercent: roundPercentage(resolution.effectiveCommissionRate * 100),
      grossAmount: resolution.grossAmount,
      message: resolution.message,
      netAmount: resolution.success ? effectiveNetAmount : 0,
      outcome: resolution.outcome,
      player: null,
      policyDisplacedFromRegionId: policyContext.policyDisplacedFromRegionId,
      regionId: region.id,
      regionName: region.name,
      regionPolicePressureAfter: nextPolicePressure,
      regionPolicePressureBefore: region.policePressure,
      regionPolicePressureDelta: resolution.heatDelta,
      robberyType: definition.id,
      success: resolution.success,
      vehicleRoute: definition.vehicleRoute,
    };
  }

  private async listFactionBanditFavelas(
    factionId: string,
  ): Promise<RobberyCatalogBanditFavelaSummary[]> {
    const rows = await db
      .select({
        baseBanditTarget: favelas.baseBanditTarget,
        banditsActive: favelas.banditsActive,
        banditsArrested: favelas.banditsArrested,
        banditsDeadRecent: favelas.banditsDeadRecent,
        id: favelas.id,
        name: favelas.name,
        regionId: favelas.regionId,
      })
      .from(favelas)
      .where(eq(favelas.controllingFactionId, factionId))
      .orderBy(favelas.regionId, favelas.name);

    if (rows.length === 0) {
      return [];
    }

    const nextReturnRows = await db
      .select({
        favelaId: favelaBanditReturns.favelaId,
        releaseAt: sql<string>`min(${favelaBanditReturns.releaseAt})`,
      })
      .from(favelaBanditReturns)
      .where(inArray(favelaBanditReturns.favelaId, rows.map((entry) => entry.id)))
      .groupBy(favelaBanditReturns.favelaId);

    const nextReturnMap = new Map(nextReturnRows.map((row) => [row.favelaId, row.releaseAt]));

    return rows.map((row) => ({
      banditsActive: row.banditsActive,
      banditsArrested: row.banditsArrested,
      banditsDeadRecent: row.banditsDeadRecent,
      id: row.id,
      name: row.name,
      nextReturnAt: nextReturnMap.get(row.id) ?? null,
      regionId: row.regionId as RegionId,
    }));
  }

  private async assertRobberyActionUnlocked(playerId: string): Promise<void> {
    await assertPlayerActionUnlocked({
      getHospitalizationStatus: () => this.hospitalizationSystem.getHospitalizationStatus(playerId),
      getPrisonStatus: () => this.prisonSystem.getStatus(playerId),
      hospitalizedError: () =>
        new RobberyError('conflict', 'Jogador hospitalizado nao pode iniciar roubos.'),
      imprisonedError: () =>
        new RobberyError('conflict', 'Jogador preso nao pode iniciar roubos.'),
    });
  }

  private async syncFavelaBandits(
    favelaId: string,
    now: Date,
  ): Promise<SyncedFavelaBanditState> {
    const [row] = await db
      .select({
        baseBanditTarget: favelas.baseBanditTarget,
        banditsActive: favelas.banditsActive,
        banditsArrested: favelas.banditsArrested,
        banditsDeadRecent: favelas.banditsDeadRecent,
        banditsSyncedAt: favelas.banditsSyncedAt,
        controllingFactionId: favelas.controllingFactionId,
        difficulty: favelas.difficulty,
        id: favelas.id,
        internalSatisfaction: factions.internalSatisfaction,
        name: favelas.name,
        population: favelas.population,
        regionId: favelas.regionId,
        state: favelas.state,
      })
      .from(favelas)
      .leftJoin(factions, eq(favelas.controllingFactionId, factions.id))
      .where(eq(favelas.id, favelaId))
      .limit(1);

    if (!row) {
      throw new RobberyError('not_found', 'Favela informada nao encontrada.');
    }

    const favela: RobberyFavelaRecord = {
      baseBanditTarget: row.baseBanditTarget,
      banditsActive: row.banditsActive,
      banditsArrested: row.banditsArrested,
      banditsDeadRecent: row.banditsDeadRecent,
      banditsSyncedAt: row.banditsSyncedAt,
      controllingFactionId: row.controllingFactionId,
      difficulty: row.difficulty,
      id: row.id,
      internalSatisfaction: row.internalSatisfaction,
      name: row.name,
      population: row.population,
      regionId: row.regionId as RegionId,
      state: row.state,
    };

    const returnRows = await db
      .select({
        favelaId: favelaBanditReturns.favelaId,
        id: favelaBanditReturns.id,
        quantity: favelaBanditReturns.quantity,
        releaseAt: favelaBanditReturns.releaseAt,
        returnFlavor: favelaBanditReturns.returnFlavor,
      })
      .from(favelaBanditReturns)
      .where(eq(favelaBanditReturns.favelaId, favelaId))
      .orderBy(favelaBanditReturns.releaseAt);

    const pendingReturns: RobberyBanditReturnRecord[] = returnRows.map((row) => ({
      favelaId: row.favelaId,
      id: row.id,
      quantity: row.quantity,
      releaseAt: row.releaseAt,
      returnFlavor: row.returnFlavor,
    }));
    const dueReturns = pendingReturns.filter((entry) => entry.releaseAt.getTime() <= now.getTime());
    const returnedNow = dueReturns.reduce((sum, entry) => sum + entry.quantity, 0);
    const targetActive = resolveFavelaBanditTarget({
      baseBanditTarget: favela.baseBanditTarget,
      difficulty: favela.difficulty,
      internalSatisfaction: favela.internalSatisfaction,
      population: favela.population,
      state: favela.state,
    });
    const sync = syncFavelaBanditPool({
      active: favela.banditsActive,
      deadRecent: favela.banditsDeadRecent,
      lastSyncedAt: favela.banditsSyncedAt,
      now,
      returnedNow,
      targetActive,
    });
    const nextFavela: RobberyFavelaRecord = {
      ...favela,
      banditsActive: sync.active + returnedNow,
      banditsArrested: Math.max(0, favela.banditsArrested - returnedNow),
      banditsDeadRecent: sync.deadRecent,
      banditsSyncedAt: sync.syncedAt,
    };

    if (
      returnedNow > 0 ||
      nextFavela.banditsActive !== favela.banditsActive ||
      nextFavela.banditsArrested !== favela.banditsArrested ||
      nextFavela.banditsDeadRecent !== favela.banditsDeadRecent ||
      nextFavela.banditsSyncedAt.getTime() !== favela.banditsSyncedAt.getTime()
    ) {
      await db.transaction(async (tx) => {
        await tx
          .update(favelas)
          .set({
            banditsActive: nextFavela.banditsActive,
            banditsArrested: nextFavela.banditsArrested,
            banditsDeadRecent: nextFavela.banditsDeadRecent,
            banditsSyncedAt: nextFavela.banditsSyncedAt,
          })
          .where(eq(favelas.id, favelaId));

        if (dueReturns.length > 0) {
          await tx.delete(favelaBanditReturns).where(
            inArray(
              favelaBanditReturns.id,
              dueReturns.map((entry) => entry.id),
            ),
          );
        }
      });
    }

    return {
      favela: nextFavela,
      nextReturnAt:
        pendingReturns.find((entry) => !dueReturns.some((due) => due.id === entry.id))?.releaseAt.toISOString() ??
        null,
      releasedReturnIds: dueReturns.map((entry) => entry.id),
    };
  }
}

async function resolveFactionRobberyExecutionRegion(
  factionId: string | null,
  playerRegion: RobberyRegionRecord,
  catalog: ResolvedGameConfigCatalog,
): Promise<{
  policyDisplacedFromRegionId: RegionId | null;
  policyTravelRiskPenalty: number;
  region: RobberyRegionRecord;
}> {
  if (!factionId) {
    return {
      policyDisplacedFromRegionId: null,
      policyTravelRiskPenalty: 0,
      region: playerRegion,
    };
  }

  const policy = await getFactionRobberyPolicy(factionId, catalog);

  if (policy.global === 'forbidden') {
    throw new RobberyError('forbidden', 'A faccao proibiu roubos para todos os membros neste momento.');
  }

  if (policy.regions[playerRegion.id] !== 'forbidden') {
    return {
      policyDisplacedFromRegionId: null,
      policyTravelRiskPenalty: 0,
      region: playerRegion,
    };
  }

  const allowedRegions = (await listRobberyRegions()).filter(
    (region) => region.id !== playerRegion.id && policy.regions[region.id] !== 'forbidden',
  );
  const displacedRegion = allowedRegions[0];

  if (!displacedRegion) {
    throw new RobberyError(
      'forbidden',
      'A faccao proibiu roubos em todas as regioes disponiveis para esta operacao.',
    );
  }

  return {
    policyDisplacedFromRegionId: playerRegion.id,
    policyTravelRiskPenalty: 0.09,
    region: displacedRegion,
  };
}

async function getRobberyPlayer(playerId: string): Promise<RobberyPlayerRecord | null> {
  const [row] = await db
    .select({
      carisma: players.carisma,
      characterCreatedAt: players.characterCreatedAt,
      factionId: players.factionId,
      factionInternalSatisfaction: factions.internalSatisfaction,
      forca: players.forca,
      hp: players.hp,
      id: players.id,
      level: players.level,
      money: players.money,
      disposicao: players.disposicao,
      nickname: players.nickname,
      regionId: players.regionId,
      resistencia: players.resistencia,
      cansaco: players.cansaco,
      vocation: players.vocation,
    })
    .from(players)
    .leftJoin(factions, eq(players.factionId, factions.id))
    .where(eq(players.id, playerId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    carisma: row.carisma,
    characterCreatedAt: row.characterCreatedAt,
    factionId: row.factionId,
    factionInternalSatisfaction: row.factionInternalSatisfaction,
    forca: row.forca,
    hp: row.hp,
    id: row.id,
    level: row.level,
    money: parseFloat(String(row.money)),
    disposicao: row.disposicao,
    nickname: row.nickname,
    regionId: row.regionId as RegionId,
    resistencia: row.resistencia,
    cansaco: row.cansaco,
    vocation: row.vocation as VocationType,
  };
}

async function getFactionRobberyPolicy(
  factionId: string,
  catalog: ResolvedGameConfigCatalog = buildEmptyResolvedCatalog(),
): Promise<FactionRobberyPolicy> {
  const [row] = await db
    .select({
      robberyPolicyJson: factions.robberyPolicyJson,
    })
    .from(factions)
    .where(eq(factions.id, factionId))
    .limit(1);

  return normalizeFactionRobberyPolicy(
    row?.robberyPolicyJson ?? null,
    resolveDefaultFactionRobberyPolicy(catalog),
  );
}

async function getRobberyRegion(regionId: RegionId): Promise<RobberyRegionRecord | null> {
  const [row] = await db
    .select({
      densityIndex: regions.densityIndex,
      id: regions.id,
      name: regions.name,
      operationCostMultiplier: regions.operationCostMultiplier,
      policePressure: regions.policePressure,
      wealthIndex: regions.wealthIndex,
    })
    .from(regions)
    .where(eq(regions.id, regionId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    densityIndex: row.densityIndex,
    id: row.id as RegionId,
    name: row.name,
    operationCostMultiplier: parseFloat(String(row.operationCostMultiplier)),
    policePressure: row.policePressure,
    wealthIndex: row.wealthIndex,
  };
}

async function listRobberyRegions(): Promise<RobberyRegionRecord[]> {
  const rows = await db
    .select({
      densityIndex: regions.densityIndex,
      id: regions.id,
      name: regions.name,
      operationCostMultiplier: regions.operationCostMultiplier,
      policePressure: regions.policePressure,
      wealthIndex: regions.wealthIndex,
    })
    .from(regions)
    .orderBy(regions.name);

  return rows.map((row) => ({
    densityIndex: row.densityIndex,
    id: row.id as RegionId,
    name: row.name,
    operationCostMultiplier: parseFloat(String(row.operationCostMultiplier)),
    policePressure: row.policePressure,
    wealthIndex: row.wealthIndex,
  }));
}

async function creditFactionRobberyCommission(
  executor: typeof db,
  input: {
    amount: number;
    factionId: string;
    now: Date;
    playerId: string;
    robberyLabel: string;
  },
): Promise<void> {
  const pointsDelta = calculateFactionPointsDelta(input.amount);
  const factionMutation = await applyFactionBankDelta(executor, input.factionId, {
    bankMoneyDelta: input.amount,
    pointsDelta,
  });

  if (factionMutation.status !== 'updated') {
    return;
  }

  await insertFactionBankLedgerEntry(executor, {
    balanceAfter: factionMutation.faction.bankMoney,
    commissionAmount: input.amount,
    createdAt: input.now,
    description: `Repasse criminal de roubo: ${input.robberyLabel}`,
    entryType: 'robbery_commission',
    factionId: input.factionId,
    grossAmount: input.amount,
    netAmount: input.amount,
    originType: 'robbery',
    playerId: input.playerId,
  });
}

function resolvePlayerRobbery(input: {
  definition: ResolvedRobberyDefinition;
  heatScore: number;
  passiveProfile: Awaited<ReturnType<UniversityEffectReaderContract['getPassiveProfile']>>;
  player: RobberyPlayerRecord;
  policyTravelRiskPenalty: number;
  random: () => number;
  region: RobberyRegionRecord;
}): PlayerRobberyResolution {
  const cansacoCost = definitionPlayerCansacoCost(input.definition.id);
  const disposicaoCost = definitionPlayerDisposicaoCost(input.definition.id);
  const baseReward = randomBetween(
    input.random,
    input.definition.baseRewardRange.min,
    input.definition.baseRewardRange.max,
  );
  const rewardMultiplier = resolveRobberyRewardMultiplier(input.definition, input.region);
  const grossAmount = roundCurrency(baseReward * rewardMultiplier);
  const heatDelta = resolveHeatDelta(input.random, input.definition, 'player');
  const baseSuccessChance = clamp(
    1 -
      resolveBaseFailChance(input.definition.id) -
      resolveRegionRiskPenalty(input.definition, input.region) -
      input.policyTravelRiskPenalty -
      input.heatScore / 250 +
      resolvePlayerSkillBonus(input.player) +
      resolvePlayerVocationBonus(input.player.vocation),
    0.12,
    0.92,
  );
  const successChance = clamp(
    baseSuccessChance * input.passiveProfile.crime.soloSuccessMultiplier,
    0.12,
    0.95,
  );
  const success = input.random() <= successChance;
  const effectiveCommissionRate = input.player.factionId ? input.definition.baseFactionCommissionRate : 0;

  if (success) {
    return {
      effectiveCommissionRate,
      grossAmount,
      heatDelta,
      hpDelta: 0,
      hospitalizationDurationMinutes: null,
      message: buildSuccessMessage(input.definition, input.region, 'player'),
      netAmount: roundCurrency(grossAmount - grossAmount * effectiveCommissionRate),
      disposicaoCost,
      outcome: 'success',
      prisonDurationMinutes: null,
      regionPolicePressureDelta: heatDelta,
      cansacoCost,
      success: true,
    };
  }

  const arrestChance = clamp(
    (0.38 + input.heatScore / 220 + input.region.policePressure / 260) *
      input.passiveProfile.crime.arrestChanceMultiplier,
    0.22,
    0.9,
  );
  const imprisoned = input.random() <= arrestChance;

  return {
    effectiveCommissionRate: 0,
    grossAmount: 0,
    heatDelta: Math.max(1, Math.round(heatDelta * 0.8)),
    hpDelta: -resolveFailureHpLoss(input.random, input.definition.id),
    hospitalizationDurationMinutes: imprisoned ? null : resolveHospitalizationDurationMinutes(input.definition.id),
    message: imprisoned
      ? `O bote azedou e a policia fechou o cerco em ${input.region.name}.`
      : `O bote azedou e voce saiu ferido tentando escapar em ${input.region.name}.`,
    netAmount: 0,
    disposicaoCost,
    outcome: imprisoned ? 'imprisoned' : 'hospitalized',
    prisonDurationMinutes: imprisoned ? resolvePrisonDurationMinutes(input.definition.id) : null,
    regionPolicePressureDelta: Math.max(1, Math.round(heatDelta * 0.8)),
    cansacoCost,
    success: false,
  };
}

function resolveBanditRobbery(input: {
  committed: number;
  definition: ResolvedRobberyDefinition;
  now: Date;
  policyTravelRiskPenalty: number;
  random: () => number;
  region: RobberyRegionRecord;
}): BanditRobberyResolution {
  const baseReward = randomBetween(
    input.random,
    input.definition.baseRewardRange.min,
    input.definition.baseRewardRange.max,
  );
  const rewardMultiplier =
    resolveRobberyRewardMultiplier(input.definition, input.region) *
    (1 + Math.max(0, input.committed - 1) * 0.32);
  const grossAmount = roundCurrency(baseReward * rewardMultiplier);
  const heatDelta = resolveHeatDelta(input.random, input.definition, 'bandits') + Math.max(0, input.committed - 1);
  const successChance = clamp(
    1 -
      resolveBaseFailChance(input.definition.id) -
      resolveRegionRiskPenalty(input.definition, input.region) +
      input.policyTravelRiskPenalty +
      Math.min(0.26, (input.committed - 1) * 0.05),
    0.15,
    0.94,
  );
  const success = input.random() <= successChance;

  if (success) {
    return {
      arrestedNow: 0,
      committed: input.committed,
      effectiveCommissionRate: input.definition.baseFactionCommissionRate,
      grossAmount,
      heatDelta,
      message: buildSuccessMessage(input.definition, input.region, 'bandits'),
      netAmount: roundCurrency(grossAmount - grossAmount * input.definition.baseFactionCommissionRate),
      outcome: 'success',
      returnSchedule: [],
      success: true,
    };
  }

  const arrestedNow = clamp(Math.round(input.committed * randomBetween(input.random, 0.5, 1)), 1, input.committed);
  const returnSchedule = buildBanditReturnSchedule({
    now: input.now,
    quantity: arrestedNow,
    random: input.random,
  });

  return {
    arrestedNow,
    committed: input.committed,
    effectiveCommissionRate: 0,
    grossAmount: 0,
    heatDelta: Math.max(1, Math.round(heatDelta * 0.85)),
    message: `A rua fechou em ${input.region.name} e os bandidos cairam presos no corre do roubo.`,
    netAmount: 0,
    outcome: 'bandits_arrested',
    returnSchedule: [
      {
        quantity: arrestedNow,
        releaseAt: returnSchedule.releaseAt,
        returnFlavor: returnSchedule.flavor,
      },
    ],
    success: false,
  };
}

function requireRobberyDefinition(
  robberyType: RobberyType,
  catalog: ResolvedRobberyCatalog,
): RobberyDefinitionSummary {
  const definition = catalog.robberies.find((entry) => entry.id === robberyType);

  if (definition) {
    return definition;
  }

  if (ROBBERY_DEFINITIONS.some((entry) => entry.id === robberyType)) {
    throw new RobberyError('forbidden', 'Esse tipo de roubo esta desativado nesta rodada.');
  }

  throw new RobberyError('not_found', 'Roubo informado nao existe.');
}

function requireVehicleRobberyRouteDefinition(
  vehicleRoute: VehicleRobberyRoute | undefined,
  catalog: ResolvedRobberyCatalog,
): VehicleRobberyRouteDefinitionSummary {
  if (!vehicleRoute) {
    throw new RobberyError('validation', 'Informe a rota do roubo de veiculo.');
  }

  const definition = catalog.vehicleRoutes.find((entry) => entry.id === vehicleRoute);

  if (definition) {
    return definition;
  }

  if (VEHICLE_ROBBERY_ROUTE_DEFINITIONS.some((entry) => entry.id === vehicleRoute)) {
    throw new RobberyError('forbidden', 'Essa rota de roubo de veiculo esta desativada nesta rodada.');
  }

  throw new RobberyError('validation', 'Rota do roubo de veiculo invalida.');
}

function requireResolvedRobberyDefinition(
  robberyType: RobberyType,
  vehicleRoute: VehicleRobberyRoute | undefined,
  catalog: ResolvedRobberyCatalog,
): ResolvedRobberyDefinition {
  const definition = requireRobberyDefinition(robberyType, catalog);

  if (robberyType !== 'vehicle') {
    return {
      ...definition,
      defaultBanditsCommitted: definition.defaultBanditsCommitted,
      displayLabel: definition.label,
      vehicleRoute: null,
    };
  }

  const routeDefinition = requireVehicleRobberyRouteDefinition(vehicleRoute, catalog);

  return {
    baseCooldownSeconds: definition.baseCooldownSeconds,
    baseFactionCommissionRate: routeDefinition.baseFactionCommissionRate,
    baseHeatDeltaRange: routeDefinition.baseHeatDeltaRange,
    baseRewardRange: routeDefinition.baseRewardRange,
    defaultBanditsCommitted: definition.defaultBanditsCommitted,
    displayLabel: `Roubo de veiculos — ${routeDefinition.label}`,
    executorTypes: definition.executorTypes,
    id: definition.id,
    maxBanditsCommitted: definition.maxBanditsCommitted,
    minimumLevel: definition.minimumLevel,
    riskLabel: routeDefinition.riskLabel,
    vehicleRoute: routeDefinition.id,
  };
}

function isRobberyTypeEnabled(
  catalog: ResolvedGameConfigCatalog,
  robberyType: RobberyType,
): boolean {
  const featureFlag = catalog.featureFlags.find(
    (entry) =>
      entry.key === `robberies.${robberyType}.enabled` &&
      entry.scope === 'robbery_type' &&
      entry.targetKey === robberyType,
  );

  return featureFlag ? featureFlag.status === 'active' : true;
}

function isVehicleRouteEnabled(
  catalog: ResolvedGameConfigCatalog,
  vehicleRoute: VehicleRobberyRoute,
): boolean {
  const featureFlag = catalog.featureFlags.find(
    (entry) =>
      entry.key === `robberies.vehicle_route.${vehicleRoute}.enabled` &&
      entry.scope === 'robbery_type' &&
      entry.targetKey === buildVehicleRouteTargetKey(vehicleRoute),
  );

  return featureFlag ? featureFlag.status === 'active' : true;
}

function resolveConfiguredRobberyDefinition(
  catalog: ResolvedGameConfigCatalog,
  fallback: RobberyDefinitionSummary,
): RobberyDefinitionSummary {
  const entry = catalog.entries.find(
    (resolvedEntry) =>
      resolvedEntry.key === 'robbery.definition' &&
      resolvedEntry.scope === 'robbery_type' &&
      resolvedEntry.targetKey === fallback.id,
  );

  return entry ? mergeRobberyDefinition(fallback, entry.valueJson) : fallback;
}

function resolveConfiguredVehicleRouteDefinition(
  catalog: ResolvedGameConfigCatalog,
  fallback: VehicleRobberyRouteDefinitionSummary,
): VehicleRobberyRouteDefinitionSummary {
  const entry = catalog.entries.find(
    (resolvedEntry) =>
      resolvedEntry.key === 'robbery.vehicle_route_definition' &&
      resolvedEntry.scope === 'robbery_type' &&
      resolvedEntry.targetKey === buildVehicleRouteTargetKey(fallback.id),
  );

  return entry ? mergeVehicleRouteDefinition(fallback, entry.valueJson) : fallback;
}

function mergeRobberyDefinition(
  fallback: RobberyDefinitionSummary,
  valueJson: Record<string, unknown>,
): RobberyDefinitionSummary {
  return {
    ...fallback,
    baseCooldownSeconds: resolvePositiveNumber(valueJson.baseCooldownSeconds, fallback.baseCooldownSeconds),
    baseFactionCommissionRate: resolveRate(valueJson.baseFactionCommissionRate, fallback.baseFactionCommissionRate),
    baseHeatDeltaRange: resolveRange(
      valueJson.baseHeatDeltaRange,
      fallback.baseHeatDeltaRange,
    ),
    baseRewardRange: resolveRange(
      valueJson.baseRewardRange,
      fallback.baseRewardRange,
    ),
    defaultBanditsCommitted: resolvePositiveNumber(
      valueJson.defaultBanditsCommitted,
      fallback.defaultBanditsCommitted,
    ),
    executorTypes: resolveExecutorTypes(valueJson.executorTypes, fallback.executorTypes),
    label: typeof valueJson.label === 'string' ? valueJson.label : fallback.label,
    maxBanditsCommitted: resolvePositiveNumber(valueJson.maxBanditsCommitted, fallback.maxBanditsCommitted),
    minimumLevel: resolvePositiveNumber(valueJson.minimumLevel, fallback.minimumLevel),
    riskLabel: resolveRiskLabel(valueJson.riskLabel, fallback.riskLabel),
  };
}

function mergeVehicleRouteDefinition(
  fallback: VehicleRobberyRouteDefinitionSummary,
  valueJson: Record<string, unknown>,
): VehicleRobberyRouteDefinitionSummary {
  return {
    ...fallback,
    baseFactionCommissionRate: resolveRate(valueJson.baseFactionCommissionRate, fallback.baseFactionCommissionRate),
    baseHeatDeltaRange: resolveRange(
      valueJson.baseHeatDeltaRange,
      fallback.baseHeatDeltaRange,
    ),
    baseRewardRange: resolveRange(
      valueJson.baseRewardRange,
      fallback.baseRewardRange,
    ),
    description: typeof valueJson.description === 'string' ? valueJson.description : fallback.description,
    label: typeof valueJson.label === 'string' ? valueJson.label : fallback.label,
    riskLabel: resolveRiskLabel(valueJson.riskLabel, fallback.riskLabel),
  };
}

function buildVehicleRouteTargetKey(vehicleRoute: VehicleRobberyRoute): string {
  return `vehicle_route:${vehicleRoute}`;
}

function resolveRange(
  value: unknown,
  fallback: {
    max: number;
    min: number;
  },
): {
  max: number;
  min: number;
} {
  if (!value || typeof value !== 'object') {
    return fallback;
  }

  const min = resolvePositiveNumber((value as { min?: unknown }).min, fallback.min);
  const max = resolvePositiveNumber((value as { max?: unknown }).max, fallback.max);

  return {
    max: Math.max(min, max),
    min,
  };
}

function resolvePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function resolveRate(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function resolveExecutorTypes(
  value: unknown,
  fallback: RobberyExecutorType[],
): RobberyExecutorType[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const filtered = value.filter(
    (entry): entry is RobberyExecutorType => entry === 'player' || entry === 'bandits',
  );

  return filtered.length > 0 ? filtered : fallback;
}

function resolveRiskLabel(
  value: unknown,
  fallback: RobberyDefinitionSummary['riskLabel'],
): RobberyDefinitionSummary['riskLabel'] {
  return value === 'alto' || value === 'baixo_medio' || value === 'medio' || value === 'medio_alto'
    ? value
    : fallback;
}

function buildRobberyCooldownId(
  executorType: RobberyExecutorType,
  actorId: string,
  robberyType: RobberyType,
  vehicleRoute: VehicleRobberyRoute | null = null,
): string {
  return `${ROBBERY_COOLDOWN_PREFIX}:${executorType}:${actorId}:${robberyType}:${vehicleRoute ?? 'base'}`;
}

function resolveBaseFailChance(robberyType: RobberyType): number {
  switch (robberyType) {
    case 'pedestrian':
      return 0.24;
    case 'cellphones':
      return 0.32;
    case 'vehicle':
      return 0.41;
    case 'truck':
      return 0.48;
    default:
      return 0.48;
  }
}

function resolveHeatDelta(
  random: () => number,
  definition: ResolvedRobberyDefinition,
  executorType: RobberyExecutorType,
): number {
  const base = Math.round(randomBetween(random, definition.baseHeatDeltaRange.min, definition.baseHeatDeltaRange.max));
  return executorType === 'bandits' ? Math.max(base, definition.baseHeatDeltaRange.min + 1) : base;
}

function resolveRobberyRewardMultiplier(
  definition: ResolvedRobberyDefinition,
  region: RobberyRegionRecord,
): number {
  if (definition.id === 'vehicle' && definition.vehicleRoute) {
    return resolveVehicleRouteRewardMultiplier(definition.vehicleRoute, region);
  }

  const wealth = normalizeIndex(region.wealthIndex);
  const density = normalizeIndex(region.densityIndex);
  const operation = clamp(region.operationCostMultiplier, 0.85, 1.35);

  switch (definition.id) {
    case 'pedestrian':
      return clamp(1 + density * 0.22 + wealth * 0.08 + (operation - 1) * 0.1, 0.72, 1.4);
    case 'cellphones':
      return clamp(1 + density * 0.16 + wealth * 0.18 + (operation - 1) * 0.1, 0.78, 1.45);
    case 'vehicle':
      return clamp(1 + wealth * 0.28 + (operation - 1) * 0.12, 0.82, 1.6);
    case 'truck':
      return clamp(1 + wealth * 0.24 + density * 0.1 + (operation - 1) * 0.14, 0.9, 1.7);
    default:
      return 1;
  }
}

function resolveRegionRiskPenalty(
  definition: ResolvedRobberyDefinition,
  region: RobberyRegionRecord,
): number {
  if (definition.id === 'vehicle' && definition.vehicleRoute) {
    return resolveVehicleRouteRiskPenalty(definition.vehicleRoute, region);
  }

  const pressurePenalty = region.policePressure / 520;
  const wealth = normalizeIndex(region.wealthIndex);
  const density = normalizeIndex(region.densityIndex);

  switch (definition.id) {
    case 'pedestrian':
      return clamp(pressurePenalty + density * 0.04, 0.04, 0.28);
    case 'cellphones':
      return clamp(pressurePenalty + density * 0.03 + wealth * 0.03, 0.06, 0.3);
    case 'vehicle':
      return clamp(pressurePenalty + wealth * 0.08, 0.1, 0.35);
    case 'truck':
      return clamp(pressurePenalty + wealth * 0.06 + density * 0.04, 0.12, 0.38);
    default:
      return 0.2;
  }
}

function resolvePlayerSkillBonus(player: RobberyPlayerRecord): number {
  const weightedScore = player.forca * 0.8 + player.resistencia * 0.35 + player.carisma * 0.15;
  return clamp((weightedScore - 22) / 100, -0.06, 0.22);
}

function resolvePlayerVocationBonus(vocation: VocationType): number {
  switch (vocation) {
    case VocationType.Cria:
      return 0.08;
    case VocationType.Soldado:
      return 0.04;
    case VocationType.Empreendedor:
      return 0.02;
    case VocationType.Gerente:
      return 0.01;
    case VocationType.Politico:
      return 0.02;
    default:
      return 0;
  }
}

function definitionPlayerCansacoCost(robberyType: RobberyType): number {
  switch (robberyType) {
    case 'pedestrian':
      return 5;
    case 'cellphones':
      return 8;
    case 'vehicle':
      return 12;
    case 'truck':
      return 16;
    default:
      return 16;
  }
}

function definitionPlayerDisposicaoCost(robberyType: RobberyType): number {
  switch (robberyType) {
    case 'pedestrian':
      return 4;
    case 'cellphones':
      return 6;
    case 'vehicle':
      return 10;
    case 'truck':
      return 14;
    default:
      return 14;
  }
}

function resolveFailureHpLoss(random: () => number, robberyType: RobberyType): number {
  switch (robberyType) {
    case 'pedestrian':
      return Math.round(randomBetween(random, 8, 16));
    case 'cellphones':
      return Math.round(randomBetween(random, 10, 20));
    case 'vehicle':
      return Math.round(randomBetween(random, 14, 26));
    case 'truck':
      return Math.round(randomBetween(random, 18, 32));
    default:
      return 18;
  }
}

function resolveHospitalizationDurationMinutes(robberyType: RobberyType): number {
  switch (robberyType) {
    case 'pedestrian':
      return 12;
    case 'cellphones':
      return 16;
    case 'vehicle':
      return 22;
    case 'truck':
      return 30;
    default:
      return 30;
  }
}

function resolvePrisonDurationMinutes(robberyType: RobberyType): number {
  switch (robberyType) {
    case 'pedestrian':
      return 120;
    case 'cellphones':
      return 210;
    case 'vehicle':
      return 360;
    case 'truck':
      return 540;
    default:
      return 540;
  }
}

function normalizeCommittedBandits(
  requested: number | undefined,
  definition: ResolvedRobberyDefinition,
  available: number,
): number {
  const normalizedRequested =
    requested === undefined ? definition.defaultBanditsCommitted : Math.max(1, Math.round(requested));
  return Math.min(definition.maxBanditsCommitted, Math.max(1, Math.min(available, normalizedRequested)));
}

function buildSuccessMessage(
  definition: ResolvedRobberyDefinition,
  region: RobberyRegionRecord,
  executorType: RobberyExecutorType,
): string {
  if (executorType === 'bandits') {
    return `O corre de ${definition.displayLabel.toLowerCase()} rendeu em ${region.name} e a favela voltou com caixa quente.`;
  }

  return `O bote de ${definition.displayLabel.toLowerCase()} encaixou em ${region.name} e voce saiu no lucro.`;
}

function resolveVehicleRouteRewardMultiplier(
  vehicleRoute: VehicleRobberyRoute,
  region: RobberyRegionRecord,
): number {
  const wealth = normalizeIndex(region.wealthIndex);
  const density = normalizeIndex(region.densityIndex);
  const operation = clamp(region.operationCostMultiplier, 0.85, 1.35);

  switch (vehicleRoute) {
    case 'ransom':
      return clamp(1 + wealth * 0.4 + density * 0.08 + (operation - 1) * 0.16, 0.95, 1.95);
    case 'chop_shop':
      return clamp(1 + wealth * 0.06 + density * 0.04 + (operation - 1) * 0.08, 0.88, 1.22);
    case 'paraguay':
      return clamp(1 + density * 0.05 + (operation - 1) * 0.1, 0.95, 1.32);
    default:
      return 1;
  }
}

function resolveVehicleRouteRiskPenalty(
  vehicleRoute: VehicleRobberyRoute,
  region: RobberyRegionRecord,
): number {
  const pressurePenalty = region.policePressure / 520;
  const wealth = normalizeIndex(region.wealthIndex);
  const density = normalizeIndex(region.densityIndex);

  switch (vehicleRoute) {
    case 'ransom':
      return clamp(pressurePenalty + wealth * 0.12 + density * 0.02, 0.12, 0.4);
    case 'chop_shop':
      return clamp(pressurePenalty + density * 0.03, 0.08, 0.28);
    case 'paraguay':
      return clamp(pressurePenalty + 0.1, 0.16, 0.34);
    default:
      return 0.2;
  }
}

function buildPlayerPrisonStatus(
  releaseAt: Date,
  heatScore: number,
  reason: string,
  sentencedAt: Date,
): PlayerPrisonStatus {
  return {
    endsAt: releaseAt.toISOString(),
    heatScore,
    heatTier: resolvePoliceHeatTier(heatScore),
    isImprisoned: true,
    reason,
    remainingSeconds: Math.max(0, Math.ceil((releaseAt.getTime() - sentencedAt.getTime()) / 1000)),
    sentencedAt: sentencedAt.toISOString(),
  };
}

function normalizeFactionRobberyPolicy(
  policy: unknown,
  defaultPolicy: FactionRobberyPolicy = resolveDefaultFactionRobberyPolicy(
    buildEmptyResolvedCatalog(),
  ),
): FactionRobberyPolicy {
  const fallback = {
    ...defaultPolicy,
    regions: { ...defaultPolicy.regions },
  };

  if (!policy || typeof policy !== 'object') {
    return fallback;
  }

  const rawPolicy = policy as {
    global?: unknown;
    regions?: Record<string, unknown>;
  };
  const global =
    rawPolicy.global === 'allowed' || rawPolicy.global === 'forbidden'
      ? rawPolicy.global
      : defaultPolicy.global;
  const regionsPolicy: FactionRobberyPolicy['regions'] = {};

  if (rawPolicy.regions && typeof rawPolicy.regions === 'object') {
    for (const [regionId, mode] of Object.entries(rawPolicy.regions)) {
      if (!isRegionId(regionId) || (mode !== 'allowed' && mode !== 'forbidden')) {
        continue;
      }

      regionsPolicy[regionId] = mode;
    }
  }

  return {
    global,
    regions: regionsPolicy,
  };
}

function normalizeIndex(value: number): number {
  return clamp((value - 50) / 50, -0.8, 0.8);
}

function isRegionId(value: string): value is RegionId {
  return (
    value === 'zona_sul' ||
    value === 'zona_norte' ||
    value === 'centro' ||
    value === 'zona_oeste' ||
    value === 'zona_sudoeste' ||
    value === 'baixada'
  );
}


function roundPercentage(value: number): number {
  return Math.round(value * 100) / 100;
}

function randomBetween(random: () => number, min: number, max: number): number {
  return min + (max - min) * random();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
