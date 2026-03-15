import {
  type FeatureFlagSummary,
  type FactionRobberyPolicy,
  type HallOfFamePlayerEntry,
  type HallOfFameResponse,
  type ResolvedGameConfigCatalog,
  type HallOfFameRoundEntry,
  type RoundCenterResponse,
  type RoundLeaderboardEntry,
  type RoundStatus,
  type RoundSummary,
  VOCATION_BASE_ATTRIBUTES,
} from '@cs-rio/shared';
import { asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  assassinationContractNotifications,
  assassinationContracts,
  bichoBets,
  bichoDraws,
  bocaDrugStocks,
  bocaOperations,
  chatMessages,
  contacts,
  factionBankLedger,
  factionLeadershipChallenges,
  factionLeadershipElections,
  factionLeadershipElectionSupports,
  factionLeadershipElectionVotes,
  factionMembers,
  factions,
  factionUpgrades,
  factionWars,
  favelaBailes,
  favelaBanditReturns,
  favelas,
  favelaServices,
  frontStoreBatches,
  frontStoreOperations,
  gameEvents,
  marketAuctionBids,
  marketAuctionNotifications,
  marketAuctions,
  marketOrders,
  playerBankDailyDeposits,
  playerBankLedger,
  playerHospitalStatPurchases,
  playerInventory,
  players,
  prisonRecords,
  properties,
  propinaPayments,
  drugFactories,
  drugFactoryComponentStocks,
  puteiroGps,
  puteiroOperations,
  raveDrugLineups,
  raveOperations,
  regions,
  round,
  roundConfigOverrides,
  roundRankings,
  roundFeatureFlagOverrides,
  slotMachineOperations,
  soldiers,
  trainingSessions,
  transactions,
  tribunalCases,
  universityEnrollments,
  x9Events,
} from '../db/schema.js';
import { GameConfigService } from './game-config.js';
import {
  resolveDefaultFactionRobberyPolicy,
  resolveFactionInternalSatisfactionDefault,
  resolveRoundLifecycleConfig,
  type RoundLifecycleConfig,
} from './gameplay-config.js';
import {
  buildNpcInflationSummary,
  DatabaseNpcInflationReader,
  type NpcInflationReaderContract,
} from './npc-inflation.js';
import {
  resolveFavelaBanditTarget,
} from './favela-force.js';
import { applyFixedFactionStarterTerritories } from './fixed-faction-territories.js';

const ROUND_LEGACY_BONUS_PROFILES = [
  {
    bankMoneyBonus: 7_500,
    moneyBonus: 15_000,
    tier: 'champion',
    upToRank: 1,
  },
  {
    bankMoneyBonus: 5_000,
    moneyBonus: 10_000,
    tier: 'podium',
    upToRank: 3,
  },
  {
    bankMoneyBonus: 2_500,
    moneyBonus: 5_000,
    tier: 'elite',
    upToRank: 10,
  },
] as const;
interface RoundRecord {
  endsAt: Date;
  id: string;
  number: number;
  startedAt: Date;
  status: RoundStatus;
}

interface RoundStandingRecord {
  conceito: number;
  factionAbbreviation: string | null;
  level: number;
  nickname: string;
  playerId: string;
}

interface HallOfFameRankingRecord {
  finalConceito: number;
  finalRank: number;
  nickname: string;
  playerId: string;
  roundEndsAt: Date;
  roundId: string;
  roundNumber: number;
  roundStartedAt: Date;
}

interface RoundRankingWriteInput {
  finalConceito: number;
  finalRank: number;
  playerId: string;
}

interface RoundLegacyBonusWriteInput {
  bankMoneyBonus: number;
  moneyBonus: number;
  playerId: string;
  tier: (typeof ROUND_LEGACY_BONUS_PROFILES)[number]['tier'];
}

interface RoundConfigSnapshotEntryWriteInput {
  key: string;
  scope: ResolvedGameConfigCatalog['entries'][number]['scope'];
  targetKey: string;
  valueJson: Record<string, unknown>;
}

interface RoundFeatureFlagSnapshotWriteInput {
  key: string;
  payloadJson: Record<string, unknown>;
  scope: FeatureFlagSummary['scope'];
  status: FeatureFlagSummary['status'];
  targetKey: string;
}

