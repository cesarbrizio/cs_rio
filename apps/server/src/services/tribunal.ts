import type { FactionRank, PlayerSummary, RegionId } from '@cs-rio/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { factionMembers, factions, favelas, players, tribunalCases } from '../db/schema.js';
import { LevelSystem } from '../systems/LevelSystem.js';
import {
  AuthError,
  RedisKeyValueStore,
  type AuthPlayerRecord,
  type KeyValueStore,
  toPlayerSummary,
} from './auth.js';
import { buildPlayerProfileCacheKey } from './player.js';

interface TribunalCaseRecord {
  accusedCharismaCommunity: number;
  accusedCharismaFaction: number;
  accusedName: string;
  accusedStatement: string;
  accuserCharismaCommunity: number;
  accuserCharismaFaction: number;
  accuserName: string;
  accuserStatement: string;
  antigaoHint: string;
  antigaoSuggestedPunishment: TribunalPunishment;
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  createdAt: Date;
  favelaId: string;
  id: string;
  judgedAt: Date | null;
  punishmentChosen: TribunalPunishment | null;
  truthSide: TribunalCaseSide;
}

interface TribunalFavelaRecord {
  controllingFactionId: string | null;
  id: string;
  name: string;
  population: number;
  regionId: RegionId;
  satisfaction: number;
  state: 'at_war' | 'controlled' | 'neutral' | 'state';
}

type TribunalCaseType =
  | 'roubo_entre_moradores'
  | 'talaricagem'
  | 'divida_jogo'
  | 'divida_drogas'
  | 'estupro'
  | 'agressao'
  | 'homicidio_nao_autorizado';

type TribunalCaseSide = 'accuser' | 'accused';

type TribunalPunishment =
  | 'aviso'
  | 'surra'
  | 'expulsao'
  | 'matar'
  | 'esquartejar'
  | 'queimar_no_pneu';

interface TribunalJudgmentInput {
  punishment: TribunalPunishment;
}

type TribunalJudgmentRead =
  | 'arriscada'
  | 'brutal_desnecessaria'
  | 'covarde'
  | 'injusta'
  | 'justa';

type TribunalCaseSeverity = 'baixa_media' | 'media' | 'media_alta' | 'muito_alta';

interface TribunalCaseDefinitionSummary {
  allowedPunishments: TribunalPunishment[];
  label: string;
  severity: TribunalCaseSeverity;
  type: TribunalCaseType;
}

interface TribunalCaseParticipantSummary {
  charismaCommunity: number;
  charismaFaction: number;
  name: string;
  statement: string;
}

interface TribunalFavelaSummary {
  id: string;
  name: string;
  regionId: RegionId;
}

interface TribunalFactionRecord {
  id: string;
  internalSatisfaction: number;
}

interface TribunalCaseSummary {
  accused: TribunalCaseParticipantSummary;
  accuser: TribunalCaseParticipantSummary;
  antigaoAdvice: TribunalAntigaoAdviceSummary;
  antigaoHint: string;
  antigaoSuggestedPunishment: TribunalPunishment;
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  createdAt: string;
  definition: TribunalCaseDefinitionSummary;
  favelaId: string;
  id: string;
  judgedAt: string | null;
  punishmentChosen: TribunalPunishment | null;
  summary: string;
  truthRead: TribunalCaseSide;
}

type TribunalPunishmentRead =
  | 'brutal'
  | 'condena_inocente'
  | 'dureza_arriscada'
  | 'leve_demais'
  | 'proporcional'
  | 'prudente';

interface TribunalPunishmentInsightSummary {
  faccaoImpact: number;
  moradoresImpact: number;
  note: string;
  punishment: TribunalPunishment;
  read: TribunalPunishmentRead;
  recommended: boolean;
}

interface TribunalAntigaoAdviceSummary {
  balanceWarning: string;
  communityRead: TribunalCaseSide;
  punishmentInsights: TribunalPunishmentInsightSummary[];
  truthRead: TribunalCaseSide;
}

interface TribunalAntigaoAdviceProfile extends TribunalAntigaoAdviceSummary {
  hint: string;
  suggestedPunishment: TribunalPunishment;
}

interface TribunalCenterResponse {
  activeCase: TribunalCaseSummary | null;
  favela: TribunalFavelaSummary;
  player: PlayerSummary;
}

interface TribunalCaseGenerateResponse extends TribunalCenterResponse {
  created: boolean;
}

interface TribunalJudgmentSummary {
  conceitoAfter: number;
  conceitoDelta: number;
  faccaoImpact: number;
  factionInternalSatisfactionAfter: number;
  factionInternalSatisfactionDelta: number;
  favelaSatisfactionAfter: number;
  favelaSatisfactionDelta: number;
  moradoresImpact: number;
  punishmentChosen: TribunalPunishment;
  read: TribunalJudgmentRead;
  summary: string;
}

interface TribunalJudgmentResponse extends TribunalCenterResponse {
  activeCase: TribunalCaseSummary;
  judgment: TribunalJudgmentSummary;
}

const TRIBUNAL_CASE_DEFINITIONS: TribunalCaseDefinitionSummary[] = [
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Roubo entre moradores',
    severity: 'media',
    type: 'roubo_entre_moradores',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Talaricagem',
    severity: 'media',
    type: 'talaricagem',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Divida de jogo',
    severity: 'baixa_media',
    type: 'divida_jogo',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Divida de drogas',
    severity: 'media_alta',
    type: 'divida_drogas',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Estupro',
    severity: 'muito_alta',
    type: 'estupro',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Agressao',
    severity: 'media',
    type: 'agressao',
  },
  {
    allowedPunishments: ['aviso', 'surra', 'expulsao', 'matar', 'esquartejar', 'queimar_no_pneu'],
    label: 'Homicidio nao autorizado',
    severity: 'muito_alta',
    type: 'homicidio_nao_autorizado',
  },
];

interface TribunalImpactProfile {
  faccao: number;
  moradores: number;
}

type TribunalImpactBySupportedSide = Record<TribunalCaseSide, TribunalImpactProfile>;
type TribunalImpactMatrix = Record<TribunalPunishment, TribunalImpactBySupportedSide>;

const PUNISHMENT_SEVERITY_SCORE: Record<TribunalPunishment, number> = {
  aviso: 0,
  expulsao: 2,
  esquartejar: 4,
  matar: 3,
  queimar_no_pneu: 5,
  surra: 1,
};

const TRIBUNAL_TRUTH_TARGETS: Record<
  TribunalCaseType,
  { guilty: readonly [number, number]; innocent: readonly [number, number] }
> = {
  agressao: {
    guilty: [1, 2],
    innocent: [0, 1],
  },
  divida_drogas: {
    guilty: [1, 2],
    innocent: [0, 1],
  },
  divida_jogo: {
    guilty: [0, 1],
    innocent: [0, 0],
  },
  estupro: {
    guilty: [3, 5],
    innocent: [0, 1],
  },
  homicidio_nao_autorizado: {
    guilty: [3, 4],
    innocent: [1, 2],
  },
  roubo_entre_moradores: {
    guilty: [1, 2],
    innocent: [0, 1],
  },
  talaricagem: {
    guilty: [1, 2],
    innocent: [0, 1],
  },
};

