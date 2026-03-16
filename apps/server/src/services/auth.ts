import { randomUUID } from 'node:crypto';

import {
  hasValidPasswordLength,
  isValidAuthNickname,
  isValidEmail,
  LEVELS,
  LevelTitle,
  normalizeAuthNickname,
  normalizeEmail,
  normalizePasswordInput,
  RegionId,
  VocationType,
  type PlayerSummary,
} from '@cs-rio/shared';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { createClient } from 'redis';

import { ensureValidJwtSecrets, env } from '../config/env.js';
import { db } from '../db/client.js';
import { players } from '../db/schema.js';
import { createInfrastructureLogger, type InfrastructureLogger } from '../observability/logger.js';
import { ServerConfigService } from './server-config.js';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const BCRYPT_SALT_ROUNDS = 12;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const FALLBACK_DEFAULT_REGION_ID = RegionId.Centro;
const serverConfigService = new ServerConfigService();

export type AuthPlayerRecord = typeof players.$inferSelect;

export interface AuthRepository {
  createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord>;
  findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null>;
  findPlayerById(id: string): Promise<AuthPlayerRecord | null>;
  findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null>;
  updateLastLogin(playerId: string, date: Date): Promise<void>;
}

export interface KeyValueStore {
  close?(): Promise<void>;
  delete?(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  setIfAbsent?(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
  player: {
    id: string;
    nickname: string;
  };
  refreshExpiresIn: number;
  refreshToken: string;
}

export interface AuthServiceOptions {
  jwtRefreshSecret?: string;
  jwtSecret?: string;
  keyValueStore?: KeyValueStore;
  repository?: AuthRepository;
}

export interface RedisKeyValueStoreOptions {
  clientFactory?: (redisUrl: string) => RedisKeyValueStoreClient;
  logger?: InfrastructureLogger;
  redisUrl: string;
}

export interface AccessIdentity {
  playerId: string;
}

interface RefreshIdentity extends AccessIdentity {
  expiresAt: number;
  tokenId: string;
}

type AccessTokenPayload = JwtPayload & {
  sub: string;
  typ: 'access';
};

type AuthErrorCode =
  | 'conflict'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'unauthorized'
  | 'validation';

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class DatabaseAuthRepository implements AuthRepository {
  async createPlayer(input: {
    email: string;
    lastLogin: Date;
    nickname: string;
    passwordHash: string;
  }): Promise<AuthPlayerRecord> {
    const defaultRegion = await serverConfigService.getDefaultSpawnRegion();
    const [player] = await db
      .insert(players)
      .values({
        email: input.email,
        lastLogin: input.lastLogin,
        nickname: input.nickname,
        passwordHash: input.passwordHash,
        regionId: defaultRegion?.id ?? FALLBACK_DEFAULT_REGION_ID,
        vocation: VocationType.Cria,
      })
      .returning();

    if (!player) {
      throw new Error('Falha ao criar o jogador.');
    }

    return player;
  }

  async findPlayerByEmail(email: string): Promise<AuthPlayerRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.email, email)).limit(1);
    return player ?? null;
  }

  async findPlayerById(id: string): Promise<AuthPlayerRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.id, id)).limit(1);
    return player ?? null;
  }

  async findPlayerByNickname(nickname: string): Promise<AuthPlayerRecord | null> {
    const [player] = await db.select().from(players).where(eq(players.nickname, nickname)).limit(1);
    return player ?? null;
  }

  async updateLastLogin(playerId: string, date: Date): Promise<void> {
    await db.update(players).set({ lastLogin: date }).where(eq(players.id, playerId));
  }
}

interface RedisKeyValueStoreClient {
  connect(): Promise<unknown>;
  del(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<number>;
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  isOpen: boolean;
  on(event: 'end' | 'ready' | 'reconnecting', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  quit(): Promise<unknown>;
  set(key: string, value: string, options?: { EX?: number; NX?: boolean }): Promise<unknown>;
}

export class RedisKeyValueStore implements KeyValueStore {
  private client: RedisKeyValueStoreClient | null = null;

  private readonly clientFactory: (redisUrl: string) => RedisKeyValueStoreClient;

  private readonly logger: InfrastructureLogger;

  private readonly redisUrl: string;

  constructor(redisUrlOrOptions: string | RedisKeyValueStoreOptions) {
    const options =
      typeof redisUrlOrOptions === 'string'
        ? { redisUrl: redisUrlOrOptions }
        : redisUrlOrOptions;

    this.redisUrl = options.redisUrl;
    this.clientFactory = options.clientFactory ?? ((redisUrl) => createClient({ url: redisUrl }));
    this.logger = (options.logger ?? createInfrastructureLogger({ scope: 'redis' })).child({
      redisTarget: describeRedisTarget(this.redisUrl),
    });
  }

  async close(): Promise<void> {
    if (this.client?.isOpen) {
      await this.client.quit();
    }

    this.client = null;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return client.get(key);
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const client = await this.getClient();
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, ttlSeconds);
    }

    return count;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();

    if (ttlSeconds && ttlSeconds > 0) {
      await client.set(key, value, {
        EX: ttlSeconds,
      });
      return;
    }

    await client.set(key, value);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const client = await this.getClient();
    const result =
      ttlSeconds && ttlSeconds > 0
        ? await client.set(key, value, {
            EX: ttlSeconds,
            NX: true,
          })
        : await client.set(key, value, {
            NX: true,
          });

    return result !== null;
  }

