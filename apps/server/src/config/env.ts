import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  colyseusPort: Number(process.env.COLYSEUS_PORT ?? 2567),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgresql://cs_rio:cs_rio_dev@localhost:5433/cs_rio',
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6380',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
};
