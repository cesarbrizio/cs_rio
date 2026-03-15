import 'dotenv/config';

const INSECURE_JWT_SECRET_VALUES = new Set(['change-me', 'change-me-too']);
const MIN_JWT_SECRET_LENGTH = 32;

export class InvalidEnvironmentError extends Error {
  constructor(
    public readonly issues: string[],
    context = 'boot do servidor',
  ) {
    super(
      [
        `Configuracao de ambiente invalida para ${context}.`,
        ...issues.map((issue) => `- ${issue}`),
      ].join('\n'),
    );
    this.name = 'InvalidEnvironmentError';
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  colyseusPort: Number(process.env.COLYSEUS_PORT ?? 2567),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgresql://cs_rio:cs_rio_dev@localhost:5433/cs_rio',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  corsAllowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.trim(),
  jwtSecret: process.env.JWT_SECRET?.trim(),
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET?.trim(),
};

type JwtSecretsInput = {
  jwtRefreshSecret?: string | null;
  jwtSecret?: string | null;
};

type ValidJwtSecrets = {
  jwtRefreshSecret: string;
  jwtSecret: string;
};

export function ensureValidJwtSecrets(
  input: JwtSecretsInput,
  context = 'boot do servidor',
): ValidJwtSecrets {
  const jwtSecret = input.jwtSecret?.trim();
  const jwtRefreshSecret = input.jwtRefreshSecret?.trim();
  const issues: string[] = [];

  validateJwtSecret('JWT_SECRET', jwtSecret, issues);
  validateJwtSecret('JWT_REFRESH_SECRET', jwtRefreshSecret, issues);

  if (jwtSecret && jwtRefreshSecret && jwtSecret === jwtRefreshSecret) {
    issues.push('JWT_SECRET e JWT_REFRESH_SECRET devem ser diferentes entre si.');
  }

  if (issues.length > 0) {
    throw new InvalidEnvironmentError(issues, context);
  }

  return {
    jwtRefreshSecret: jwtRefreshSecret as string,
    jwtSecret: jwtSecret as string,
  };
}

export function getValidatedServerBootEnv() {
  const secrets = ensureValidJwtSecrets(env, 'boot do servidor');

  return {
    ...env,
    ...secrets,
  };
}

function validateJwtSecret(name: string, value: string | undefined, issues: string[]): void {
  if (!value) {
    issues.push(`${name} nao foi definido.`);
    return;
  }

  if (INSECURE_JWT_SECRET_VALUES.has(value)) {
    issues.push(
      `${name} usa um placeholder inseguro legado e precisa ser substituido por um valor real.`,
    );
  }

  if (value.length < MIN_JWT_SECRET_LENGTH) {
    issues.push(
      `${name} precisa ter ao menos ${MIN_JWT_SECRET_LENGTH} caracteres.`,
    );
  }
}