interface RoundConfigSnapshotWriteInput {
  activeSet: ResolvedGameConfigCatalog['activeSet'];
  entries: RoundConfigSnapshotEntryWriteInput[];
  featureFlags: RoundFeatureFlagSnapshotWriteInput[];
  resolvedAt: string;
}

interface CompleteRoundInput {
  defaultFactionInternalSatisfaction: number;
  defaultRobberyPolicy: FactionRobberyPolicy;
  legacyBonuses: RoundLegacyBonusWriteInput[];
  now: Date;
  rankings: RoundRankingWriteInput[];
  rewardCredits: number;
  rewardedPlayerIds: string[];
  roundId: string;
}

export interface RoundRepository {
  completeRound(input: CompleteRoundInput): Promise<void>;
  createRound(input: {
    configSnapshot?: RoundConfigSnapshotWriteInput | null;
    endsAt: Date;
    number: number;
    startedAt: Date;
  }): Promise<RoundRecord>;
  getActiveRound(): Promise<RoundRecord | null>;
  getHallOfFame(): Promise<HallOfFameRankingRecord[]>;
  getLatestRound(): Promise<RoundRecord | null>;
  listStandings(): Promise<RoundStandingRecord[]>;
}

class DatabaseRoundRepository implements RoundRepository {
  async completeRound(input: CompleteRoundInput): Promise<void> {
    await db.transaction(async (tx) => {
      await tx
        .update(round)
        .set({
          status: 'finished',
        })
        .where(eq(round.id, input.roundId));

      if (input.rankings.length > 0) {
        await tx.insert(roundRankings).values(
          input.rankings.map((ranking) => ({
            finalConceito: ranking.finalConceito,
            finalRank: ranking.finalRank,
            playerId: ranking.playerId,
            roundId: input.roundId,
          })),
        );
      }

      if (input.rewardedPlayerIds.length > 0) {
        await tx
          .update(players)
          .set({
            credits: sql`${players.credits} + ${input.rewardCredits}`,
          })
          .where(inArray(players.id, input.rewardedPlayerIds));
      }

      const playerRows = await tx
        .select({
          id: players.id,
          regionId: players.regionId,
          vocation: players.vocation,
        })
        .from(players)
        .where(isNotNull(players.characterCreatedAt));

      const favelaRows = await tx
        .select({
          baseBanditTarget: favelas.baseBanditTarget,
          defaultSatisfaction: favelas.defaultSatisfaction,
          difficulty: favelas.difficulty,
          id: favelas.id,
          maxSoldiers: favelas.maxSoldiers,
          population: favelas.population,
        })
        .from(favelas);

      const regionRows = await tx
        .select({
          defaultPolicePressure: regions.defaultPolicePressure,
          id: regions.id,
          spawnPositionX: regions.spawnPositionX,
          spawnPositionY: regions.spawnPositionY,
        })
        .from(regions);

      const regionDefinitionById = new Map(
        regionRows.map((regionRow) => [
          regionRow.id,
          {
            defaultPolicePressure: regionRow.defaultPolicePressure,
            spawnPositionX: regionRow.spawnPositionX,
            spawnPositionY: regionRow.spawnPositionY,
          },
        ]),
      );
      const fallbackSpawnRegion =
        regionRows.find((regionRow) => regionRow.id === 'centro') ??
        regionRows[0] ?? {
          defaultPolicePressure: 50,
          id: 'centro',
          spawnPositionX: 128,
          spawnPositionY: 116,
        };

      const legacyBonuses = new Map(
        input.legacyBonuses.map((bonus) => [
          bonus.playerId,
          {
            bankMoneyBonus: bonus.bankMoneyBonus,
            moneyBonus: bonus.moneyBonus,
          },
        ]),
      );

      await tx.delete(assassinationContractNotifications);
      await tx.delete(assassinationContracts);
      await tx.delete(chatMessages);
      await tx.delete(contacts);
      await tx.delete(gameEvents);
      await tx.delete(tribunalCases);
      await tx.delete(x9Events);
      await tx.delete(favelaBailes);
      await tx.delete(propinaPayments);
      await tx.delete(factionWars);
      await tx.delete(factionLeadershipElectionVotes);
      await tx.delete(factionLeadershipElectionSupports);
      await tx.delete(factionLeadershipChallenges);
      await tx.delete(factionLeadershipElections);
      await tx.delete(factionUpgrades);
      await tx.delete(factionMembers);
      await tx.delete(factionBankLedger);
      await tx.delete(marketAuctionNotifications);
      await tx.delete(marketAuctionBids);
      await tx.delete(marketAuctions);
      await tx.delete(marketOrders);
      await tx.delete(soldiers);
      await tx.delete(drugFactoryComponentStocks);
      await tx.delete(bichoBets);
      await tx.delete(bichoDraws);
      await tx.delete(slotMachineOperations);
      await tx.delete(frontStoreBatches);
      await tx.delete(frontStoreOperations);
      await tx.delete(puteiroGps);
      await tx.delete(puteiroOperations);
      await tx.delete(raveDrugLineups);
      await tx.delete(raveOperations);
      await tx.delete(bocaDrugStocks);
      await tx.delete(bocaOperations);
      await tx.delete(drugFactories);
      await tx.delete(universityEnrollments);
      await tx.delete(trainingSessions);
      await tx.delete(properties);
      await tx.delete(playerInventory);
      await tx.delete(favelaServices);
      await tx.delete(favelaBanditReturns);
      await tx.delete(playerBankLedger);
      await tx.delete(playerBankDailyDeposits);
      await tx.delete(playerHospitalStatPurchases);
      await tx.delete(prisonRecords);
      await tx.delete(transactions);

      await tx
        .update(players)
        .set({
          bankInterestSyncedAt: input.now,
          bankMoney: '0',
          dstRecoversAt: null,
          factionId: null,
          hasDst: false,
          healthPlanCycleKey: null,
        });

      await tx
        .delete(factions)
        .where(eq(factions.isFixed, false));

      await tx
        .update(factions)
        .set({
          bankDrugs: 0,
          bankMoney: '0',
          internalSatisfaction: input.defaultFactionInternalSatisfaction,
          leaderId: null,
          points: 0,
          robberyPolicyJson: input.defaultRobberyPolicy,
        })
        .where(eq(factions.isFixed, true));

      for (const playerRow of playerRows) {
        const attributes = VOCATION_BASE_ATTRIBUTES[playerRow.vocation];
        const spawnPoint = regionDefinitionById.get(playerRow.regionId) ?? fallbackSpawnRegion;
        const legacyBonus = legacyBonuses.get(playerRow.id);

        await tx
          .update(players)
          .set({
            addiction: 0,
            bankInterestSyncedAt: input.now,
            bankMoney: String(legacyBonus?.bankMoneyBonus ?? 0),
            carisma: attributes.carisma,
            conceito: 0,
            factionId: null,
            forca: attributes.forca,
            hasDst: false,
            healthPlanCycleKey: null,
            hp: 100,
            inteligencia: attributes.inteligencia,
            level: 1,
            morale: 100,
            nerve: 100,
            positionX: spawnPoint.spawnPositionX,
            positionY: spawnPoint.spawnPositionY,
            resistencia: attributes.resistencia,
            stamina: 100,
            money: String(legacyBonus?.moneyBonus ?? 0),
          })
          .where(eq(players.id, playerRow.id));
      }

      await tx
        .update(regions)
        .set({
          policePressure: regions.defaultPolicePressure,
        });

      for (const favelaRow of favelaRows) {
        await tx
          .update(favelas)
          .set({
            banditsActive: resolveFavelaBanditTarget({
              baseBanditTarget: favelaRow.baseBanditTarget,
              difficulty: favelaRow.difficulty,
              internalSatisfaction: null,
              population: favelaRow.population,
              state: 'neutral',
            }),
            banditsArrested: 0,
            banditsDeadRecent: 0,
            banditsSyncedAt: input.now,
            contestingFactionId: null,
            controllingFactionId: null,
            lastX9RollAt: input.now,
            maxSoldiers: favelaRow.maxSoldiers,
            propinaDiscountRate: '0',
            propinaDueDate: null,
            propinaLastPaidAt: null,
            propinaNegotiatedAt: null,
            propinaNegotiatedByPlayerId: null,
            propinaValue: '0',
            satisfaction: favelaRow.defaultSatisfaction,
            satisfactionSyncedAt: input.now,
            stabilizationEndsAt: null,
            state: 'neutral',
            stateControlledUntil: null,
            warDeclaredAt: null,
          })
          .where(eq(favelas.id, favelaRow.id));
      }

      await applyFixedFactionStarterTerritories(tx as never, input.now);
    });
  }