  private async getClient(): Promise<RedisKeyValueStoreClient> {
    if (this.client?.isOpen) {
      return this.client;
    }

    if (!this.client) {
      this.client = this.clientFactory(this.redisUrl);
      this.registerClientListeners(this.client);
    }

    if (!this.client.isOpen) {
      await this.client.connect();
    }

    return this.client;
  }

  private registerClientListeners(client: RedisKeyValueStoreClient): void {
    client.on('ready', () => {
      this.logger.info({}, 'Redis client ready.');
    });
    client.on('reconnecting', () => {
      this.logger.warn({}, 'Redis client reconnecting.');
    });
    client.on('end', () => {
      this.logger.warn({}, 'Redis client connection ended.');
    });
    client.on('error', (error) => {
      this.logger.error(
        {
          err: error,
        },
        'Redis client error.',
      );
    });
  }
}

function describeRedisTarget(redisUrl: string): string {
  try {
    const parsed = new URL(redisUrl);
    const port = parsed.port || '6379';
    const dbIndex = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname.slice(1) : '0';
    return `${parsed.hostname}:${port}/${dbIndex}`;
  } catch {
    return 'invalid-redis-url';
  }
}

export class AuthService {
  private readonly jwtRefreshSecret: string;

  private readonly jwtSecret: string;

  private readonly keyValueStore: KeyValueStore;

  private readonly repository: AuthRepository;

  constructor(options: AuthServiceOptions = {}) {
    const secrets = ensureValidJwtSecrets(
      {
        jwtRefreshSecret: options.jwtRefreshSecret ?? env.jwtRefreshSecret,
        jwtSecret: options.jwtSecret ?? env.jwtSecret,
      },
      'AuthService',
    );
    this.jwtRefreshSecret = secrets.jwtRefreshSecret;
    this.jwtSecret = secrets.jwtSecret;
    this.keyValueStore = options.keyValueStore ?? new RedisKeyValueStore(env.redisUrl);
    this.repository = options.repository ?? new DatabaseAuthRepository();
  }

  async close(): Promise<void> {
    await this.keyValueStore.close?.();
  }

  async getPlayerSummary(playerId: string): Promise<PlayerSummary> {
    const player = await this.repository.findPlayerById(playerId);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    return toPlayerSummary(player);
  }

