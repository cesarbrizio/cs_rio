import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  type FactionRank,
  RegionId,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createPvpRoutes } from '../src/api/routes/pvp.js';
import {
  AuthService,
  type AuthPlayerRecord,
  type AuthRepository,
  type KeyValueStore,
} from '../src/services/auth.js';
import { PvpService, type PvpRepository } from '../src/services/pvp.js';
import type { HospitalizationSystemContract } from '../src/services/action-readiness.js';
import { type CombatPlayerContext, CombatSystem } from '../src/systems/CombatSystem.js';
import { CooldownSystem } from '../src/systems/CooldownSystem.js';
import { OverdoseSystem } from '../src/systems/OverdoseSystem.js';
import { PoliceHeatSystem } from '../src/systems/PoliceHeatSystem.js';

interface TestState {
  assassinationContracts: Map<
    string,
    {
      acceptedAt: Date | null;
      acceptedBy: string | null;
      createdAt: Date;
      id: string;
      requesterId: string;
      resolvedAt: Date | null;
      reward: number;
      status: 'accepted' | 'cancelled' | 'completed' | 'expired' | 'failed' | 'open';
      targetId: string;
    }
  >;
  assassinationNotifications: Array<{
    contractId: string;
    createdAt: Date;
    id: string;
    message: string;
    playerId: string;
    title: string;
    type: 'accepted' | 'completed' | 'expired' | 'target_warned';
  }>;
  factionMembershipByPlayerId: Map<
    string,
    {
      factionId: string;
      rank: FactionRank;
    }
  >;
  players: Map<string, AuthPlayerRecord>;
  prisonReleaseByPlayerId: Map<string, Date>;
}

class InMemoryAuthPvpRepository implements AuthRepository, PvpRepository {
  constructor(private readonly state: TestState) {}

  async acceptAssassinationContract(contractId: string, assassinId: string, acceptedAt: Date) {
    const contract = this.state.assassinationContracts.get(contractId);

    if (!contract) {
      throw new Error('Contrato nao encontrado no estado de teste.');
    }

    contract.acceptedAt = acceptedAt;
    contract.acceptedBy = assassinId;
    contract.status = 'accepted';

    const target = this.state.players.get(contract.targetId);

    this.state.assassinationNotifications.unshift({
      contractId,
      createdAt: acceptedAt,
      id: randomUUID(),
      message: `O contrato contra ${target?.nickname ?? 'o alvo'} foi aceito e ja esta na rua.`,
      playerId: contract.requesterId,
      title: 'Contrato aceito',
      type: 'accepted',
    });

    return this.findAssassinationContractById(contractId).then((value) => {
      if (!value) {
        throw new Error('Contrato nao encontrado apos aceite.');
      }

      return value;
    });
  }

  async createAssassinationContract(
    input: Parameters<PvpRepository['createAssassinationContract']>[0],
  ) {
    const requester = this.state.players.get(input.requesterId);

    if (!requester) {
      throw new Error('Mandante nao encontrado no estado de teste.');
    }

    requester.money = (Number(requester.money) + input.requesterMoneyDelta).toFixed(2);

    const contractId = randomUUID();
    this.state.assassinationContracts.set(contractId, {
      acceptedAt: null,
      acceptedBy: null,
      createdAt: input.createdAt,
      id: contractId,
      requesterId: input.requesterId,
      resolvedAt: null,
      reward: input.reward,
      status: 'open',
      targetId: input.targetId,
    });

    return this.findAssassinationContractById(contractId).then((value) => {
      if (!value) {
        throw new Error('Contrato nao encontrado apos criacao.');
      }

      return value;
    });
  }

  async expireAssassinationContracts(expiredAt: Date, expiresBefore: Date) {
    for (const contract of this.state.assassinationContracts.values()) {
      if (
        (contract.status === 'open' || contract.status === 'accepted' || contract.status === 'failed') &&
        contract.createdAt.getTime() < expiresBefore.getTime()
      ) {
        const requester = this.state.players.get(contract.requesterId);
        const target = this.state.players.get(contract.targetId);

        if (requester) {
          requester.money = (Number(requester.money) + contract.reward).toFixed(2);
        }

        contract.status = 'expired';
        contract.resolvedAt = expiredAt;

        this.state.assassinationNotifications.unshift({
          contractId: contract.id,
          createdAt: expiredAt,
          id: randomUUID(),
          message: `Ninguem executou o contrato contra ${target?.nickname ?? 'o alvo'}. A recompensa voltou para o caixa e a taxa foi perdida.`,
          playerId: contract.requesterId,
          title: 'Contrato expirado',
          type: 'expired',
        });
      }
    }
  }

