import { randomUUID } from 'node:crypto';

import {
  DEFAULT_CHARACTER_APPEARANCE,
  RegionId,
  UNIVERSITY_EMPTY_PASSIVE_PROFILE,
  VocationType,
} from '@cs-rio/shared';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createAuthMiddleware } from '../src/api/middleware/auth.js';
import { createAuthRoutes } from '../src/api/routes/auth.js';
import { createTribunalRoutes } from '../src/api/routes/tribunal.js';
import { AuthService, type AuthPlayerRecord, type AuthRepository, type KeyValueStore } from '../src/services/auth.js';
import {
  TRIBUNAL_STORY_TEMPLATE_COUNTS,
  TribunalService,
  type TribunalRepository,
} from '../src/services/tribunal.js';

interface InMemoryTribunalFavelaRecord {
  controllingFactionId: string | null;
  id: string;
  name: string;
  population: number;
  regionId: RegionId;
  satisfaction: number;
  state: 'at_war' | 'controlled' | 'neutral' | 'state';
}

interface InMemoryTribunalCaseRecord {
  accusedCharismaCommunity: number;
  accusedCharismaFaction: number;
  accusedName: string;
  accusedStatement: string;
  accuserCharismaCommunity: number;
  accuserCharismaFaction: number;
  accuserName: string;
  accuserStatement: string;
  antigaoHint: string;
  antigaoSuggestedPunishment:
    | 'aviso'
    | 'expulsao'
    | 'esquartejar'
    | 'matar'
    | 'queimar_no_pneu'
    | 'surra';
  caseType:
    | 'agressao'
    | 'divida_drogas'
    | 'divida_jogo'
    | 'estupro'
    | 'homicidio_nao_autorizado'
    | 'roubo_entre_moradores'
    | 'talaricagem';
  communitySupports: 'accused' | 'accuser';
  conceitoImpact: number | null;
  createdAt: Date;
  favelaId: string;
  id: string;
  judgedAt: Date | null;
  judgedBy: string | null;
  moralFacaoImpact: number | null;
  moralMoradoresImpact: number | null;
  punishmentChosen: 'aviso' | 'expulsao' | 'esquartejar' | 'matar' | 'queimar_no_pneu' | 'surra' | null;
  truthSide: 'accused' | 'accuser';
}

interface TestState {
  casesByFavelaId: Map<string, InMemoryTribunalCaseRecord[]>;
  favelas: Map<string, InMemoryTribunalFavelaRecord>;
  factions: Map<string, { id: string; internalSatisfaction: number }>;
  membershipsByPlayerId: Map<string, { factionId: string; rank: 'cria' | 'general' | 'gerente' | 'patrao' | 'soldado' | 'vapor' }>;
  players: Map<string, AuthPlayerRecord>;
}

class InMemoryAuthTribunalRepository implements AuthRepository, TribunalRepository {
  constructor(private readonly state: TestState) {}

  async applyJudgment(input: {
    caseId: string;
    conceitoAfter: number | null;
    conceitoImpact: number;
    factionId: string;
    factionInternalSatisfactionAfter: number;
    judgedAt: Date;
    judgedBy: string | null;
    moralFacaoImpact: number;
    moralMoradoresImpact: number;
    playerId: string | null;
    playerLevelAfter: number | null;
    punishmentChosen: 'aviso' | 'expulsao' | 'esquartejar' | 'matar' | 'queimar_no_pneu' | 'surra';
    satisfactionAfter: number;
  }) {
    const faction = this.state.factions.get(input.factionId);
    const caseRecord = [...this.state.casesByFavelaId.values()]
      .flat()
      .find((entry) => entry.id === input.caseId && entry.judgedAt === null);

    if (!faction || !caseRecord) {
      return null;
    }

    let playerRecord: AuthPlayerRecord | null = null;

    if (
      input.playerId &&
      input.conceitoAfter !== null &&
      input.playerLevelAfter !== null
    ) {
      const player = this.state.players.get(input.playerId);

      if (!player) {
        return null;
      }

      player.conceito = input.conceitoAfter;
      player.level = input.playerLevelAfter;
      playerRecord = { ...player };
    }

    faction.internalSatisfaction = input.factionInternalSatisfactionAfter;

    const favela = this.state.favelas.get(caseRecord.favelaId);
    if (favela) {
      favela.satisfaction = input.satisfactionAfter;
    }

    caseRecord.conceitoImpact = input.conceitoImpact;
    caseRecord.judgedAt = input.judgedAt;
    caseRecord.judgedBy = input.judgedBy;
    caseRecord.moralFacaoImpact = input.moralFacaoImpact;
    caseRecord.moralMoradoresImpact = input.moralMoradoresImpact;
    caseRecord.punishmentChosen = input.punishmentChosen;

    return {
      caseRecord: { ...caseRecord },
      factionInternalSatisfactionAfter: faction.internalSatisfaction,
      playerRecord,
      satisfactionAfter: input.satisfactionAfter,
    };
  }