  async createRound(input: {
    configSnapshot?: RoundConfigSnapshotWriteInput | null;
    endsAt: Date;
    number: number;
    startedAt: Date;
  }): Promise<RoundRecord> {
    const [createdRound] = await db.transaction(async (tx) => {
      const [insertedRound] = await tx
        .insert(round)
        .values({
          endsAt: input.endsAt,
          number: input.number,
          startedAt: input.startedAt,
          status: 'active',
        })
        .returning({
          endsAt: round.endsAt,
          id: round.id,
          number: round.number,
          startedAt: round.startedAt,
          status: round.status,
        });

      if (!insertedRound) {
        throw new Error('Falha ao criar a rodada.');
      }

      if (input.configSnapshot) {
        await tx.insert(roundConfigOverrides).values([
          {
            effectiveFrom: input.startedAt,
            key: '__round_config_snapshot__',
            notes: 'Snapshot automático do catálogo ativo ao abrir a rodada.',
            roundId: insertedRound.id,
            scope: 'global',
            status: 'active',
            targetKey: '*',
            valueJson: {
              isDefault: input.configSnapshot.activeSet?.isDefault ?? false,
              setCode: input.configSnapshot.activeSet?.code ?? null,
              setDescription: input.configSnapshot.activeSet?.description ?? null,
              setId: input.configSnapshot.activeSet?.id ?? null,
              setName: input.configSnapshot.activeSet?.name ?? null,
              setNotes: input.configSnapshot.activeSet?.notes ?? null,
              setStatus: input.configSnapshot.activeSet?.status ?? null,
              snapshottedAt: input.configSnapshot.resolvedAt,
            },
          },
          ...input.configSnapshot.entries.map((entry) => ({
            effectiveFrom: input.startedAt,
            key: entry.key,
            notes: 'Snapshot automático da configuração da rodada.',
            roundId: insertedRound.id,
            scope: entry.scope,
            status: 'active' as const,
            targetKey: entry.targetKey,
            valueJson: entry.valueJson,
          })),
        ]);

        if (input.configSnapshot.featureFlags.length > 0) {
          await tx.insert(roundFeatureFlagOverrides).values(
            input.configSnapshot.featureFlags.map((flag) => ({
              effectiveFrom: input.startedAt,
              key: flag.key,
              notes: 'Snapshot automático das feature flags da rodada.',
              payloadJson: flag.payloadJson,
              roundId: insertedRound.id,
              scope: flag.scope,
              status: flag.status,
              targetKey: flag.targetKey,
            })),
          );
        }
      }

      return [insertedRound];
    });

    if (!createdRound) {
      throw new Error('Falha ao criar a rodada.');
    }

    return createdRound;
  }

