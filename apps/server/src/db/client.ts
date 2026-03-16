import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '../config/env.js';

const pool = new Pool({
  connectionString: env.databaseUrl,
});

export const db = drizzle(pool);
export { pool };
export type DatabaseClient = typeof db;
export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DatabaseExecutor = DatabaseClient | DatabaseTransaction;