const TRIBUNAL_IMPACT_TABLE: Record<TribunalCaseType, TribunalImpactMatrix> = {
  agressao: {
    aviso: {
      accused: { faccao: -3, moradores: 2 },
      accuser: { faccao: -3, moradores: -5 },
    },
    expulsao: {
      accused: { faccao: 2, moradores: -5 },
      accuser: { faccao: 2, moradores: 5 },
    },
    esquartejar: {
      accused: { faccao: 2, moradores: -25 },
      accuser: { faccao: 5, moradores: -18 },
    },
    matar: {
      accused: { faccao: 3, moradores: -15 },
      accuser: { faccao: 5, moradores: -8 },
    },
    queimar_no_pneu: {
      accused: { faccao: 0, moradores: -30 },
      accuser: { faccao: 3, moradores: -22 },
    },
    surra: {
      accused: { faccao: 2, moradores: -3 },
      accuser: { faccao: 2, moradores: 3 },
    },
  },
  divida_drogas: {
    aviso: {
      accused: { faccao: -15, moradores: 3 },
      accuser: { faccao: -10, moradores: 0 },
    },
    expulsao: {
      accused: { faccao: 5, moradores: -8 },
      accuser: { faccao: 5, moradores: -3 },
    },
    esquartejar: {
      accused: { faccao: 5, moradores: -25 },
      accuser: { faccao: 10, moradores: -15 },
    },
    matar: {
      accused: { faccao: 8, moradores: -15 },
      accuser: { faccao: 10, moradores: -8 },
    },
    queimar_no_pneu: {
      accused: { faccao: 3, moradores: -30 },
      accuser: { faccao: 8, moradores: -20 },
    },
    surra: {
      accused: { faccao: 5, moradores: -5 },
      accuser: { faccao: 5, moradores: -2 },
    },
  },
  divida_jogo: {
    aviso: {
      accused: { faccao: -5, moradores: 2 },
      accuser: { faccao: -3, moradores: -3 },
    },
    expulsao: {
      accused: { faccao: 3, moradores: -5 },
      accuser: { faccao: 3, moradores: 3 },
    },
    esquartejar: {
      accused: { faccao: 0, moradores: -30 },
      accuser: { faccao: 3, moradores: -20 },
    },
    matar: {
      accused: { faccao: 2, moradores: -20 },
      accuser: { faccao: 3, moradores: -10 },
    },
    queimar_no_pneu: {
      accused: { faccao: -2, moradores: -35 },
      accuser: { faccao: 0, moradores: -25 },
    },
    surra: {
      accused: { faccao: 3, moradores: -2 },
      accuser: { faccao: 2, moradores: 2 },
    },
  },
  estupro: {
    aviso: {
      accused: { faccao: -10, moradores: 5 },
      accuser: { faccao: -15, moradores: -25 },
    },
    expulsao: {
      accused: { faccao: 2, moradores: -5 },
      accuser: { faccao: 0, moradores: 5 },
    },
    esquartejar: {
      accused: { faccao: 5, moradores: -15 },
      accuser: { faccao: 5, moradores: 8 },
    },
    matar: {
      accused: { faccao: 5, moradores: -10 },
      accuser: { faccao: 5, moradores: 10 },
    },
    queimar_no_pneu: {
      accused: { faccao: 3, moradores: -20 },
      accuser: { faccao: 3, moradores: 10 },
    },
    surra: {
      accused: { faccao: 0, moradores: -3 },
      accuser: { faccao: -5, moradores: -10 },
    },
  },
  homicidio_nao_autorizado: {
    aviso: {
      accused: { faccao: -20, moradores: 3 },
      accuser: { faccao: -15, moradores: -20 },
    },
    expulsao: {
      accused: { faccao: 0, moradores: -5 },
      accuser: { faccao: 0, moradores: 3 },
    },
    esquartejar: {
      accused: { faccao: 8, moradores: -10 },
      accuser: { faccao: 10, moradores: 5 },
    },
    matar: {
      accused: { faccao: 5, moradores: -5 },
      accuser: { faccao: 8, moradores: 8 },
    },
    queimar_no_pneu: {
      accused: { faccao: 5, moradores: -15 },
      accuser: { faccao: 10, moradores: 3 },
    },
    surra: {
      accused: { faccao: -3, moradores: -2 },
      accuser: { faccao: -5, moradores: -5 },
    },
  },
  roubo_entre_moradores: {
    aviso: {
      accused: { faccao: -5, moradores: 2 },
      accuser: { faccao: -2, moradores: -5 },
    },
    expulsao: {
      accused: { faccao: 3, moradores: -8 },
      accuser: { faccao: 2, moradores: 5 },
    },
    esquartejar: {
      accused: { faccao: 3, moradores: -25 },
      accuser: { faccao: 5, moradores: -15 },
    },
    matar: {
      accused: { faccao: 5, moradores: -15 },
      accuser: { faccao: 5, moradores: -5 },
    },
    queimar_no_pneu: {
      accused: { faccao: 2, moradores: -30 },
      accuser: { faccao: 3, moradores: -20 },
    },
    surra: {
      accused: { faccao: 2, moradores: -3 },
      accuser: { faccao: 0, moradores: 3 },
    },
  },
  talaricagem: {
    aviso: {
      accused: { faccao: -3, moradores: 3 },
      accuser: { faccao: -5, moradores: -8 },
    },
    expulsao: {
      accused: { faccao: 3, moradores: -5 },
      accuser: { faccao: 3, moradores: 8 },
    },
    esquartejar: {
      accused: { faccao: 2, moradores: -30 },
      accuser: { faccao: 5, moradores: -15 },
    },
    matar: {
      accused: { faccao: 3, moradores: -20 },
      accuser: { faccao: 5, moradores: -3 },
    },
    queimar_no_pneu: {
      accused: { faccao: 0, moradores: -35 },
      accuser: { faccao: 3, moradores: -20 },
    },
    surra: {
      accused: { faccao: 2, moradores: -5 },
      accuser: { faccao: 2, moradores: 5 },
    },
  },
};

interface TribunalFactionMembershipRecord {
  factionId: string;
  rank: FactionRank;
}

export interface TribunalRepository {
  applyJudgment(input: TribunalApplyJudgmentInput): Promise<TribunalApplyJudgmentResult | null>;
  createCase(input: TribunalCaseCreateInput): Promise<TribunalCaseRecord | null>;
  getFaction(factionId: string): Promise<TribunalFactionRecord | null>;
  getFavela(favelaId: string): Promise<TribunalFavelaRecord | null>;
  getOpenCase(favelaId: string): Promise<TribunalCaseRecord | null>;
  getPlayer(playerId: string): Promise<AuthPlayerRecord | null>;
  getPlayerFactionMembership(playerId: string): Promise<TribunalFactionMembershipRecord | null>;
}

export interface TribunalServiceOptions {
  keyValueStore?: KeyValueStore;
  levelSystem?: LevelSystem;
  now?: () => Date;
  random?: () => number;
  repository?: TribunalRepository;
}

export interface TribunalServiceContract {
  close?(): Promise<void>;
  getTribunalCenter(playerId: string, favelaId: string): Promise<TribunalCenterResponse>;
  generateCase(playerId: string, favelaId: string): Promise<TribunalCaseGenerateResponse>;
  judgeCase(playerId: string, favelaId: string, input: TribunalJudgmentInput): Promise<TribunalJudgmentResponse>;
}

interface TribunalCaseCreateInput {
  accusedCharismaCommunity: number;
  accusedCharismaFaction: number;
  accusedName: string;
  accusedStatement: string;
  accuserCharismaCommunity: number;
  accuserCharismaFaction: number;
  accuserName: string;
  accuserStatement: string;
  antigaoHint: string;
  antigaoSuggestedPunishment: TribunalPunishment;
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  createdAt: Date;
  favelaId: string;
  truthSide: TribunalCaseSide;
}

interface GeneratedTribunalCase {
  accusedCharismaCommunity: number;
  accusedCharismaFaction: number;
  accusedName: string;
  accusedStatement: string;
  accuserCharismaCommunity: number;
  accuserCharismaFaction: number;
  accuserName: string;
  accuserStatement: string;
  antigaoHint: string;
  antigaoSuggestedPunishment: TribunalPunishment;
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  truthSide: TribunalCaseSide;
}