  async getActiveRound(): Promise<RoundRecord | null> {
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

    return activeRound ?? null;
  }

  async getHallOfFame(): Promise<HallOfFameRankingRecord[]> {
    const rankings = await db
      .select({
        finalConceito: roundRankings.finalConceito,
        finalRank: roundRankings.finalRank,
        nickname: players.nickname,
        playerId: roundRankings.playerId,
        roundEndsAt: round.endsAt,
        roundId: round.id,
        roundNumber: round.number,
        roundStartedAt: round.startedAt,
      })
      .from(roundRankings)
      .innerJoin(players, eq(roundRankings.playerId, players.id))
      .innerJoin(round, eq(roundRankings.roundId, round.id))
      .orderBy(desc(round.number), asc(roundRankings.finalRank));

    return rankings;
  }

  async getLatestRound(): Promise<RoundRecord | null> {
    const [latestRound] = await db
      .select({
        endsAt: round.endsAt,
        id: round.id,
        number: round.number,
        startedAt: round.startedAt,
        status: round.status,
      })
      .from(round)
      .orderBy(desc(round.number))
      .limit(1);

    return latestRound ?? null;
  }

  async listStandings(): Promise<RoundStandingRecord[]> {
    const standings = await db
      .select({
        conceito: players.conceito,
        factionAbbreviation: factions.abbreviation,
        level: players.level,
        nickname: players.nickname,
        playerId: players.id,
      })
      .from(players)
      .leftJoin(factions, eq(players.factionId, factions.id))
      .where(isNotNull(players.characterCreatedAt))
      .orderBy(desc(players.conceito), desc(players.level), asc(players.createdAt), asc(players.nickname));

    return standings.map((entry) => ({
      conceito: entry.conceito,
      factionAbbreviation: entry.factionAbbreviation ?? null,
      level: entry.level,
      nickname: entry.nickname,
      playerId: entry.playerId,
    }));
  }
}