  async login(input: { email: string; ipAddress: string; password: string }): Promise<AuthTokens> {
    const email = normalizeEmail(input.email);
    const loginRateLimitKey = buildLoginRateLimitKey(input.ipAddress);
    const password = normalizePasswordInput(input.password);
    this.validateEmail(email);
    this.validatePassword(password);

    const attempts = Number((await this.keyValueStore.get(loginRateLimitKey)) ?? '0');

    if (attempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
      throw new AuthError('rate_limited', 'Muitas tentativas de login. Aguarde 1 minuto.');
    }

    const player = await this.repository.findPlayerByEmail(email);

    if (!player) {
      await this.keyValueStore.increment(loginRateLimitKey, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
      throw new AuthError('invalid_credentials', 'Email ou senha invalidos.');
    }

    const passwordMatches = await bcrypt.compare(password, player.passwordHash);

    if (!passwordMatches) {
      await this.keyValueStore.increment(loginRateLimitKey, LOGIN_RATE_LIMIT_WINDOW_SECONDS);
      throw new AuthError('invalid_credentials', 'Email ou senha invalidos.');
    }

    const now = new Date();
    await this.repository.updateLastLogin(player.id, now);

    return this.issueTokens({
      ...player,
      lastLogin: now,
    });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const identity = this.verifyRefreshToken(refreshToken);
    const blacklistKey = buildRefreshBlacklistKey(identity.tokenId);
    const isBlacklisted = await this.keyValueStore.get(blacklistKey);

    if (isBlacklisted) {
      throw new AuthError('unauthorized', 'Refresh token invalido ou ja utilizado.');
    }

    const player = await this.repository.findPlayerById(identity.playerId);

    if (!player) {
      throw new AuthError('unauthorized', 'Jogador nao encontrado.');
    }

    const ttlSeconds = Math.max(identity.expiresAt - Math.floor(Date.now() / 1000), 1);
    await this.keyValueStore.set(blacklistKey, '1', ttlSeconds);

    return this.issueTokens(player);
  }

  async register(input: { email: string; nickname: string; password: string }): Promise<AuthTokens> {
    const email = normalizeEmail(input.email);
    const nickname = normalizeAuthNickname(input.nickname);
    const password = normalizePasswordInput(input.password);

    this.validateEmail(email);
    this.validateNickname(nickname);
    this.validatePassword(password);

    const [existingEmail, existingNickname] = await Promise.all([
      this.repository.findPlayerByEmail(email),
      this.repository.findPlayerByNickname(nickname),
    ]);

    if (existingEmail) {
      throw new AuthError('conflict', 'Email ja esta em uso.');
    }

    if (existingNickname) {
      throw new AuthError('conflict', 'Nickname ja esta em uso.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const now = new Date();
    const player = await this.repository.createPlayer({
      email,
      lastLogin: now,
      nickname,
      passwordHash,
    });

    return this.issueTokens(player);
  }

  verifyAccessToken(token: string): AccessIdentity {
    const payload = this.parseAccessToken(token);

    return {
      playerId: payload.sub,
    };
  }

  private issueTokens(player: AuthPlayerRecord): AuthTokens {
    const accessToken = jwt.sign({ typ: 'access' }, this.jwtSecret, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      subject: player.id,
    });
    const refreshToken = jwt.sign(
      {
        jti: randomUUID(),
        typ: 'refresh',
      },
      this.jwtRefreshSecret,
      {
        expiresIn: REFRESH_TOKEN_TTL_SECONDS,
        subject: player.id,
      },
    );

    return {
      accessToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      player: {
        id: player.id,
        nickname: player.nickname,
      },
      refreshExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }

  private parseAccessToken(token: string): AccessTokenPayload {
    try {
      const payload = jwt.verify(token, this.jwtSecret);

      if (
        typeof payload === 'string' ||
        payload.typ !== 'access' ||
        typeof payload.sub !== 'string'
      ) {
        throw new AuthError('unauthorized', 'Token invalido ou expirado.');
      }

      return payload as AccessTokenPayload;
    } catch {
      throw new AuthError('unauthorized', 'Token invalido ou expirado.');
    }
  }

  private verifyRefreshToken(token: string): RefreshIdentity {
    try {
      const payload = jwt.verify(token, this.jwtRefreshSecret);

      if (
        typeof payload === 'string' ||
        payload.typ !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string' ||
        typeof payload.exp !== 'number'
      ) {
        throw new AuthError('unauthorized', 'Refresh token invalido ou expirado.');
      }

      return {
        expiresAt: payload.exp,
        playerId: payload.sub,
        tokenId: payload.jti,
      };
    } catch {
      throw new AuthError('unauthorized', 'Refresh token invalido ou expirado.');
    }
  }

  private validateEmail(email: string): void {
    if (!isValidEmail(email)) {
      throw new AuthError('validation', 'Email invalido.');
    }
  }

  private validateNickname(nickname: string): void {
    if (!isValidAuthNickname(nickname)) {
      throw new AuthError(
        'validation',
        'Nickname deve ter entre 3 e 16 caracteres usando apenas letras, numeros e underscore.',
      );
    }
  }

  private validatePassword(password: string): void {
    if (!hasValidPasswordLength(password)) {
      throw new AuthError('validation', 'Senha deve ter no minimo 8 caracteres.');
    }
  }
}

function buildLoginRateLimitKey(ipAddress: string): string {
  return `auth:login:attempts:${ipAddress}`;
}

function buildRefreshBlacklistKey(tokenId: string): string {
  return `auth:refresh:blacklist:${tokenId}`;
}

export function resolveLevelTitle(level: number): LevelTitle {
  const matchedLevel =
    LEVELS.find((entry) => entry.level === level) ??
    LEVELS[LEVELS.length - 1] ??
    LEVELS[0];

  return matchedLevel?.title ?? LevelTitle.Pivete;
}

export function toPlayerSummary(player: AuthPlayerRecord): PlayerSummary {
  return {
    attributes: {
      carisma: player.carisma,
      forca: player.forca,
      inteligencia: player.inteligencia,
      resistencia: player.resistencia,
    },
    id: player.id,
    level: player.level,
    nickname: player.nickname,
    regionId: player.regionId as RegionId,
    resources: {
      addiction: player.addiction,
      bankMoney: Number(player.bankMoney),
      conceito: player.conceito,
      hp: player.hp,
      brisa: player.brisa,
      money: Number(player.money),
      disposicao: player.disposicao,
      cansaco: player.cansaco,
    },
    title: resolveLevelTitle(player.level),
    vocation: player.vocation as VocationType,
  };
}