  async findActiveAssassinationContractForTarget(targetId: string, expiresBefore: Date) {
    for (const contract of this.state.assassinationContracts.values()) {
      if (
        contract.targetId === targetId &&
        (contract.status === 'open' || contract.status === 'accepted' || contract.status === 'failed') &&
        contract.createdAt.getTime() > expiresBefore.getTime()
      ) {
        return this.findAssassinationContractById(contract.id);
      }
    }

    return null;
  }

  async findAssassinationContractById(contractId: string) {
    const contract = this.state.assassinationContracts.get(contractId);

    if (!contract) {
      return null;
    }

    const requester = this.state.players.get(contract.requesterId);
    const target = this.state.players.get(contract.targetId);
    const acceptedBy = contract.acceptedBy ? this.state.players.get(contract.acceptedBy) : null;

    return {
      acceptedAt: contract.acceptedAt,
      acceptedBy: contract.acceptedBy,
      acceptedByNickname: acceptedBy?.nickname ?? null,
      createdAt: contract.createdAt,
      id: contract.id,
      requesterId: contract.requesterId,
      requesterNickname: requester?.nickname ?? 'desconhecido',
      resolvedAt: contract.resolvedAt,
      reward: contract.reward,
      status: contract.status,
      targetId: contract.targetId,
      targetNickname: target?.nickname ?? 'desconhecido',
    };
  }

  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const player: AuthPlayerRecord = {
      addiction: 0,
      appearanceJson: DEFAULT_CHARACTER_APPEARANCE,
      bankMoney: '0',
      carisma: 18,
      characterCreatedAt: null,
      createdAt: input.lastLogin,
      email: input.email,
      factionId: null,
      forca: 18,
      hp: 100,
      id: randomUUID(),
      inteligencia: 18,
      lastLogin: input.lastLogin,
      level: 1,
      brisa: 100,
      money: '1000.00',
      disposicao: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 12,
      positionY: 18,
      regionId: RegionId.ZonaNorte,
      resistencia: 18,
      cansaco: 100,
      vocation: VocationType.Cria,
      conceito: 1500,
    };

    this.state.players.set(player.id, player);
    return { ...player };
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.email === email) {
        return { ...player };
      }
    }

    return null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(id);
    return player ? { ...player } : null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    for (const player of this.state.players.values()) {
      if (player.nickname === nickname) {
        return { ...player };
      }
    }

    return null;
  }

  async getActivePrisonReleaseAt(playerId: string, now: Date): Promise<Date | null> {
    const releaseAt = this.state.prisonReleaseByPlayerId.get(playerId);

    if (!releaseAt || releaseAt.getTime() <= now.getTime()) {
      return null;
    }

    return new Date(releaseAt);
  }

  async getFactionCombatMemberships(playerIds: string[]) {
    const rows = playerIds.flatMap((playerId) => {
      const membership = this.state.factionMembershipByPlayerId.get(playerId);

      if (!membership) {
        return [];
      }

      return [
        [
          playerId,
          {
            factionId: membership.factionId,
            playerId,
            rank: membership.rank,
          },
        ] as const,
      ];
    });

    return new Map(rows);
  }

  async listAssassinationContracts(playerId: string) {
    const contracts = Array.from(this.state.assassinationContracts.values())
      .filter(
        (contract) =>
          contract.requesterId === playerId ||
          contract.targetId === playerId ||
          contract.acceptedBy === playerId ||
          contract.status === 'open' ||
          contract.status === 'failed',
      )
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((contract) => this.findAssassinationContractById(contract.id));

    return {
      contracts: (await Promise.all(contracts)).filter(Boolean),
      notifications: this.state.assassinationNotifications
        .filter((notification) => notification.playerId === playerId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
        .slice(0, 20),
    };
  }

  async persistAssassinationExecution(input: Parameters<PvpRepository['persistAssassinationExecution']>[0]) {
    const assassin = this.state.players.get(input.assassin.id);
    const target = this.state.players.get(input.target.id);
    const contract = this.state.assassinationContracts.get(input.contract.id);

    if (!assassin || !target || !contract) {
      throw new Error('Estado inconsistente na execucao do contrato.');
    }

    assassin.conceito = input.assassin.conceitoAfter;
    assassin.hp = input.assassin.hpAfter;
    assassin.level = input.assassin.levelAfter;
    assassin.money = (Number(assassin.money) + input.assassin.moneyDelta).toFixed(2);
    assassin.cansaco = input.assassin.cansacoAfter;

    target.hp = input.target.hpAfter;
    target.money = (Number(target.money) + input.target.moneyDelta).toFixed(2);

    contract.acceptedAt = input.contract.acceptedAt;
    contract.acceptedBy = input.contract.acceptedBy;
    contract.resolvedAt = input.contract.resolvedAt;
    contract.status = input.contract.status;

    for (const notification of input.notifications) {
      this.state.assassinationNotifications.unshift({
        ...notification,
        id: randomUUID(),
      });
    }
  }

  async persistAmbush(input: Parameters<PvpRepository['persistAmbush']>[0]) {
    for (const attackerSnapshot of input.attackers) {
      const attacker = this.state.players.get(attackerSnapshot.id);

      if (!attacker) {
        throw new Error('Jogador ausente no estado de teste.');
      }

      attacker.conceito = attackerSnapshot.conceitoAfter;
      attacker.hp = attackerSnapshot.hpAfter;
      attacker.level = attackerSnapshot.levelAfter;
      attacker.money = (Number(attacker.money) + attackerSnapshot.moneyDelta).toFixed(2);
      attacker.cansaco = attackerSnapshot.cansacoAfter;
    }

    const defender = this.state.players.get(input.defender.id);

    if (!defender) {
      throw new Error('Jogador ausente no estado de teste.');
    }

    defender.hp = input.defender.hpAfter;
    defender.money = (Number(defender.money) + input.defender.moneyDelta).toFixed(2);
  }

  async persistAssault(input: Parameters<PvpRepository['persistAssault']>[0]) {
    const attacker = this.state.players.get(input.attacker.id);
    const defender = this.state.players.get(input.defender.id);

    if (!attacker || !defender) {
      throw new Error('Jogador ausente no estado de teste.');
    }

    attacker.carisma = input.attacker.attributes.carisma;
    attacker.conceito = input.attacker.conceitoAfter;
    attacker.forca = input.attacker.attributes.forca;
    attacker.hp = input.attacker.hpAfter;
    attacker.inteligencia = input.attacker.attributes.inteligencia;
    attacker.level = input.attacker.levelAfter;
    attacker.money = (Number(attacker.money) + input.attacker.moneyDelta).toFixed(2);
    attacker.resistencia = input.attacker.attributes.resistencia;
    attacker.cansaco = input.attacker.cansacoAfter;

    defender.carisma = input.defender.attributes.carisma;
    defender.forca = input.defender.attributes.forca;
    defender.hp = input.defender.hpAfter;
    defender.inteligencia = input.defender.attributes.inteligencia;
    defender.money = (Number(defender.money) + input.defender.moneyDelta).toFixed(2);
    defender.resistencia = input.defender.attributes.resistencia;

  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
  }
}