interface TribunalApplyJudgmentInput {
  caseId: string;
  conceitoAfter: number;
  conceitoImpact: number;
  factionId: string;
  factionInternalSatisfactionAfter: number;
  judgedAt: Date;
  judgedBy: string;
  moralFacaoImpact: number;
  moralMoradoresImpact: number;
  playerId: string;
  playerLevelAfter: number;
  punishmentChosen: TribunalPunishment;
  satisfactionAfter: number;
}

interface TribunalApplyJudgmentResult {
  caseRecord: TribunalCaseRecord;
  factionInternalSatisfactionAfter: number;
  playerRecord: AuthPlayerRecord;
  satisfactionAfter: number;
}

type TribunalErrorCode = 'character_not_ready' | 'forbidden' | 'not_found' | 'validation';

export class TribunalError extends Error {
  constructor(
    public readonly code: TribunalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TribunalError';
  }
}

export class DatabaseTribunalRepository implements TribunalRepository {
  async applyJudgment(input: TribunalApplyJudgmentInput): Promise<TribunalApplyJudgmentResult | null> {
    return db.transaction(async (tx) => {
      const [caseRecord] = await tx
        .select()
        .from(tribunalCases)
        .where(and(eq(tribunalCases.id, input.caseId), isNull(tribunalCases.judgedAt)))
        .limit(1);

      if (!caseRecord) {
        return null;
      }

      const [updatedPlayer] = await tx
        .update(players)
        .set({
          conceito: input.conceitoAfter,
          level: input.playerLevelAfter,
        })
        .where(eq(players.id, input.playerId))
        .returning();

      if (!updatedPlayer) {
        return null;
      }

      const [updatedFaction] = await tx
        .update(factions)
        .set({
          internalSatisfaction: input.factionInternalSatisfactionAfter,
        })
        .where(eq(factions.id, input.factionId))
        .returning({
          id: factions.id,
          internalSatisfaction: factions.internalSatisfaction,
        });

      if (!updatedFaction) {
        return null;
      }

      await tx
        .update(favelas)
        .set({
          satisfaction: input.satisfactionAfter,
          satisfactionSyncedAt: input.judgedAt,
        })
        .where(eq(favelas.id, caseRecord.favelaId));

      const [updatedCase] = await tx
        .update(tribunalCases)
        .set({
          conceitoImpact: input.conceitoImpact,
          judgedAt: input.judgedAt,
          judgedBy: input.judgedBy,
          moralFacaoImpact: input.moralFacaoImpact,
          moralMoradoresImpact: input.moralMoradoresImpact,
          punishmentChosen: input.punishmentChosen,
        })
        .where(eq(tribunalCases.id, input.caseId))
        .returning();

      if (!updatedCase) {
        return null;
      }

      return {
        caseRecord: updatedCase,
        factionInternalSatisfactionAfter: updatedFaction.internalSatisfaction,
        playerRecord: updatedPlayer,
        satisfactionAfter: input.satisfactionAfter,
      };
    });
  }

  async createCase(input: TribunalCaseCreateInput): Promise<TribunalCaseRecord | null> {
    const [createdCase] = await db
      .insert(tribunalCases)
      .values({
        accusedCharismaCommunity: input.accusedCharismaCommunity,
        accusedCharismaFaction: input.accusedCharismaFaction,
        accusedName: input.accusedName,
        accusedStatement: input.accusedStatement,
        accuserCharismaCommunity: input.accuserCharismaCommunity,
        accuserCharismaFaction: input.accuserCharismaFaction,
        accuserName: input.accuserName,
        accuserStatement: input.accuserStatement,
        antigaoHint: input.antigaoHint,
        antigaoSuggestedPunishment: input.antigaoSuggestedPunishment,
        caseType: input.caseType,
        communitySupports: input.communitySupports,
        createdAt: input.createdAt,
        favelaId: input.favelaId,
        truthSide: input.truthSide,
      })
      .returning();

    return createdCase ?? null;
  }

  async getFaction(factionId: string): Promise<TribunalFactionRecord | null> {
    const [faction] = await db
      .select({
        id: factions.id,
        internalSatisfaction: factions.internalSatisfaction,
      })
      .from(factions)
      .where(eq(factions.id, factionId))
      .limit(1);

    return faction ?? null;
  }

  async getFavela(favelaId: string): Promise<TribunalFavelaRecord | null> {
    const [favela] = await db.select().from(favelas).where(eq(favelas.id, favelaId)).limit(1);
    return favela
      ? {
          controllingFactionId: favela.controllingFactionId,
          id: favela.id,
          name: favela.name,
          population: favela.population,
          regionId: favela.regionId as RegionId,
          satisfaction: favela.satisfaction,
          state: favela.state,
        }
      : null;
  }

  async getOpenCase(favelaId: string): Promise<TribunalCaseRecord | null> {
    const [caseRecord] = await db
      .select()
      .from(tribunalCases)
      .where(and(eq(tribunalCases.favelaId, favelaId), isNull(tribunalCases.judgedAt)))
      .orderBy(desc(tribunalCases.createdAt))
      .limit(1);

    return caseRecord ?? null;
  }

  async getPlayer(playerId: string): Promise<AuthPlayerRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    return player ?? null;
  }

  async getPlayerFactionMembership(playerId: string): Promise<TribunalFactionMembershipRecord | null> {
    const [membership] = await db
      .select({
        factionId: factionMembers.factionId,
        rank: factionMembers.rank,
      })
      .from(factionMembers)
      .where(eq(factionMembers.playerId, playerId))
      .orderBy(desc(factionMembers.joinedAt))
      .limit(1);

    return membership
      ? {
          factionId: membership.factionId,
          rank: membership.rank as FactionRank,
        }
      : null;
  }
}

const ALLOWED_TRIBUNAL_RANKS = new Set<FactionRank>(['patrao', 'general']);
const TRIBUNAL_NAME_BANK = [
  'Marreta',
  'Tainha',
  'Nego Leo',
  'Juninho',
  'Perninha',
  'Cintia',
  'Marlene',
  'Bebeto',
  'Rosana',
  'Moleque Davi',
  'Pezinho',
  'Dona Cida',
  'Buiu',
  'Tati',
  'Leleco',
  'Boca de Ouro',
  'Suelen',
  'Nandinho',
  'Magrinho',
  'Dudu',
];

const ROUBO_ITEMS = ['o botijao', 'o celular', 'a bicicleta', 'a sacola do mercado', 'o dinheiro do aluguel'];
const TALARICO_RELATIONS = ['esposa', 'companheira', 'marido', 'namorada', 'namorado'];
const JOGO_LOCATIONS = ['na banca do bicho', 'no bar da subida', 'na mesa do domino', 'na sinuca da laje'];
const DRUG_PACKAGES = ['duas cargas de po', 'um pacote de bala', 'uma remessa de maconha', 'uma carga de crack'];
const AGGRESSION_REASONS = ['na fila da van', 'por causa de som alto', 'na porta do baile', 'por disputa de vaga'];
const HOMICIDE_MOTIVES = ['numa discussao por territorio interno', 'num acerto de contas pessoal', 'numa briga de bar', 'durante um churrasco que virou confusao'];

interface TribunalStoryTemplateContext {
  accusedName: string;
  accuserName: string;
  favelaName: string;
  random: () => number;
}

interface TribunalStoryTemplate {
  accusedStatement: (context: TribunalStoryTemplateContext) => string;
  accuserStatement: (context: TribunalStoryTemplateContext) => string;
}