export interface RoundServiceContract {
  close?(): Promise<void>;
  getCenter(): Promise<RoundCenterResponse>;
  getHallOfFame(): Promise<HallOfFameResponse>;
  syncLifecycle(now?: Date): Promise<void>;
}

export interface RoundServiceOptions {
  gameConfigService?: Pick<GameConfigService, 'getResolvedCatalog'>;
  inflationReader?: NpcInflationReaderContract;
  now?: () => Date;
  repository?: RoundRepository;
}

export class RoundService implements RoundServiceContract {
  private readonly gameConfigService: Pick<GameConfigService, 'getResolvedCatalog'>;
  private readonly inflationReader: NpcInflationReaderContract;
  private readonly now: () => Date;
  private readonly repository: RoundRepository;

  constructor(options: RoundServiceOptions = {}) {
    this.gameConfigService = options.gameConfigService ?? new GameConfigService();
    this.inflationReader = options.inflationReader ?? new DatabaseNpcInflationReader(options.now ?? (() => new Date()));
    this.now = options.now ?? (() => new Date());
    this.repository = options.repository ?? new DatabaseRoundRepository();
  }

  async getCenter(): Promise<RoundCenterResponse> {
    const now = this.now();
    await this.syncLifecycle(now);

    const activeRound = await this.repository.getActiveRound();

    if (!activeRound) {
      throw new Error('Nao foi possivel resolver a rodada ativa.');
    }

    const [standings, inflationProfile] = await Promise.all([
      this.repository.listStandings(),
      this.inflationReader.getProfile(),
    ]);
    const lifecycleConfig = resolveRoundLifecycleConfig(
      await this.gameConfigService.getResolvedCatalog({ now, roundId: activeRound.id }),
    );

    return {
      leaderboard: standings.slice(0, 10).map((entry, index) => buildRoundLeaderboardEntry(entry, index + 1)),
      npcInflation: buildNpcInflationSummary(inflationProfile),
      round: buildRoundSummary(activeRound, now, lifecycleConfig),
      topTenCreditReward: lifecycleConfig.topTenCreditReward,
    };
  }

  async getHallOfFame(): Promise<HallOfFameResponse> {
    const rankings = await this.repository.getHallOfFame();
    const rounds = new Map<string, HallOfFameRoundEntry>();

    for (const ranking of rankings) {
      const currentRound = rounds.get(ranking.roundId);
      const playerEntry = buildHallOfFamePlayerEntry(ranking);

      if (!currentRound) {
        rounds.set(ranking.roundId, {
          endedAt: ranking.roundEndsAt.toISOString(),
          roundId: ranking.roundId,
          roundNumber: ranking.roundNumber,
          startedAt: ranking.roundStartedAt.toISOString(),
          topThree: ranking.finalRank <= 3 ? [playerEntry] : [],
          winnerConceito: ranking.finalConceito,
          winnerNickname: ranking.nickname,
          winnerPlayerId: ranking.playerId,
        });
        continue;
      }

      if (ranking.finalRank <= 3) {
        currentRound.topThree.push(playerEntry);
      }
    }

    return {
      rounds: [...rounds.values()],
      totalFinishedRounds: rounds.size,
    };
  }