  async createCase(input: {
    accusedCharismaCommunity: number;
    accusedCharismaFaction: number;
    accusedName: string;
    accusedStatement: string;
    accuserCharismaCommunity: number;
    accuserCharismaFaction: number;
    accuserName: string;
    accuserStatement: string;
    antigaoHint: string;
    antigaoSuggestedPunishment: 'aviso' | 'expulsao' | 'esquartejar' | 'matar' | 'queimar_no_pneu' | 'surra';
    caseType:
      | 'agressao'
      | 'divida_drogas'
      | 'divida_jogo'
      | 'estupro'
      | 'homicidio_nao_autorizado'
      | 'roubo_entre_moradores'
      | 'talaricagem';
    communitySupports: 'accused' | 'accuser';
    createdAt: Date;
    favelaId: string;
    truthSide: 'accused' | 'accuser';
  }) {
    const createdCase: InMemoryTribunalCaseRecord = {
      ...input,
      conceitoImpact: null,
      id: randomUUID(),
      judgedAt: null,
      judgedBy: null,
      moralFacaoImpact: null,
      moralMoradoresImpact: null,
      punishmentChosen: null,
    };

    const existing = this.state.casesByFavelaId.get(input.favelaId) ?? [];
    existing.push(createdCase);
    this.state.casesByFavelaId.set(input.favelaId, existing);

    return { ...createdCase };
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
      characterCreatedAt: new Date('2026-03-11T12:00:00.000Z'),
      conceito: 25000,
      createdAt: new Date('2026-03-11T12:00:00.000Z'),
      email: input.email,
      factionId: null,
      forca: 24,
      hp: 100,
      id: randomUUID(),
      inteligencia: 20,
      lastLogin: input.lastLogin,
      level: 7,
      brisa: 100,
      money: '150000.00',
      disposicao: 100,
      nickname: input.nickname,
      passwordHash: input.passwordHash,
      positionX: 84,
      positionY: 118,
      regionId: RegionId.ZonaNorte,
      resistencia: 22,
      cansaco: 100,
      vocation: VocationType.Gerente,
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

  async getFavela(favelaId: string) {
    const favela = this.state.favelas.get(favelaId);
    return favela ? { ...favela } : null;
  }

  async getFaction(factionId: string) {
    const faction = this.state.factions.get(factionId);
    return faction ? { ...faction } : null;
  }

  async getOpenCase(favelaId: string) {
    const openCase = [...(this.state.casesByFavelaId.get(favelaId) ?? [])]
      .filter((entry) => entry.judgedAt === null)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

    return openCase ? { ...openCase } : null;
  }

  async getLatestCase(favelaId: string) {
    const latestCase = [...(this.state.casesByFavelaId.get(favelaId) ?? [])]
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

    return latestCase ? { ...latestCase } : null;
  }

  async getPlayer(playerId: string): Promise<AuthPlayerRecord | null> {
    const player = this.state.players.get(playerId);
    return player ? { ...player } : null;
  }

  async getPlayerFactionMembership(playerId: string) {
    const membership = this.state.membershipsByPlayerId.get(playerId);
    return membership ? { ...membership } : null;
  }

  async listControlledFavelas(factionId: string) {
    return [...this.state.favelas.values()]
      .filter((favela) => favela.controllingFactionId === factionId && favela.state === 'controlled')
      .map((favela) => ({ ...favela }));
  }

  async listLatestCasesByFavelaIds(favelaIds: string[]) {
    return favelaIds
      .map((favelaId) => {
        const latestCase = [...(this.state.casesByFavelaId.get(favelaId) ?? [])]
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

        return latestCase ? { ...latestCase } : null;
      })
      .filter((caseRecord): caseRecord is InMemoryTribunalCaseRecord => caseRecord !== null);
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    const player = this.state.players.get(playerId);

    if (player) {
      player.lastLogin = date;
    }
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

describe('tribunal routes', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>;
  let state: TestState;

  beforeEach(async () => {
    state = {
      casesByFavelaId: new Map(),
      favelas: new Map([
        [
          'favela-zona-norte',
          {
            controllingFactionId: 'faccao-amigos',
            id: 'favela-zona-norte',
            name: 'Morro da Coroa',
            population: 6200,
            regionId: RegionId.ZonaNorte,
            satisfaction: 38,
            state: 'controlled',
          },
        ],
        [
          'favela-rival',
          {
            controllingFactionId: 'faccao-rival',
            id: 'favela-rival',
            name: 'Morro do Sapo',
            population: 4200,
            regionId: RegionId.ZonaNorte,
            satisfaction: 51,
            state: 'controlled',
          },
        ],
      ]),
      factions: new Map([
        ['faccao-amigos', { id: 'faccao-amigos', internalSatisfaction: 54 }],
        ['faccao-rival', { id: 'faccao-rival', internalSatisfaction: 48 }],
      ]),
      membershipsByPlayerId: new Map(),
      players: new Map(),
    };

    app = await buildTestApp({
      randomSequence: [0.01, 0.25, 0.8, 0.34, 0.67, 0.11, 0.45, 0.52, 0.18, 0.91, 0.39],
      state,
    });
  });

  afterEach(async () => {
    await app.server.close();
  });

  it('ships at least five story template variations per tribunal case type', () => {
    const counts = Object.values(TRIBUNAL_STORY_TEMPLATE_COUNTS);
    const totalTexts = counts.reduce((sum, count) => sum + count * 2, 0);

    expect(counts.every((count) => count >= 5)).toBe(true);
    expect(totalTexts).toBeGreaterThanOrEqual(50);
  });

  it('generates a tribunal case for a controlling general and reuses the open case', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'general');

    const generateResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/tribunal/favelas/favela-zona-norte/case',
    });

    expect(generateResponse.statusCode).toBe(201);
    expect(generateResponse.json().created).toBe(true);
    expect(generateResponse.json().activeCase.definition.type).toBe('roubo_entre_moradores');
    expect(generateResponse.json().activeCase.status).toBe('open');
    expect(generateResponse.json().activeCase.decisionDeadlineAt).toBeTruthy();
    expect(generateResponse.json().activeCase.accuser.name).not.toBe(
      generateResponse.json().activeCase.accused.name,
    );
    expect(generateResponse.json().activeCase.summary).toContain('Morro da Coroa');
    expect(generateResponse.json().activeCase.antigaoSuggestedPunishment).toBeTruthy();
    expect(generateResponse.json().activeCase.antigaoAdvice.communityRead).toBe(
      generateResponse.json().activeCase.communitySupports,
    );
    expect(generateResponse.json().activeCase.antigaoAdvice.truthRead).toBe(
      generateResponse.json().activeCase.truthRead,
    );
    expect(
      generateResponse
        .json()
        .activeCase.antigaoAdvice.punishmentInsights.find(
          (entry: { punishment: string; recommended: boolean }) => entry.recommended,
        )?.punishment,
    ).toBe(generateResponse.json().activeCase.antigaoSuggestedPunishment);

    const activeCaseId = generateResponse.json().activeCase.id as string;

    const secondGenerateResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/tribunal/favelas/favela-zona-norte/case',
    });

    expect(secondGenerateResponse.statusCode).toBe(200);
    expect(secondGenerateResponse.json().created).toBe(false);
    expect(secondGenerateResponse.json().activeCase.id).toBe(activeCaseId);

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/favelas/favela-zona-norte/case',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().activeCase.id).toBe(activeCaseId);
  });

  it('projects Antigao punishment insights from truth and community pressure', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'general');

    state.casesByFavelaId.set('favela-zona-norte', [
      {
        accusedCharismaCommunity: 61,
        accusedCharismaFaction: 28,
        accusedName: 'Juninho',
        accusedStatement: 'Juninho diz que nao roubou nada e que o acusador quer vinganca antiga.',
        accuserCharismaCommunity: 54,
        accuserCharismaFaction: 31,
        accuserName: 'Marlene',
        accuserStatement: 'Marlene jura que Juninho roubou a sacola do mercado dela.',
        antigaoHint: 'hint legado',
        antigaoSuggestedPunishment: 'surra',
        caseType: 'roubo_entre_moradores',
        communitySupports: 'accuser',
        conceitoImpact: null,
        createdAt: new Date('2026-03-11T12:30:00.000Z'),
        favelaId: 'favela-zona-norte',
        id: 'caseo-1',
        judgedAt: null,
        judgedBy: null,
        moralFacaoImpact: null,
        moralMoradoresImpact: null,
        punishmentChosen: null,
        truthSide: 'accused',
      },
    ]);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/favelas/favela-zona-norte/case',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().activeCase.truthRead).toBe('accused');
    expect(response.json().activeCase.antigaoAdvice.communityRead).toBe('accuser');
    expect(response.json().activeCase.antigaoAdvice.balanceWarning).toContain('rua');

    const avisoInsight = response
      .json()
      .activeCase.antigaoAdvice.punishmentInsights.find(
        (entry: { punishment: string }) => entry.punishment === 'aviso',
      );

    expect(avisoInsight).toMatchObject({
      faccaoImpact: -2,
      moradoresImpact: -5,
      punishment: 'aviso',
    });

    const recommendedInsight = response
      .json()
      .activeCase.antigaoAdvice.punishmentInsights.find(
        (entry: { recommended: boolean }) => entry.recommended,
      );

    expect(recommendedInsight?.punishment).toBe(response.json().activeCase.antigaoSuggestedPunishment);
    expect(recommendedInsight?.read).toBeTruthy();
    expect(recommendedInsight?.note).toContain('Moradores');
  });

  it('judges an open case, persists impacts and closes the tribunal entry', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'general');

    state.casesByFavelaId.set('favela-zona-norte', [
      {
        accusedCharismaCommunity: 31,
        accusedCharismaFaction: 25,
        accusedName: 'Perninha',
        accusedStatement: 'Perninha nega o abuso e diz que querem linchar sem prova.',
        accuserCharismaCommunity: 74,
        accuserCharismaFaction: 58,
        accuserName: 'Dona Cida',
        accuserStatement: 'Dona Cida cobra resposta dura da faccao.',
        antigaoHint: 'hint legado',
        antigaoSuggestedPunishment: 'matar',
        caseType: 'estupro',
        communitySupports: 'accuser',
        conceitoImpact: null,
        createdAt: new Date('2026-03-11T13:00:00.000Z'),
        favelaId: 'favela-zona-norte',
        id: 'caseo-2',
        judgedAt: null,
        judgedBy: null,
        moralFacaoImpact: null,
        moralMoradoresImpact: null,
        punishmentChosen: null,
        truthSide: 'accuser',
      },
    ]);

    const previousConceito = state.players.get(playerId)?.conceito ?? 0;
    const previousFactionSatisfaction = state.factions.get('faccao-amigos')?.internalSatisfaction ?? 0;
    const previousFavelaSatisfaction = state.favelas.get('favela-zona-norte')?.satisfaction ?? 0;

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        punishment: 'matar',
      },
      url: '/api/tribunal/favelas/favela-zona-norte/case/judgment',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().activeCase.punishmentChosen).toBe('matar');
    expect(response.json().activeCase.judgedAt).toBeTruthy();
    expect(response.json().activeCase.status).toBe('resolved_by_player');
    expect(response.json().activeCase.resolutionSource).toBe('player');
    expect(response.json().judgment.read).toBe('justa');
    expect(response.json().judgment.resolutionSource).toBe('player');
    expect(response.json().judgment.moradoresImpact).toBe(10);
    expect(response.json().judgment.faccaoImpact).toBe(5);
    expect(response.json().judgment.conceitoDelta).toBeGreaterThan(0);
    expect(response.json().judgment.favelaSatisfactionAfter).toBe(previousFavelaSatisfaction + 10);
    expect(response.json().judgment.factionInternalSatisfactionAfter).toBe(previousFactionSatisfaction + 5);
    expect(response.json().judgment.conceitoAfter).toBeGreaterThan(previousConceito);

    expect(state.favelas.get('favela-zona-norte')?.satisfaction).toBe(previousFavelaSatisfaction + 10);
    expect(state.factions.get('faccao-amigos')?.internalSatisfaction).toBe(previousFactionSatisfaction + 5);
    expect(state.players.get(playerId)?.conceito).toBe(response.json().judgment.conceitoAfter);

    const centerResponse = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/favelas/favela-zona-norte/case',
    });

    expect(centerResponse.statusCode).toBe(200);
    expect(centerResponse.json().activeCase).toBeNull();
    expect(centerResponse.json().latestResolvedCase.status).toBe('resolved_by_player');
    expect(centerResponse.json().latestResolvedOutcome.resolutionSource).toBe('player');
  });

  it('applies political university bonuses to faction and community tribunal impacts', async () => {
    await app.server.close();
    app = await buildTestApp({
      randomSequence: [0.2, 0.4, 0.6],
      state,
      universityReader: {
        async getActiveCourse() {
          return null;
        },
        async getPassiveProfile() {
          return {
            ...UNIVERSITY_EMPTY_PASSIVE_PROFILE,
            faction: {
              ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.faction,
              factionCharismaAura: 0.05,
            },
            social: {
              ...UNIVERSITY_EMPTY_PASSIVE_PROFILE.social,
              communityInfluenceMultiplier: 1.25,
            },
          };
        },
      },
    });

    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'general');

    state.casesByFavelaId.set('favela-zona-norte', [
      {
        accusedCharismaCommunity: 40,
        accusedCharismaFaction: 42,
        accusedName: 'Buiu',
        accusedStatement: 'Buiu insiste que pagaria a carga depois do baile.',
        accuserCharismaCommunity: 63,
        accuserCharismaFaction: 68,
        accuserName: 'Jana',
        accuserStatement: 'Jana diz que Buiu comeu a carga e peitou a cobrança.',
        antigaoHint: 'hint legado',
        antigaoSuggestedPunishment: 'matar',
        caseType: 'divida_drogas',
        communitySupports: 'accuser',
        conceitoImpact: null,
        createdAt: new Date('2026-03-11T13:00:00.000Z'),
        favelaId: 'favela-zona-norte',
        id: 'caseo-politico',
        judgedAt: null,
        judgedBy: null,
        moralFacaoImpact: null,
        moralMoradoresImpact: null,
        punishmentChosen: null,
        truthSide: 'accuser',
      },
    ]);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      payload: {
        punishment: 'matar',
      },
      url: '/api/tribunal/favelas/favela-zona-norte/case/judgment',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().judgment).toMatchObject({
      faccaoImpact: 11,
      moradoresImpact: -6,
    });
    expect(state.factions.get('faccao-amigos')?.internalSatisfaction).toBe(65);
    expect(state.favelas.get('favela-zona-norte')?.satisfaction).toBe(32);
  });

  it('opens tribunal cues automatically for leadership and returns the pending case', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'patrao');

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/cues',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().cues).toHaveLength(1);
    expect(response.json().cues[0]).toMatchObject({
      kind: 'opened',
      title: 'Tribunal aberto · Morro da Coroa',
    });
    expect(response.json().cues[0].case.status).toBe('open');
    expect(response.json().cues[0].case.decisionDeadlineAt).toBeTruthy();
  });

  it('auto resolves an expired tribunal by NPC with the worst punishment for moradores', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'general');

    state.casesByFavelaId.set('favela-zona-norte', [
      {
        accusedCharismaCommunity: 44,
        accusedCharismaFaction: 37,
        accusedName: 'Buiu',
        accusedStatement: 'Buiu fala que a divida virou teatro para tomar a casa dele.',
        accuserCharismaCommunity: 52,
        accuserCharismaFaction: 61,
        accuserName: 'Rosana',
        accuserStatement: 'Rosana diz que Buiu sumiu com o dinheiro e debochou da cobrança.',
        antigaoHint: 'hint legado',
        antigaoSuggestedPunishment: 'surra',
        caseType: 'divida_jogo',
        communitySupports: 'accused',
        conceitoImpact: null,
        createdAt: new Date('2026-03-11T11:30:00.000Z'),
        favelaId: 'favela-zona-norte',
        id: 'caseo-expirado',
        judgedAt: null,
        judgedBy: null,
        moralFacaoImpact: null,
        moralMoradoresImpact: null,
        punishmentChosen: null,
        truthSide: 'accuser',
      },
    ]);

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/cues',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().cues).toHaveLength(2);
    expect(response.json().cues[0].kind).toBe('opened');
    expect(response.json().cues[1]).toMatchObject({
      kind: 'resolved',
      outcome: {
        conceitoDelta: 0,
        punishmentChosen: 'queimar_no_pneu',
        resolutionSource: 'npc',
      },
    });

    const latestCase = state.casesByFavelaId.get('favela-zona-norte')?.[0];
    expect(latestCase?.judgedAt).toBeTruthy();
    expect(latestCase?.judgedBy).toBeNull();
    expect(latestCase?.punishmentChosen).toBe('queimar_no_pneu');
  });

  it('returns an empty tribunal cue feed for faction members without leadership rank', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'soldado');

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/cues',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().cues).toEqual([]);
  });

  it('blocks access when the faction rank is below general', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'gerente');

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'POST',
      url: '/api/tribunal/favelas/favela-zona-norte/case',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('Patrao ou General');
  });

  it('blocks access to a favela not controlled by the player faction', async () => {
    const accessToken = await registerAndExtractToken(app.server);
    const playerId = getOnlyPlayerId(state);
    attachMembership(state, playerId, 'faccao-amigos', 'patrao');

    const response = await app.server.inject({
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      method: 'GET',
      url: '/api/tribunal/favelas/favela-rival/case',
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toContain('favela dominada');
  });
});