const TRIBUNAL_STORY_TEMPLATES: Record<TribunalCaseType, TribunalStoryTemplate[]> = {
  agressao: [
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} diz que ${accusedName} partiu para cima dele ${pickOne(AGGRESSION_REASONS, random)} e deixou todo mundo correndo.`,
      accusedStatement: ({ accuserName, accusedName }) =>
        `${accusedName} diz que so reagiu porque ${accuserName} veio na provocacao e jura que a historia esta sendo aumentada.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} afirma que ${accusedName} agrediu ele no meio da rua principal de ${favelaName} e humilhou a familia toda.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que perdeu a cabeca no calor do momento, mas insiste que nao queria machucar desse jeito.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} conta que ${accusedName} meteu a mao nele na frente de crianca e comerciante, fazendo a rua cobrar exemplo.`,
      accusedStatement: ({ accuserName, accusedName }) =>
        `${accusedName} diz que ${accuserName} veio primeiro e que so respondeu para nao ficar desacreditado na area.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} fala que ${accusedName} perdeu a linha ${pickOne(AGGRESSION_REASONS, random)} e jurou voltar armado se ninguem segurasse.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} admite que bateu boca pesado, mas jura que a agressao virou historia maior do que realmente foi.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} acusa ${accusedName} de espalhar terror em ${favelaName} depois de uma discussao que podia ter morrido na palavra.`,
      accusedStatement: ({ accuserName, accusedName }) =>
        `${accusedName} diz que ${accuserName} juntou gente contra ele e agora quer usar o tribunal para terminar a covardia no grito.`,
    },
  ],
  divida_drogas: [
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} cobra ${accusedName} por ${pickOne(DRUG_PACKAGES, random)} pego fiado e diz que ja venceu mais de uma vez.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} pede prazo, fala que a familia apertou e promete quitar tudo se nao for esmagado agora.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} diz que ${accusedName} sumiu depois de pegar mercadoria da faccao e agora reapareceu querendo conversa.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} jura que nao fugiu, so nao tinha como pagar e esta tentando segurar a bronca sem tomar sumico.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName, random }) =>
        `${accuserName} diz que entregou ${pickOne(DRUG_PACKAGES, random)} para ${accusedName} em ${favelaName} e recebeu promessas vazias em troca.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que a conta cresceu mais do que devia e que so quer conferir a carga antes de ser tratado como traidor.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} acusa ${accusedName} de vender parte da carga, embolsar o dinheiro e depois fingir que foi roubado na rua.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} responde que levou prejuizo no corre, nao lucrou nada e que a faccao esta ouvindo so um lado da historia.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} diz que segurou a cobranca por respeito, mas ${accusedName} continuou circulando sem acertar a divida da droga.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} admite o debito, pede um ultimo prazo e diz que apertar demais agora so vai empurrar ele para o sumico.`,
    },
  ],
  divida_jogo: [
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} diz que ${accusedName} perdeu dinheiro ${pickOne(JOGO_LOCATIONS, random)} e agora se recusa a honrar a palavra.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que a conta foi inflada no grito e que nao reconhece esse valor todo como justo.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} afirma que bancou varias apostas para ${accusedName} e agora quer receber antes que a historia vire exemplo.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} diz que caiu em pilha errada, perdeu tudo e so quer negociar um prazo sem apanhar na frente de todo mundo.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} fala que ${accusedName} apostou alto ${pickOne(JOGO_LOCATIONS, random)}, perdeu feio e desapareceu no momento de fechar a conta.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} responde que o jogo virou bagunca, teve valor inventado na mesa e ele nao vai aceitar cobranca montada no susto.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} diz que ${accusedName} queimou o nome dele em ${favelaName} ao perder aposta e tentar empurrar a culpa em terceiros.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que foi pressionado, assinou valor sem pensar e agora esta sendo cobrado alem do combinado.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} diz que ${accusedName} pediu moral para continuar jogando, tomou o dinheiro e depois desacatou quem veio cobrar.`,
      accusedStatement: ({ accuserName, accusedName }) =>
        `${accusedName} jura que ${accuserName} esta usando o tribunal para multiplicar uma divida que originalmente era bem menor.`,
    },
  ],
  estupro: [
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} acusa ${accusedName} de ter violentado uma moradora e diz que a comunidade inteira esta olhando para o tribunal.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} nega tudo, diz que a denuncia esta armada e pede para a faccao nao selar a cova dele sem ouvir direito.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} diz que ${accusedName} atacou uma moradora na parte alta de ${favelaName} e que pegar leve vai incendiar a favela.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} insiste que nao encostou na vitima e fala que estao tentando jogar nele uma monstruosidade para acertar conta antiga.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} fala que a vitima foi escutada, reconheceu ${accusedName} e que a faccao vai perder a rua se tratar isso como duvida qualquer.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} pede para nao ser enterrado por rumor, diz que esta sendo marcado como monstro sem prova reta na mao.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} afirma que o nome de ${accusedName} correu por ${favelaName} depois da denuncia e que todo mundo espera uma resposta sem vacilo.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} sustenta que nao cometeu esse crime e que alguem esta usando a dor da vitima para empurrar uma vinganca.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} cobra justica imediata e diz que aliviar ${accusedName} vai fazer os moradores desacreditarem da lei da favela.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que esta sendo apontado porque era desafeto antigo e implora para o tribunal nao decidir no impulso da revolta.`,
    },
  ],
  homicidio_nao_autorizado: [
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} conta que ${accusedName} matou um morador ${pickOne(HOMICIDE_MOTIVES, random)} sem palavra da faccao.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} diz que foi defesa propria e que se nao puxasse primeiro, era ele que ia ser carregado no saco.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} afirma que ${accusedName} derramou sangue em ${favelaName} sem autorizacao e colocou a comunidade em risco.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} jura que nao planejou a morte e que a situacao saiu do controle depois de uma provocacao armada.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} diz que ${accusedName} fez justica com as proprias maos e deixou a faccao com a conta politica da morte.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} responde que a vitima ja vinha jurada, sacou primeiro e nao deu espaco para pedir permissao a ninguem.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} fala que ${accusedName} executou um homem ${pickOne(HOMICIDE_MOTIVES, random)} e depois tentou vender a ideia de acidente.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} diz que houve confusao, tiro trocado e que agora estao resumindo tudo como se fosse execucao fria.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName }) =>
        `${accuserName} acusa ${accusedName} de agir sem palavra da hierarquia e jogar calor desnecessario sobre ${favelaName}.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} diz que o homem morto ia virar problema maior e que resolveu na hora para nao deixar a area sangrar mais depois.`,
    },
  ],
  roubo_entre_moradores: [
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} acusa ${accusedName} de levar ${pickOne(ROUBO_ITEMS, random)} de dentro da propria favela e sumir na noite.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que so pegou o que era dele por direito e que o resto e teatro para levantar o povo contra ele.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} diz que ${accusedName} meteu a mao nos pertences dele e ainda tentou vender tudo na correria da comunidade.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} nega o furto e acusa o outro lado de querer jogar a favela inteira contra ele por raiva antiga.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName, random }) =>
        `${accuserName} fala que ${accusedName} roubou ${pickOne(ROUBO_ITEMS, random)} e que em ${favelaName} isso e visto como cortar a propria carne.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} diz que pegou o objeto para cobrar uma pendencia antiga e que chamarem de roubo e parte do teatro.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} jura que viu ${accusedName} saindo com o material escondido e que a vergonha caiu em cima da familia inteira.`,
      accusedStatement: ({ accuserName, accusedName }) =>
        `${accusedName} rebate dizendo que ${accuserName} quer aproveitar a fama ruim dele para fechar uma conta velha no tribunal.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} diz que confiava em ${accusedName} ate descobrir o sumico de ${pickOne(ROUBO_ITEMS, random)} e ouvir que ele correu para vender.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} responde que nunca vendeu nada e que esta sendo apontado porque era o alvo mais facil para a rua culpar.`,
    },
  ],
  talaricagem: [
    {
      accuserStatement: ({ accuserName, accusedName, random }) =>
        `${accuserName} jura que ${accusedName} se envolveu com a ${pickOne(TALARICO_RELATIONS, random)} dele e que a humilhacao correu a favela toda.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que o relacionamento ja estava quebrado e que agora querem transformar fofoca em condenacao.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} diz que confiava em ${accusedName} como aliado, ate descobrir a traicao dentro da propria area.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} admite que a historia pegou fogo, mas insiste que nao forcou nada e que a favela esta exagerando.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName, favelaName, random }) =>
        `${accuserName} diz que ${accusedName} mexeu com a ${pickOne(TALARICO_RELATIONS, random)} dele e fez ${favelaName} toda rir da cara dele.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} fala que a relacao ja estava rompida e que agora querem vestir honra ferida como se fosse regra absoluta.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} afirma que abriu a porta de casa e de negocio para ${accusedName}, que pagou com traicao e afronta.`,
      accusedStatement: ({ accusedName }) =>
        `${accusedName} diz que nao traiu aliado nenhum, so entrou numa historia que ja vinha quebrada muito antes dele aparecer.`,
    },
    {
      accuserStatement: ({ accuserName, accusedName }) =>
        `${accuserName} fala que ${accusedName} ignorou todos os limites, afrontou a palavra dada e transformou o barraco em caso de tribunal.`,
      accusedStatement: ({ accusedName, accuserName }) =>
        `${accusedName} responde que ${accuserName} esta tomado pelo odio e quer usar o peso da faccao para resolver ciume pessoal.`,
    },
  ],
};