class InMemoryCombatRepository {
  constructor(
    private readonly state: TestState,
    private readonly policeHeatSystem: PoliceHeatSystem,
  ) {}

  async getPlayerContext(playerId: string): Promise<CombatPlayerContext | null> {
    const player = this.state.players.get(playerId);

    if (!player) {
      return null;
    }

    const heat = await this.policeHeatSystem.getHeat(playerId);

    return {
      attributes: {
        carisma: player.carisma,
        forca: player.forca,
        inteligencia: player.inteligencia,
        resistencia: player.resistencia,
      },
      equipment: {
        vest: {
          defense: 10,
          durability: 100,
          inventoryItemId: `${player.id}-vest`,
        },
        weapon: {
          durability: 100,
          inventoryItemId: `${player.id}-weapon`,
          power: 20,
          proficiency: 20,
        },
      },
      factionId: player.factionId,
      player: {
        characterCreatedAt: player.characterCreatedAt,
        id: player.id,
        level: player.level,
        nickname: player.nickname,
        regionId: player.regionId as RegionId,
        resources: {
          conceito: player.conceito,
          heat: heat.score,
          hp: player.hp,
          money: Number(player.money),
          cansaco: player.cansaco,
        },
        vocation: player.vocation as VocationType,
      },
    };
  }
}