async function buildTestApp(input: {
  now?: () => Date;
  randomSequence: number[];
  state: TestState;
  universityReader?: ConstructorParameters<typeof TribunalService>[0]['universityReader'];
}) {
  const server = Fastify();
  const repository = new InMemoryAuthTribunalRepository(input.state);
  const keyValueStore = new InMemoryKeyValueStore();
  const authService = new AuthService({
    keyValueStore,
    repository,
  });
  const tribunalService = new TribunalService({
    now: input.now ?? (() => new Date('2026-03-11T14:00:00.000Z')),
    random: createRandomSequence(input.randomSequence),
    repository,
    universityReader: input.universityReader,
  });

  await server.register(async (api) => {
    await api.register(createAuthRoutes({ authService }), {
      prefix: '/api',
    });

    await api.register(async (protectedRoutes) => {
      protectedRoutes.addHook('preHandler', createAuthMiddleware(authService));
      await protectedRoutes.register(createTribunalRoutes({ tribunalService }), {
        prefix: '/api',
      });
    });
  });

  await server.ready();

  return {
    keyValueStore,
    server,
  };
}

function attachMembership(
  state: TestState,
  playerId: string,
  factionId: string,
  rank: 'cria' | 'general' | 'gerente' | 'patrao' | 'soldado' | 'vapor',
) {
  const player = state.players.get(playerId);

  if (!player) {
    throw new Error('Player nao encontrado para anexar faccao.');
  }

  player.factionId = factionId;
  state.membershipsByPlayerId.set(playerId, {
    factionId,
    rank,
  });
}

function createRandomSequence(values: number[]) {
  let index = 0;

  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0.5;
    index += 1;
    return value;
  };
}

function getOnlyPlayerId(state: TestState) {
  const playerId = Array.from(state.players.keys())[0];

  if (!playerId) {
    throw new Error('Nenhum player criado no teste.');
  }

  return playerId;
}

async function registerAndExtractToken(server: Awaited<ReturnType<typeof Fastify>>) {
  const response = await server.inject({
    method: 'POST',
    payload: {
      email: `player-${randomUUID()}@csrio.test`,
      nickname: `player_${Math.floor(Math.random() * 100000)}`,
      password: '12345678',
    },
    url: '/api/auth/register',
  });

  expect(response.statusCode).toBe(201);
  return response.json().accessToken as string;
}