export const TRIBUNAL_STORY_TEMPLATE_COUNTS: Record<TribunalCaseType, number> = Object.freeze(
  Object.fromEntries(
    Object.entries(TRIBUNAL_STORY_TEMPLATES).map(([caseType, templates]) => [caseType, templates.length]),
  ) as Record<TribunalCaseType, number>,
);

export class TribunalService implements TribunalServiceContract {
  private readonly keyValueStore: KeyValueStore;

  private readonly levelSystem: LevelSystem;

  private readonly now: () => Date;
  private readonly random: () => number;
  private readonly repository: TribunalRepository;

  constructor(options: TribunalServiceOptions = {}) {
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.levelSystem = options.levelSystem ?? new LevelSystem();
    this.now = options.now ?? (() => new Date());
    this.random = options.random ?? Math.random;
    this.repository = options.repository ?? new DatabaseTribunalRepository();
  }

  async close(): Promise<void> {
    await this.keyValueStore.close?.();
  }

  async getTribunalCenter(playerId: string, favelaId: string): Promise<TribunalCenterResponse> {
    const context = await this.resolveContext(playerId, favelaId);
    const activeCase = await this.repository.getOpenCase(favelaId);

    return {
      activeCase: activeCase ? toTribunalCaseSummary(activeCase, context.favela) : null,
      favela: toTribunalFavelaSummary(context.favela),
      player: toPlayerSummary(context.player),
    };
  }

  async generateCase(playerId: string, favelaId: string): Promise<TribunalCaseGenerateResponse> {
    const context = await this.resolveContext(playerId, favelaId);
    const existingCase = await this.repository.getOpenCase(favelaId);

    if (existingCase) {
      return {
        activeCase: toTribunalCaseSummary(existingCase, context.favela),
        created: false,
        favela: toTribunalFavelaSummary(context.favela),
        player: toPlayerSummary(context.player),
      };
    }

    const generatedCase = this.buildCase(context.favela);
    const createdCase = await this.repository.createCase({
      ...generatedCase,
      createdAt: this.now(),
      favelaId,
    });

    if (!createdCase) {
      throw new Error('Falha ao gerar o caso do tribunal.');
    }

    return {
      activeCase: toTribunalCaseSummary(createdCase, context.favela),
      created: true,
      favela: toTribunalFavelaSummary(context.favela),
      player: toPlayerSummary(context.player),
    };
  }

  async judgeCase(playerId: string, favelaId: string, input: TribunalJudgmentInput): Promise<TribunalJudgmentResponse> {
    const context = await this.resolveContext(playerId, favelaId);
    const activeCase = await this.repository.getOpenCase(favelaId);

    if (!activeCase) {
      throw new TribunalError('not_found', 'Nenhum caso aberto foi encontrado para esta favela.');
    }

    const definition = getTribunalDefinition(activeCase.caseType as TribunalCaseType);

    if (!definition.allowedPunishments.includes(input.punishment)) {
      throw new TribunalError('validation', 'Punicao invalida para este tipo de caso.');
    }

    const impact = getPunishmentImpact(
      activeCase.caseType as TribunalCaseType,
      input.punishment,
      activeCase.communitySupports as TribunalCaseSide,
    );
    const judgmentRead = resolveJudgmentRead(
      activeCase.caseType as TribunalCaseType,
      input.punishment,
      activeCase.truthSide as TribunalCaseSide,
    );
    const conceitoDelta = resolveConceitoDelta({
      caseType: activeCase.caseType as TribunalCaseType,
      faccaoImpact: impact.faccao,
      judgmentRead,
      moradoresImpact: impact.moradores,
      punishment: input.punishment,
    });
    const conceitoAfter = clamp(context.player.conceito + conceitoDelta, 0, Number.MAX_SAFE_INTEGER);
    const levelProgression = this.levelSystem.resolve(conceitoAfter, context.player.level);
    const favelaSatisfactionAfter = clamp(context.favela.satisfaction + impact.moradores, 0, 100);
    const factionInternalSatisfactionAfter = clamp(
      context.faction.internalSatisfaction + impact.faccao,
      0,
      100,
    );
    const judgedAt = this.now();

    const updated = await this.repository.applyJudgment({
      caseId: activeCase.id,
      conceitoAfter,
      conceitoImpact: conceitoDelta,
      factionId: context.faction.id,
      factionInternalSatisfactionAfter,
      judgedAt,
      judgedBy: context.player.id,
      moralFacaoImpact: impact.faccao,
      moralMoradoresImpact: impact.moradores,
      playerId: context.player.id,
      playerLevelAfter: levelProgression.level,
      punishmentChosen: input.punishment,
      satisfactionAfter: favelaSatisfactionAfter,
    });

    if (!updated) {
      throw new Error('Falha ao registrar o julgamento do tribunal.');
    }

    await this.keyValueStore.delete?.(buildPlayerProfileCacheKey(playerId));

    return {
      activeCase: toTribunalCaseSummary(updated.caseRecord, context.favela),
      favela: toTribunalFavelaSummary(context.favela),
      judgment: {
        conceitoAfter,
        conceitoDelta,
        faccaoImpact: impact.faccao,
        factionInternalSatisfactionAfter: updated.factionInternalSatisfactionAfter,
        factionInternalSatisfactionDelta: impact.faccao,
        favelaSatisfactionAfter: updated.satisfactionAfter,
        favelaSatisfactionDelta: impact.moradores,
        moradoresImpact: impact.moradores,
        punishmentChosen: input.punishment,
        read: judgmentRead,
        summary: buildJudgmentSummary({
          caseLabel: definition.label,
          conceitoDelta,
          faccaoImpact: impact.faccao,
          favelaName: context.favela.name,
          judgmentRead,
          moradoresImpact: impact.moradores,
          punishment: input.punishment,
        }),
      },
      player: toPlayerSummary(updated.playerRecord),
    };
  }