class InMemoryKeyValueStore implements KeyValueStore {
  private readonly values = new Map<string, string>();

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async increment(key: string): Promise<number> {
    const nextValue = Number.parseInt(this.values.get(key) ?? '0', 10) + 1;
    this.values.set(key, String(nextValue));
    return nextValue;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

class SequencedHospitalizationReader implements HospitalizationSystemContract {
  constructor(private readonly statusesByPlayerId: Map<string, boolean[]>) {}

  async getHospitalizationStatus(playerId: string) {
    const queue = this.statusesByPlayerId.get(playerId) ?? [];
    const isHospitalized = queue.shift() ?? false;

    return {
      endsAt: isHospitalized ? new Date('2026-03-20T12:30:00.000Z').toISOString() : null,
      isHospitalized,
      reason: isHospitalized ? 'combat' : null,
      remainingSeconds: isHospitalized ? 1800 : 0,
      startedAt: isHospitalized ? new Date('2026-03-20T12:00:00.000Z').toISOString() : null,
      trigger: null,
    };
  }

  async hospitalize(playerId: string) {
    return this.getHospitalizationStatus(playerId);
  }
}

function createRandomSequence(values: number[]) {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

async function buildTestApp(
  state: TestState,
  options: {
    hospitalizationSystem?: HospitalizationSystemContract;
    now?: () => Date;
  } = {},
) {
  const keyValueStore = new InMemoryKeyValueStore();
  const authRepository = new InMemoryAuthPvpRepository(state);
  const authService = new AuthService({
    keyValueStore,
    repository: authRepository,
  });
  const policeHeatSystem = new PoliceHeatSystem({
    keyValueStore,
  });
  const hospitalizationSystem =
    options.hospitalizationSystem ??
    new OverdoseSystem({
      keyValueStore,
    });
  const combatSystem = new CombatSystem({
    policeHeatSystem,
    random: createRandomSequence([0.4, 0.3, 0.5]),
    repository: new InMemoryCombatRepository(state, policeHeatSystem),
  });
  const pvpService = new PvpService({
    combatSystem,
    cooldownSystem: new CooldownSystem({
      keyValueStore,
    }),
    hospitalizationSystem,
    keyValueStore,
    now: options.now,
    policeHeatSystem,
    repository: authRepository,
  });

  const app = Fastify();

  await app.register(createAuthRoutes({ authService }));
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
    await protectedRoutes.register(createPvpRoutes({ pvpService }));
  });

  return {
    app,
    authService,
    hospitalizationSystem,
    policeHeatSystem,
    pvpService,
  };
}

describe('pvp routes', () => {
  let state: TestState;
  let testApp: Awaited<ReturnType<typeof buildTestApp>>;

  beforeEach(async () => {
    state = {
      assassinationContracts: new Map(),
      assassinationNotifications: [],
      factionMembershipByPlayerId: new Map(),
      players: new Map(),
      prisonReleaseByPlayerId: new Map(),
    };
    testApp = await buildTestApp(state, {
      now: () => new Date('2026-03-20T12:00:00.000Z'),
    });
  });

  afterEach(async () => {
    await testApp.app.close();
    await testApp.pvpService.close?.();
  });

  it('executes a 1v1 assault, transfers loot, applies hospitalization and consumes cansaco', async () => {
    const attackerAuth = await testApp.authService.register({
      email: 'attacker@csr.io',
      nickname: 'atacante',
      password: 'senha-forte-1',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'defender@csr.io',
      nickname: 'alvo',
      password: 'senha-forte-2',
    });
    const attacker = state.players.get(attackerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!attacker || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    attacker.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    attacker.level = 6;
    attacker.forca = 38;
    attacker.resistencia = 30;
    attacker.vocation = VocationType.Soldado;
    attacker.regionId = RegionId.ZonaNorte;
    defender.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    defender.level = 5;
    defender.forca = 15;
    defender.resistencia = 12;
    defender.regionId = RegionId.ZonaNorte;

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      tier: 'clear_victory',
      targetCooldownSeconds: 21600,
      attacker: {
        id: attacker.id,
        nickname: 'atacante',
        cansacoAfter: 80,
      },
      defender: {
        id: defender.id,
        nickname: 'alvo',
      },
      loot: {
        amount: 160,
        percentage: 0.16,
      },
    });

    expect(Number(attacker.money)).toBe(1160);
    expect(Number(defender.money)).toBe(840);
    expect(attacker.cansaco).toBe(80);
    expect(attacker.conceito).toBeGreaterThan(1500);

    const defenderHospitalization =
      await testApp.hospitalizationSystem.getHospitalizationStatus(defender.id);
    expect(defenderHospitalization.isHospitalized).toBe(true);
    expect(defenderHospitalization.reason).toBe('combat');
  });

  it('revalidates hospitalization immediately before persisting the assault', async () => {
    await testApp.app.close();
    await testApp.pvpService.close?.();

    const attackerAuth = await testApp.authService.register({
      email: 'attacker-race@csr.io',
      nickname: 'atacante_race',
      password: 'senha-forte-1',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'defender-race@csr.io',
      nickname: 'alvo_race',
      password: 'senha-forte-2',
    });
    const attacker = state.players.get(attackerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!attacker || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    attacker.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    attacker.level = 6;
    attacker.forca = 38;
    attacker.resistencia = 30;
    attacker.vocation = VocationType.Soldado;
    attacker.regionId = RegionId.ZonaNorte;
    defender.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    defender.level = 5;
    defender.forca = 15;
    defender.resistencia = 12;
    defender.regionId = RegionId.ZonaNorte;

    testApp = await buildTestApp(state, {
      hospitalizationSystem: new SequencedHospitalizationReader(
        new Map([
          [attacker.id, [false, false]],
          [defender.id, [false, true]],
        ]),
      ),
      now: () => new Date('2026-03-20T12:00:00.000Z'),
    });

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().message).toContain('hospitalizado');
    expect(state.players.get(defender.id)?.hp).toBe(100);
    expect(state.players.get(attacker.id)?.cansaco).toBe(100);
  });

  it('blocks a repeated assault against the same target while cooldown is active', async () => {
    const attackerAuth = await testApp.authService.register({
      email: 'attacker2@csr.io',
      nickname: 'atacante2',
      password: 'senha-forte-3',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'defender2@csr.io',
      nickname: 'alvo2',
      password: 'senha-forte-4',
    });
    const attacker = state.players.get(attackerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!attacker || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    attacker.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    attacker.level = 6;
    attacker.forca = 10;
    attacker.resistencia = 10;
    defender.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    defender.level = 5;
    defender.forca = 36;
    defender.resistencia = 28;

    const first = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(first.statusCode).toBe(200);

    const second = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({
      message: expect.stringContaining('atacado recentemente'),
    });
  });

  it('blocks assault when attacker and target are in different regions', async () => {
    const attackerAuth = await testApp.authService.register({
      email: 'attacker3@csr.io',
      nickname: 'atacante3',
      password: 'senha-forte-5',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'defender3@csr.io',
      nickname: 'alvo3',
      password: 'senha-forte-6',
    });
    const attacker = state.players.get(attackerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!attacker || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    attacker.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    attacker.level = 6;
    attacker.regionId = RegionId.ZonaNorte;
    defender.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    defender.level = 6;
    defender.regionId = RegionId.Centro;

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'Atacante e alvo precisam estar na mesma regiao.',
    });
  });

  it('blocks assault against a protected novice target', async () => {
    const attackerAuth = await testApp.authService.register({
      email: 'attacker-novice@csr.io',
      nickname: 'atacante4',
      password: 'senha-forte-40',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'defender-novice@csr.io',
      nickname: 'alvo4',
      password: 'senha-forte-41',
    });
    const attacker = state.players.get(attackerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!attacker || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    attacker.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    attacker.level = 6;
    attacker.regionId = RegionId.ZonaNorte;
    defender.characterCreatedAt = new Date('2026-03-19T12:00:00.000Z');
    defender.level = 6;
    defender.regionId = RegionId.ZonaNorte;

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'O alvo esta sob protecao de novato.',
    });
  });