  async syncLifecycle(now: Date = this.now()): Promise<void> {
    const activeRound = await this.repository.getActiveRound();

    if (!activeRound) {
      const latestRound = await this.repository.getLatestRound();
      const configSnapshot = await this.gameConfigService.getResolvedCatalog({ now, roundId: null });
      const lifecycleConfig = resolveRoundLifecycleConfig(configSnapshot);

      await this.repository.createRound({
        configSnapshot: buildRoundConfigSnapshot(configSnapshot),
        endsAt: new Date(now.getTime() + lifecycleConfig.realDurationMs),
        number: (latestRound?.number ?? 0) + 1,
        startedAt: now,
      });
      return;
    }

    if (activeRound.endsAt.getTime() > now.getTime()) {
      return;
    }

    const activeRoundConfig = resolveRoundLifecycleConfig(
      await this.gameConfigService.getResolvedCatalog({ now, roundId: activeRound.id }),
    );
    const standings = await this.repository.listStandings();
    const rankings = standings.map((entry, index) => ({
      finalConceito: entry.conceito,
      finalRank: index + 1,
      playerId: entry.playerId,
    }));
    const legacyBonuses: RoundLegacyBonusWriteInput[] = [];

    for (const ranking of rankings) {
        const profile = resolveRoundLegacyBonus(ranking.finalRank);

        if (!profile) {
          continue;
        }

        legacyBonuses.push({
          bankMoneyBonus: profile.bankMoneyBonus,
          moneyBonus: profile.moneyBonus,
          playerId: ranking.playerId,
          tier: profile.tier,
        });
    }
    const rewardedPlayerIds = standings
      .slice(0, Math.min(10, standings.length))
      .map((entry) => entry.playerId);

    const nextConfigSnapshot = await this.gameConfigService.getResolvedCatalog({ now, roundId: null });
    const nextRoundLifecycleConfig = resolveRoundLifecycleConfig(nextConfigSnapshot);
    const nextRoundFactionInternalSatisfaction =
      resolveFactionInternalSatisfactionDefault(nextConfigSnapshot);
    const nextRoundRobberyPolicy = resolveDefaultFactionRobberyPolicy(nextConfigSnapshot);

    await this.repository.completeRound({
      defaultFactionInternalSatisfaction: nextRoundFactionInternalSatisfaction,
      defaultRobberyPolicy: nextRoundRobberyPolicy,
      legacyBonuses,
      now,
      rankings,
      rewardCredits: activeRoundConfig.topTenCreditReward,
      rewardedPlayerIds,
      roundId: activeRound.id,
    });

    await this.repository.createRound({
      configSnapshot: buildRoundConfigSnapshot(nextConfigSnapshot),
      endsAt: new Date(now.getTime() + nextRoundLifecycleConfig.realDurationMs),
      number: activeRound.number + 1,
      startedAt: now,
    });
  }

  async close(): Promise<void> {}
}

function buildRoundLeaderboardEntry(entry: RoundStandingRecord, rank: number): RoundLeaderboardEntry {
  return {
    conceito: entry.conceito,
    factionAbbreviation: entry.factionAbbreviation,
    level: entry.level,
    nickname: entry.nickname,
    playerId: entry.playerId,
    rank,
  };
}

function buildRoundSummary(
  roundRecord: RoundRecord,
  now: Date,
  lifecycleConfig: RoundLifecycleConfig,
): RoundSummary {
  const elapsedMs = Math.max(0, now.getTime() - roundRecord.startedAt.getTime());
  const remainingSeconds = Math.max(0, Math.floor((roundRecord.endsAt.getTime() - now.getTime()) / 1000));

  return {
    currentGameDay: clamp(
      Math.floor(elapsedMs / lifecycleConfig.gameDayRealMs) + 1,
      1,
      lifecycleConfig.totalGameDays,
    ),
    endsAt: roundRecord.endsAt.toISOString(),
    id: roundRecord.id,
    number: roundRecord.number,
    remainingSeconds,
    startedAt: roundRecord.startedAt.toISOString(),
    status: roundRecord.status,
    totalGameDays: lifecycleConfig.totalGameDays,
  };
}

function buildHallOfFamePlayerEntry(entry: HallOfFameRankingRecord): HallOfFamePlayerEntry {
  return {
    conceito: entry.finalConceito,
    nickname: entry.nickname,
    playerId: entry.playerId,
    rank: entry.finalRank,
  };
}

function resolveRoundLegacyBonus(rank: number) {
  return ROUND_LEGACY_BONUS_PROFILES.find((profile) => rank <= profile.upToRank) ?? null;
}

function buildRoundConfigSnapshot(catalog: ResolvedGameConfigCatalog): RoundConfigSnapshotWriteInput {
  return {
    activeSet: catalog.activeSet,
    entries: catalog.entries.map((entry) => ({
      key: entry.key,
      scope: entry.scope,
      targetKey: entry.targetKey,
      valueJson: entry.valueJson,
    })),
    featureFlags: catalog.featureFlags.map((flag) => ({
      key: flag.key,
      payloadJson: flag.payloadJson,
      scope: flag.scope,
      status: flag.status,
      targetKey: flag.targetKey,
    })),
    resolvedAt: catalog.resolvedAt,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}