  private buildCase(favela: TribunalFavelaRecord): GeneratedTribunalCase {
    const caseType = pickWeightedCaseType(favela, this.random);
    const accuserName = pickOne(TRIBUNAL_NAME_BANK, this.random);
    const accusedName = pickDistinctOne(TRIBUNAL_NAME_BANK, accuserName, this.random);
    const accuserCharismaCommunity = randomInt(22, 92, this.random);
    const accusedCharismaCommunity = randomInt(22, 92, this.random);
    const accuserCharismaFaction = randomInt(18, 88, this.random);
    const accusedCharismaFaction = randomInt(18, 88, this.random);
    const communitySupports = decideSideFromCharisma(
      accuserCharismaCommunity,
      accusedCharismaCommunity,
      this.random,
    );
    const truthSide = decideSideFromFactionRead(
      accuserCharismaFaction,
      accusedCharismaFaction,
      this.random,
    );
    const template = pickOne(getStoryTemplates(caseType), this.random);
    const context: TribunalStoryTemplateContext = {
      accusedName,
      accuserName,
      favelaName: favela.name,
      random: this.random,
    };
    const accuserStatement = template.accuserStatement(context);
    const accusedStatement = template.accusedStatement(context);
    const antigaoAdvice = buildAntigaoAdviceProfile({
      caseType,
      communitySupports,
      favelaName: favela.name,
      truthSide,
    });

    return {
      accusedCharismaCommunity,
      accusedCharismaFaction,
      accusedName,
      accusedStatement,
      accuserCharismaCommunity,
      accuserCharismaFaction,
      accuserName,
      accuserStatement,
      antigaoHint: antigaoAdvice.hint,
      antigaoSuggestedPunishment: antigaoAdvice.suggestedPunishment,
      caseType,
      communitySupports,
      truthSide,
    };
  }

  private async resolveContext(playerId: string, favelaId: string) {
    const [player, membership, favela] = await Promise.all([
      this.repository.getPlayer(playerId),
      this.repository.getPlayerFactionMembership(playerId),
      this.repository.getFavela(favelaId),
    ]);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao autenticado.');
    }

    if (!player.characterCreatedAt) {
      throw new TribunalError('character_not_ready', 'Crie o personagem antes de abrir o tribunal.');
    }

    if (!membership || !player.factionId || membership.factionId !== player.factionId) {
      throw new TribunalError('forbidden', 'Voce precisa pertencer a uma faccao para acessar o tribunal.');
    }

    if (!ALLOWED_TRIBUNAL_RANKS.has(membership.rank)) {
      throw new TribunalError('forbidden', 'Apenas Patrao ou General podem conduzir o tribunal.');
    }

    if (!favela) {
      throw new TribunalError('not_found', 'Favela nao encontrada.');
    }

    if (favela.state !== 'controlled' || favela.controllingFactionId !== membership.factionId) {
      throw new TribunalError(
        'forbidden',
        'O tribunal so pode ser conduzido em favela dominada pela sua faccao.',
      );
    }

    const faction = await this.repository.getFaction(membership.factionId);

    if (!faction) {
      throw new TribunalError('not_found', 'Faccao nao encontrada para conduzir o tribunal.');
    }

    return {
      faction,
      favela,
      membership,
      player,
    };
  }
}

function pickWeightedCaseType(
  favela: Pick<TribunalFavelaRecord, 'population' | 'satisfaction'>,
  random: () => number,
): TribunalCaseType {
  const weights: Record<TribunalCaseType, number> = {
    roubo_entre_moradores: 18,
    talaricagem: 11,
    divida_jogo: 10,
    divida_drogas: 14,
    estupro: 4,
    agressao: 16,
    homicidio_nao_autorizado: 7,
  };

  if (favela.population >= 5000) {
    incrementWeight(weights, 'roubo_entre_moradores', 4);
    incrementWeight(weights, 'agressao', 3);
    incrementWeight(weights, 'talaricagem', 2);
  }

  if (favela.satisfaction <= 40) {
    incrementWeight(weights, 'agressao', 5);
    incrementWeight(weights, 'homicidio_nao_autorizado', 3);
    incrementWeight(weights, 'divida_drogas', 2);
  }

  const entries = Object.entries(weights) as [TribunalCaseType, number][];
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * totalWeight;

  for (const [caseType, weight] of entries) {
    roll -= weight;
    if (roll <= 0) {
      return caseType;
    }
  }

  return 'roubo_entre_moradores';
}

function decideSideFromCharisma(
  accuserCharisma: number,
  accusedCharisma: number,
  random: () => number,
): TribunalCaseSide {
  const accuserChance = clamp(0.5 + (accuserCharisma - accusedCharisma) / 160, 0.2, 0.8);
  return random() <= accuserChance ? 'accuser' : 'accused';
}

function decideSideFromFactionRead(
  accuserCharismaFaction: number,
  accusedCharismaFaction: number,
  random: () => number,
): TribunalCaseSide {
  const accuserTruthChance = clamp(0.5 + (accuserCharismaFaction - accusedCharismaFaction) / 200, 0.25, 0.75);
  return random() <= accuserTruthChance ? 'accuser' : 'accused';
}

function buildAntigaoAdviceProfile(input: {
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  favelaName: string;
  truthSide: TribunalCaseSide;
}): TribunalAntigaoAdviceProfile {
  const definition = getTribunalDefinition(input.caseType);
  const punishmentInsights = definition.allowedPunishments.map((punishment) =>
    buildPunishmentInsight({
      caseType: input.caseType,
      communitySupports: input.communitySupports,
      favelaName: input.favelaName,
      punishment,
      truthSide: input.truthSide,
    }),
  );

  let recommendedPunishment = punishmentInsights[0]?.punishment ?? 'surra';
  let recommendedScore = Number.NEGATIVE_INFINITY;

  for (const insight of punishmentInsights) {
    const score = scorePunishmentInsight(insight);
    if (score > recommendedScore) {
      recommendedScore = score;
      recommendedPunishment = insight.punishment;
    }
  }

  const finalInsights = punishmentInsights.map((insight) => ({
    ...insight,
    recommended: insight.punishment === recommendedPunishment,
  }));

  return {
    balanceWarning: buildBalanceWarning({
      caseLabel: definition.label,
      communitySupports: input.communitySupports,
      favelaName: input.favelaName,
      truthSide: input.truthSide,
    }),
    communityRead: input.communitySupports,
    hint: buildAntigaoHint({
      caseLabel: definition.label,
      communitySupports: input.communitySupports,
      favelaName: input.favelaName,
      suggestedPunishment: recommendedPunishment,
      truthSide: input.truthSide,
    }),
    punishmentInsights: finalInsights,
    suggestedPunishment: recommendedPunishment,
    truthRead: input.truthSide,
  };
}

function buildPunishmentInsight(input: {
  caseType: TribunalCaseType;
  communitySupports: TribunalCaseSide;
  favelaName: string;
  punishment: TribunalPunishment;
  truthSide: TribunalCaseSide;
}): TribunalPunishmentInsightSummary {
  const impact = getPunishmentImpact(input.caseType, input.punishment, input.communitySupports);
  const read = classifyPunishmentRead(input.caseType, input.punishment, input.truthSide);

  return {
    faccaoImpact: impact.faccao,
    moradoresImpact: impact.moradores,
    note: buildPunishmentNote({
      faccaoImpact: impact.faccao,
      favelaName: input.favelaName,
      moradoresImpact: impact.moradores,
      punishment: input.punishment,
      read,
      truthSide: input.truthSide,
    }),
    punishment: input.punishment,
    read,
    recommended: false,
  };
}