  it('blocks assault while the attacker is still under novice protection', async () => {
    const attackerAuth = await testApp.authService.register({
      email: 'attacker-protegido@csr.io',
      nickname: 'atacante5',
      password: 'senha-forte-42',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'defender-protegido@csr.io',
      nickname: 'alvo5',
      password: 'senha-forte-43',
    });
    const attacker = state.players.get(attackerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!attacker || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    attacker.characterCreatedAt = new Date('2026-03-19T12:00:00.000Z');
    attacker.level = 6;
    attacker.regionId = RegionId.ZonaNorte;
    defender.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    defender.level = 6;
    defender.regionId = RegionId.ZonaNorte;

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${attackerAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/assault/${defender.id}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'O atacante ainda esta sob protecao de novato e nao pode iniciar PvP.',
    });
  });

  it('executes an ambush, splits loot by contribution and applies the target cooldown', async () => {
    const initiatorAuth = await testApp.authService.register({
      email: 'gerente@csr.io',
      nickname: 'gerente',
      password: 'senha-forte-7',
    });
    const partnerOneAuth = await testApp.authService.register({
      email: 'soldado@csr.io',
      nickname: 'soldado',
      password: 'senha-forte-8',
    });
    const partnerTwoAuth = await testApp.authService.register({
      email: 'vapor@csr.io',
      nickname: 'vapor',
      password: 'senha-forte-9',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'alvo-emboscada@csr.io',
      nickname: 'alvo_emb',
      password: 'senha-forte-10',
    });

    const initiator = state.players.get(initiatorAuth.player.id);
    const partnerOne = state.players.get(partnerOneAuth.player.id);
    const partnerTwo = state.players.get(partnerTwoAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!initiator || !partnerOne || !partnerTwo || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    for (const attacker of [initiator, partnerOne, partnerTwo]) {
      attacker.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
      attacker.regionId = RegionId.ZonaNorte;
      attacker.factionId = 'faccao-1';
      attacker.level = 6;
      attacker.vocation = VocationType.Soldado;
    }

    initiator.forca = 34;
    initiator.resistencia = 28;
    partnerOne.forca = 30;
    partnerOne.resistencia = 24;
    partnerTwo.forca = 24;
    partnerTwo.resistencia = 22;

    defender.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    defender.regionId = RegionId.ZonaNorte;
    defender.level = 5;
    defender.forca = 14;
    defender.resistencia = 12;

    state.factionMembershipByPlayerId.set(initiator.id, {
      factionId: 'faccao-1',
      rank: 'gerente',
    });
    state.factionMembershipByPlayerId.set(partnerOne.id, {
      factionId: 'faccao-1',
      rank: 'soldado',
    });
    state.factionMembershipByPlayerId.set(partnerTwo.id, {
      factionId: 'faccao-1',
      rank: 'vapor',
    });

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${initiatorAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: [partnerOne.id, partnerTwo.id],
      },
      url: `/pvp/ambush/${defender.id}`,
    });

    expect(response.statusCode).toBe(200);

    const payload = response.json();
    expect(payload).toMatchObject({
      mode: 'ambush',
      success: true,
      targetCooldownSeconds: 43200,
    });
    expect(payload.attackers).toHaveLength(3);
    expect(payload.attackers.every((attacker: { cansacoAfter: number }) => attacker.cansacoAfter === 85)).toBe(true);
    expect(payload.loot.amount).toBeGreaterThan(0);

    const totalAttackerGain = payload.attackers.reduce(
      (sum: number, attacker: { moneyDelta: number }) => sum + attacker.moneyDelta,
      0,
    );
    expect(Number(totalAttackerGain.toFixed(2))).toBe(payload.loot.amount);
    const totalConceitoGain = payload.attackers.reduce(
      (sum: number, attacker: { conceitoDelta: number }) => sum + attacker.conceitoDelta,
      0,
    );
    expect(totalConceitoGain).toBeGreaterThan(0);
    expect(Math.max(...payload.attackers.map((attacker: { conceitoDelta: number }) => attacker.conceitoDelta))).toBeLessThanOrEqual(
      Math.min(...payload.attackers.map((attacker: { conceitoDelta: number }) => attacker.conceitoDelta)) + 1,
    );
    expect(payload.attackers[0].moneyDelta).toBeGreaterThan(payload.attackers[2].moneyDelta);

    const defenderHospitalization =
      await testApp.hospitalizationSystem.getHospitalizationStatus(defender.id);
    expect(defenderHospitalization.isHospitalized).toBe(true);
    expect(defenderHospitalization.reason).toBe('combat');
  });

  it('blocks ambush when the initiator is below gerente', async () => {
    const initiatorAuth = await testApp.authService.register({
      email: 'vapor-iniciador@csr.io',
      nickname: 'vapor_ini',
      password: 'senha-forte-11',
    });
    const partnerAuth = await testApp.authService.register({
      email: 'soldado-apoio@csr.io',
      nickname: 'sold_apoio',
      password: 'senha-forte-12',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'alvo-vapor@csr.io',
      nickname: 'alvo_vapor',
      password: 'senha-forte-13',
    });

    const initiator = state.players.get(initiatorAuth.player.id);
    const partner = state.players.get(partnerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!initiator || !partner || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    for (const player of [initiator, partner, defender]) {
      player.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
      player.regionId = RegionId.ZonaNorte;
      player.level = 6;
    }

    initiator.factionId = 'faccao-2';
    partner.factionId = 'faccao-2';
    state.factionMembershipByPlayerId.set(initiator.id, {
      factionId: 'faccao-2',
      rank: 'vapor',
    });
    state.factionMembershipByPlayerId.set(partner.id, {
      factionId: 'faccao-2',
      rank: 'soldado',
    });

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${initiatorAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: [partner.id],
      },
      url: `/pvp/ambush/${defender.id}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'Apenas gerente, general ou patrao podem iniciar uma emboscada.',
    });
  });

  it('blocks ambush when one participant is below soldado', async () => {
    const initiatorAuth = await testApp.authService.register({
      email: 'gerente2@csr.io',
      nickname: 'gerente2',
      password: 'senha-forte-14',
    });
    const partnerAuth = await testApp.authService.register({
      email: 'cria@csr.io',
      nickname: 'cria',
      password: 'senha-forte-15',
    });
    const defenderAuth = await testApp.authService.register({
      email: 'alvo-cria@csr.io',
      nickname: 'alvo_cria',
      password: 'senha-forte-16',
    });

    const initiator = state.players.get(initiatorAuth.player.id);
    const partner = state.players.get(partnerAuth.player.id);
    const defender = state.players.get(defenderAuth.player.id);

    if (!initiator || !partner || !defender) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    for (const player of [initiator, partner, defender]) {
      player.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
      player.regionId = RegionId.ZonaNorte;
      player.level = 6;
    }

    initiator.factionId = 'faccao-3';
    partner.factionId = 'faccao-3';
    state.factionMembershipByPlayerId.set(initiator.id, {
      factionId: 'faccao-3',
      rank: 'gerente',
    });
    state.factionMembershipByPlayerId.set(partner.id, {
      factionId: 'faccao-3',
      rank: 'cria',
    });

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${initiatorAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        participantIds: [partner.id],
      },
      url: `/pvp/ambush/${defender.id}`,
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'Somente soldado ou superior podem participar da emboscada.',
    });
  });

  it('creates a contract, charges fee plus reward and exposes it on the mural', async () => {
    const requesterAuth = await testApp.authService.register({
      email: 'mandante@csr.io',
      nickname: 'mandante',
      password: 'senha-forte-17',
    });
    const targetAuth = await testApp.authService.register({
      email: 'alvo-contrato@csr.io',
      nickname: 'alvo_contrato',
      password: 'senha-forte-18',
    });
    const hunterAuth = await testApp.authService.register({
      email: 'cacador@csr.io',
      nickname: 'cacador',
      password: 'senha-forte-19',
    });

    const requester = state.players.get(requesterAuth.player.id);
    const target = state.players.get(targetAuth.player.id);
    const hunter = state.players.get(hunterAuth.player.id);

    if (!requester || !target || !hunter) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    for (const player of [requester, target, hunter]) {
      player.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
      player.regionId = RegionId.ZonaNorte;
    }

    requester.level = 7;
    requester.money = '2000.00';
    target.level = 6;
    hunter.level = 5;

    const createResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${requesterAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        reward: 500,
        targetPlayerId: target.id,
      },
      url: '/pvp/contracts',
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json()).toMatchObject({
      contract: {
        fee: 50,
        requesterId: requester.id,
        reward: 500,
        status: 'open',
        targetId: target.id,
        totalCost: 550,
      },
    });
    expect(Number(requester.money)).toBe(1450);

    const muralResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${hunterAuth.accessToken}`,
      },
      method: 'GET',
      url: '/pvp/contracts',
    });

    expect(muralResponse.statusCode).toBe(200);
    expect(muralResponse.json()).toMatchObject({
      availableContracts: [
        {
          canAccept: true,
          requesterId: requester.id,
          reward: 500,
          status: 'open',
          targetId: target.id,
        },
      ],
    });
  });

  it('accepts and completes a contract with abate total, paying the reward to the assassin', async () => {
    const requesterAuth = await testApp.authService.register({
      email: 'mandante2@csr.io',
      nickname: 'mandante2',
      password: 'senha-forte-20',
    });
    const targetAuth = await testApp.authService.register({
      email: 'alvo2-contrato@csr.io',
      nickname: 'alvo2_contrato',
      password: 'senha-forte-21',
    });
    const assassinAuth = await testApp.authService.register({
      email: 'assassino@csr.io',
      nickname: 'assassino',
      password: 'senha-forte-22',
    });

    const requester = state.players.get(requesterAuth.player.id);
    const target = state.players.get(targetAuth.player.id);
    const assassin = state.players.get(assassinAuth.player.id);

    if (!requester || !target || !assassin) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    requester.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    requester.level = 7;
    requester.money = '4000.00';
    requester.regionId = RegionId.ZonaNorte;

    target.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    target.level = 5;
    target.forca = 10;
    target.resistencia = 10;
    target.money = '2000.00';
    target.regionId = RegionId.ZonaNorte;

    assassin.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    assassin.level = 6;
    assassin.forca = 45;
    assassin.resistencia = 34;
    assassin.money = '1000.00';
    assassin.regionId = RegionId.ZonaNorte;
    assassin.vocation = VocationType.Soldado;

    const createResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${requesterAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        reward: 800,
        targetPlayerId: target.id,
      },
      url: '/pvp/contracts',
    });
    const contractId = createResponse.json().contract.id as string;

    const acceptResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${assassinAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/contracts/${contractId}/accept`,
    });

    expect(acceptResponse.statusCode).toBe(200);
    expect(acceptResponse.json()).toMatchObject({
      contract: {
        acceptedBy: assassin.id,
        status: 'accepted',
      },
    });

    const executeResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${assassinAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/contracts/${contractId}/execute`,
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      contract: {
        acceptedBy: assassin.id,
        id: contractId,
        status: 'completed',
      },
      fatality: {
        defenderDied: true,
      },
      mode: 'contract',
      success: true,
      targetNotified: false,
      tier: 'total_takedown',
    });
    expect(Number(assassin.money)).toBeGreaterThan(1800);

    const requesterView = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${requesterAuth.accessToken}`,
      },
      method: 'GET',
      url: '/pvp/contracts',
    });

    expect(requesterView.statusCode).toBe(200);
    expect(requesterView.json().notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'accepted' }),
        expect.objectContaining({ type: 'completed' }),
      ]),
    );
  });

  it('reopens the contract after a failed execution and warns the target', async () => {
    const requesterAuth = await testApp.authService.register({
      email: 'mandante3@csr.io',
      nickname: 'mandante3',
      password: 'senha-forte-23',
    });
    const targetAuth = await testApp.authService.register({
      email: 'alvo3-contrato@csr.io',
      nickname: 'alvo3_contrato',
      password: 'senha-forte-24',
    });
    const assassinAuth = await testApp.authService.register({
      email: 'assassino-fraco@csr.io',
      nickname: 'assassino_fraco',
      password: 'senha-forte-25',
    });
    const replacementAuth = await testApp.authService.register({
      email: 'assassino-reserva@csr.io',
      nickname: 'reserva',
      password: 'senha-forte-26',
    });

    const requester = state.players.get(requesterAuth.player.id);
    const target = state.players.get(targetAuth.player.id);
    const assassin = state.players.get(assassinAuth.player.id);
    const replacement = state.players.get(replacementAuth.player.id);

    if (!requester || !target || !assassin || !replacement) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    for (const player of [requester, target, assassin, replacement]) {
      player.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
      player.regionId = RegionId.ZonaNorte;
    }

    requester.level = 7;
    requester.money = '3000.00';
    target.level = 7;
    target.forca = 46;
    target.resistencia = 35;
    assassin.level = 5;
    assassin.forca = 12;
    assassin.resistencia = 10;
    replacement.level = 5;

    const createResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${requesterAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        reward: 600,
        targetPlayerId: target.id,
      },
      url: '/pvp/contracts',
    });
    const contractId = createResponse.json().contract.id as string;

    await testApp.app.inject({
      headers: {
        authorization: `Bearer ${assassinAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/contracts/${contractId}/accept`,
    });

    const executeResponse = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${assassinAuth.accessToken}`,
      },
      method: 'POST',
      url: `/pvp/contracts/${contractId}/execute`,
    });

    expect(executeResponse.statusCode).toBe(200);
    expect(executeResponse.json()).toMatchObject({
      contract: {
        acceptedBy: null,
        id: contractId,
        status: 'failed',
      },
      success: false,
      targetNotified: true,
    });

    const targetView = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${targetAuth.accessToken}`,
      },
      method: 'GET',
      url: '/pvp/contracts',
    });

    expect(targetView.statusCode).toBe(200);
    expect(targetView.json().notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'target_warned' }),
      ]),
    );

    const replacementView = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${replacementAuth.accessToken}`,
      },
      method: 'GET',
      url: '/pvp/contracts',
    });

    expect(replacementView.statusCode).toBe(200);
    expect(replacementView.json()).toMatchObject({
      availableContracts: [
        expect.objectContaining({
          canAccept: true,
          id: contractId,
          status: 'failed',
        }),
      ],
    });
  });

  it('blocks creating a contract against a protected novice target', async () => {
    const requesterAuth = await testApp.authService.register({
      email: 'mandante-novato@csr.io',
      nickname: 'mandante4',
      password: 'senha-forte-44',
    });
    const targetAuth = await testApp.authService.register({
      email: 'alvo-novato@csr.io',
      nickname: 'alvo6',
      password: 'senha-forte-45',
    });

    const requester = state.players.get(requesterAuth.player.id);
    const target = state.players.get(targetAuth.player.id);

    if (!requester || !target) {
      throw new Error('Falha ao montar jogadores do teste.');
    }

    requester.characterCreatedAt = new Date('2026-03-11T12:00:00.000Z');
    requester.level = 7;
    requester.money = '2000.00';
    requester.regionId = RegionId.ZonaNorte;
    target.characterCreatedAt = new Date('2026-03-19T12:00:00.000Z');
    target.level = 6;
    target.regionId = RegionId.ZonaNorte;

    const response = await testApp.app.inject({
      headers: {
        authorization: `Bearer ${requesterAuth.accessToken}`,
      },
      method: 'POST',
      payload: {
        reward: 300,
        targetPlayerId: target.id,
      },
      url: '/pvp/contracts',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({
      message: 'O alvo esta sob protecao de novato.',
    });
  });
});