function buildBalanceWarning(input: {
  caseLabel: string;
  communitySupports: TribunalCaseSide;
  favelaName: string;
  truthSide: TribunalCaseSide;
}): string {
  if (input.truthSide === input.communitySupports) {
    return input.truthSide === 'accuser'
      ? `Rua e verdade estao alinhadas contra o acusado em ${input.favelaName}. O risco maior agora e aliviar demais a mao num caso de ${input.caseLabel.toLowerCase()}.`
      : `Rua e verdade estao inclinadas a aliviar o acusado em ${input.favelaName}. O maior risco e exagerar a pena e comprar revolta desnecessaria.`;
  }

  if (input.truthSide === 'accuser') {
    return `A rua esta balancando para aliviar o acusado, mas o Antigao sente culpa no caso de ${input.caseLabel.toLowerCase()}. Se julgar leve demais, a faccao pode ler como frouxidao.`;
  }

  return `A rua quer punicao dura, mas o Antigao desconfia da acusacao em ${input.favelaName}. Pegar pesado aqui arrisca condenar errado e incendiar os moradores.`;
}

function buildAntigaoHint(input: {
  caseLabel: string;
  communitySupports: TribunalCaseSide;
  favelaName: string;
  suggestedPunishment: TribunalPunishment;
  truthSide: TribunalCaseSide;
}): string {
  const supportLine =
    input.communitySupports === 'accuser'
      ? 'A comunidade esta mais inclinada a acreditar no acusador.'
      : 'A comunidade esta mais inclinada a acreditar no acusado.';
  const truthLine =
    input.truthSide === input.communitySupports
      ? 'O Antigao sente que a rua e a verdade estao puxando para o mesmo lado.'
      : input.truthSide === 'accuser'
        ? 'O Antigao avisa que a rua esta aliviando, mas a verdade parece pesar contra o acusado.'
        : 'O Antigao avisa que a rua quer sangue, mas a verdade parece menos reta do que estao gritando.';
  const punishmentLine = `Pelo peso de ${input.caseLabel.toLowerCase()}, ele cochicha que ${punishmentLabel(input.suggestedPunishment).toLowerCase()} parece o caminho mais seguro.`;

  return `${supportLine} ${truthLine} ${punishmentLine} ${input.favelaName} vai cobrar firmeza e medida no julgamento.`;
}

function getPunishmentImpact(
  caseType: TribunalCaseType,
  punishment: TribunalPunishment,
  communitySupports: TribunalCaseSide,
): TribunalImpactProfile {
  const caseMatrix = TRIBUNAL_IMPACT_TABLE[caseType];
  const punishmentMatrix = caseMatrix?.[punishment];
  const impact = punishmentMatrix?.[communitySupports];

  if (!impact) {
    throw new TribunalError(
      'validation',
      `Nao foi possivel projetar impacto para ${caseType}/${punishment}/${communitySupports}.`,
    );
  }

  return impact;
}

function classifyPunishmentRead(
  caseType: TribunalCaseType,
  punishment: TribunalPunishment,
  truthSide: TribunalCaseSide,
): TribunalPunishmentRead {
  const severity = PUNISHMENT_SEVERITY_SCORE[punishment];
  const targets = TRIBUNAL_TRUTH_TARGETS[caseType];
  const [minTarget, maxTarget] = truthSide === 'accuser' ? targets.guilty : targets.innocent;

  if (truthSide === 'accuser') {
    if (severity < minTarget) {
      return 'leve_demais';
    }

    if (severity > maxTarget + 1) {
      return 'brutal';
    }

    if (severity > maxTarget) {
      return 'dureza_arriscada';
    }

    return 'proporcional';
  }

  if (severity <= maxTarget) {
    return 'prudente';
  }

  if (severity === maxTarget + 1) {
    return 'dureza_arriscada';
  }

  return 'condena_inocente';
}

function buildPunishmentNote(input: {
  faccaoImpact: number;
  favelaName: string;
  moradoresImpact: number;
  punishment: TribunalPunishment;
  read: TribunalPunishmentRead;
  truthSide: TribunalCaseSide;
}): string {
  const punishmentText = punishmentLabel(input.punishment);
  const moradoresText = formatImpactLabel('moradores', input.moradoresImpact);
  const faccaoText = formatImpactLabel('facção', input.faccaoImpact);

  switch (input.read) {
    case 'prudente':
      return `${punishmentText} e a saida menos injusta se o acusado estiver falando a verdade. ${moradoresText} ${faccaoText}`;
    case 'proporcional':
      return `${punishmentText} segura o peso do caso sem perder a mao. ${moradoresText} ${faccaoText}`;
    case 'leve_demais':
      return `${punishmentText} pode soar frouxo se a culpa for real. ${moradoresText} ${faccaoText}`;
    case 'dureza_arriscada':
      return `${punishmentText} passa recado, mas pisa perto demais da linha em ${input.favelaName}. ${moradoresText} ${faccaoText}`;
    case 'condena_inocente':
      return `${punishmentText} arrisca condenar errado se o acusado estiver certo. ${moradoresText} ${faccaoText}`;
    case 'brutal':
      return `${punishmentText} entrega medo e autoridade, mas pode parecer crueldade desnecessaria. ${moradoresText} ${faccaoText}`;
    default:
      return `${moradoresText} ${faccaoText}`;
  }
}

function scorePunishmentInsight(insight: TribunalPunishmentInsightSummary): number {
  const socialScore = insight.moradoresImpact * 1.1 + insight.faccaoImpact * 0.9;

  switch (insight.read) {
    case 'prudente':
      return socialScore + 16;
    case 'proporcional':
      return socialScore + 22;
    case 'dureza_arriscada':
      return socialScore - 4;
    case 'leve_demais':
      return socialScore - 14;
    case 'condena_inocente':
      return socialScore - 20;
    case 'brutal':
      return socialScore - 10;
    default:
      return socialScore;
  }
}

function resolveJudgmentRead(
  caseType: TribunalCaseType,
  punishment: TribunalPunishment,
  truthSide: TribunalCaseSide,
): TribunalJudgmentRead {
  const punishmentRead = classifyPunishmentRead(caseType, punishment, truthSide);
  const severity = getTribunalDefinition(caseType).severity;

  switch (punishmentRead) {
    case 'proporcional':
    case 'prudente':
      return 'justa';
    case 'condena_inocente':
      return 'injusta';
    case 'brutal':
      return 'brutal_desnecessaria';
    case 'dureza_arriscada':
      return 'arriscada';
    case 'leve_demais':
      return severity === 'media_alta' || severity === 'muito_alta' ? 'covarde' : 'injusta';
    default:
      return 'injusta';
  }
}

function resolveConceitoDelta(input: {
  caseType: TribunalCaseType;
  faccaoImpact: number;
  judgmentRead: TribunalJudgmentRead;
  moradoresImpact: number;
  punishment: TribunalPunishment;
}): number {
  const socialScore = input.moradoresImpact + input.faccaoImpact;

  switch (input.judgmentRead) {
    case 'justa':
      return clamp(Math.round(110 + socialScore * 6), 50, 200);
    case 'arriscada':
      return clamp(Math.round(30 + socialScore * 5), -80, 120);
    case 'covarde':
      return clamp(Math.round(-160 + socialScore * 5), -300, -100);
    case 'brutal_desnecessaria':
      return clamp(Math.round(-90 + socialScore * 3), -150, -50);
    case 'injusta':
    default:
      return clamp(Math.round(-120 + socialScore * 4), -220, -50);
  }
}

function buildJudgmentSummary(input: {
  caseLabel: string;
  conceitoDelta: number;
  faccaoImpact: number;
  favelaName: string;
  judgmentRead: TribunalJudgmentRead;
  moradoresImpact: number;
  punishment: TribunalPunishment;
}): string {
  const punishmentText = punishmentLabel(input.punishment);
  const conceitoText =
    input.conceitoDelta >= 0
      ? `Voce ganhou ${input.conceitoDelta} de conceito.`
      : `Voce perdeu ${Math.abs(input.conceitoDelta)} de conceito.`;
  const moradoresText = formatImpactLabel('moradores', input.moradoresImpact);
  const faccaoText = formatImpactLabel('facção', input.faccaoImpact);

  switch (input.judgmentRead) {
    case 'justa':
      return `${punishmentText} foi lido como decisao justa em ${input.favelaName}. ${moradoresText} ${faccaoText} ${conceitoText}`;
    case 'arriscada':
      return `${punishmentText} segurou o caso, mas dividiu opinioes em ${input.favelaName}. ${moradoresText} ${faccaoText} ${conceitoText}`;
    case 'covarde':
      return `${punishmentText} foi visto como frouxidao diante de ${input.caseLabel.toLowerCase()}. ${moradoresText} ${faccaoText} ${conceitoText}`;
    case 'brutal_desnecessaria':
      return `${punishmentText} passou da medida e foi lido como brutalidade desnecessaria. ${moradoresText} ${faccaoText} ${conceitoText}`;
    case 'injusta':
    default:
      return `${punishmentText} foi lido como julgamento injusto. ${moradoresText} ${faccaoText} ${conceitoText}`;
  }
}

function formatImpactLabel(target: 'facção' | 'moradores', amount: number): string {
  if (amount > 0) {
    return `${capitalize(target)} sobem ${amount} ponto${amount === 1 ? '' : 's'}.`;
  }

  if (amount < 0) {
    const absolute = Math.abs(amount);
    return `${capitalize(target)} caem ${absolute} ponto${absolute === 1 ? '' : 's'}.`;
  }

  return `${capitalize(target)} ficam estaveis.`;
}

function toTribunalFavelaSummary(favela: TribunalFavelaRecord): TribunalFavelaSummary {
  return {
    id: favela.id,
    name: favela.name,
    regionId: favela.regionId as RegionId,
  };
}

function toTribunalCaseSummary(
  caseRecord: TribunalCaseRecord,
  favela: Pick<TribunalFavelaRecord, 'id' | 'name'>,
): TribunalCaseSummary {
  const definition = getTribunalDefinition(caseRecord.caseType as TribunalCaseType);
  const antigaoAdvice = buildAntigaoAdviceProfile({
    caseType: caseRecord.caseType as TribunalCaseType,
    communitySupports: caseRecord.communitySupports as TribunalCaseSide,
    favelaName: favela.name,
    truthSide: caseRecord.truthSide as TribunalCaseSide,
  });

  return {
    accused: {
      charismaCommunity: caseRecord.accusedCharismaCommunity,
      charismaFaction: caseRecord.accusedCharismaFaction,
      name: caseRecord.accusedName,
      statement: caseRecord.accusedStatement,
    },
    accuser: {
      charismaCommunity: caseRecord.accuserCharismaCommunity,
      charismaFaction: caseRecord.accuserCharismaFaction,
      name: caseRecord.accuserName,
      statement: caseRecord.accuserStatement,
    },
    antigaoAdvice,
    antigaoHint: antigaoAdvice.hint,
    antigaoSuggestedPunishment: antigaoAdvice.suggestedPunishment,
    caseType: caseRecord.caseType as TribunalCaseType,
    communitySupports: caseRecord.communitySupports as TribunalCaseSide,
    createdAt: caseRecord.createdAt.toISOString(),
    definition,
    favelaId: caseRecord.favelaId,
    id: caseRecord.id,
    judgedAt: caseRecord.judgedAt ? caseRecord.judgedAt.toISOString() : null,
    punishmentChosen: caseRecord.punishmentChosen as TribunalPunishment | null,
    summary: buildCaseSummary(caseRecord, favela.name, definition.label),
    truthRead: caseRecord.truthSide as TribunalCaseSide,
  };
}

function buildCaseSummary(
  caseRecord: Pick<TribunalCaseRecord, 'accusedName' | 'accuserName' | 'caseType'>,
  favelaName: string,
  caseLabel: string,
): string {
  switch (caseRecord.caseType as TribunalCaseType) {
    case 'roubo_entre_moradores':
      return `${caseRecord.accuserName} acusa ${caseRecord.accusedName} de roubar dentro de ${favelaName}.`;
    case 'talaricagem':
      return `${caseRecord.accuserName} quer que o tribunal julgue a traicao envolvendo ${caseRecord.accusedName}.`;
    case 'divida_jogo':
      return `${caseRecord.accuserName} cobra uma divida de jogo e diz que ${caseRecord.accusedName} desonrou a palavra.`;
    case 'divida_drogas':
      return `${caseRecord.accuserName} trouxe ${caseRecord.accusedName} ao tribunal por conta de droga fiada e calote.`;
    case 'estupro':
      return `${caseLabel}: ${caseRecord.accuserName} exige uma resposta dura contra ${caseRecord.accusedName}.`;
    case 'agressao':
      return `${caseRecord.accuserName} denuncia uma agressao cometida por ${caseRecord.accusedName} dentro da favela.`;
    case 'homicidio_nao_autorizado':
      return `${caseLabel}: ${caseRecord.accusedName} e acusado de derramar sangue sem palavra da faccao.`;
    default:
      return `${caseLabel}: ${caseRecord.accuserName} acusa ${caseRecord.accusedName} e a favela espera uma decisao.`;
  }
}

function getTribunalDefinition(caseType: TribunalCaseType) {
  const definition = TRIBUNAL_CASE_DEFINITIONS.find(
    (entry: (typeof TRIBUNAL_CASE_DEFINITIONS)[number]) => entry.type === caseType,
  );

  if (!definition) {
    throw new TribunalError('validation', `Tipo de caso invalido: ${caseType}.`);
  }

  return definition;
}

function getStoryTemplates(caseType: TribunalCaseType) {
  const templates = TRIBUNAL_STORY_TEMPLATES[caseType];

  if (!templates || templates.length === 0) {
    throw new TribunalError('validation', `Nenhum template disponivel para ${caseType}.`);
  }

  return templates;
}

function punishmentLabel(punishment: TribunalPunishment): string {
  switch (punishment) {
    case 'aviso':
      return 'Liberar com aviso';
    case 'surra':
      return 'Dar uma surra';
    case 'expulsao':
      return 'Expulsar da favela';
    case 'matar':
      return 'Matar';
    case 'esquartejar':
      return 'Esquartejar';
    case 'queimar_no_pneu':
      return 'Queimar no pneu';
    default:
      return 'Aplicar uma punicao';
  }
}

function pickOne<T>(items: readonly T[], random: () => number): T {
  const picked = items[Math.floor(random() * items.length)] ?? items[0];

  if (picked === undefined) {
    throw new TribunalError('validation', 'Lista vazia ao montar o caso do tribunal.');
  }

  return picked;
}

function pickDistinctOne<T>(items: readonly T[], disallowed: T, random: () => number): T {
  const filtered = items.filter((item) => item !== disallowed);
  return pickOne(filtered.length > 0 ? filtered : items, random);
}

function randomInt(min: number, max: number, random: () => number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function capitalize(value: string): string {
  return value.length > 0 ? `${value[0]?.toUpperCase() ?? ''}${value.slice(1)}` : value;
}

function incrementWeight(
  weights: Record<TribunalCaseType, number>,
  caseType: TribunalCaseType,
  amount: number,
) {
  weights[caseType] = (weights[caseType] ?? 0) + amount;
}
