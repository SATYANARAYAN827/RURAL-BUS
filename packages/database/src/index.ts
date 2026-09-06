import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
export { sql } from 'drizzle-orm';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

export * from './schema/index.js';
export { assertResetAllowed } from './reset-guard.js';

export type DatabaseInstance = NodePgDatabase<typeof schema>;
export type DrizzleTransaction = Parameters<Parameters<DatabaseInstance['transaction']>[0]>[0];

let pool: pg.Pool | null = null;
let dbInstance: DatabaseInstance | null = null;

export function createDatabaseClient(connectionString?: string): DatabaseInstance {
  const url =
    connectionString ||
    process.env.DATABASE_URL ||
    'postgresql://ruralbus_app:app_secure_password@localhost:5432/ruralbus';

  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }

  if (!dbInstance) {
    dbInstance = drizzle(pool, { schema });
  }

  return dbInstance;
}

export const db: DatabaseInstance = createDatabaseClient();

/**
 * Executes an operation inside a PostgreSQL transaction with tenant isolation.
 * Uses `is_local = true` so `app.current_tenant_id` is automatically cleared on COMMIT/ROLLBACK,
 * preventing any cross-tenant context leaks across pooled connections.
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  if (!tenantId) {
    throw new Error('Tenant ID must be provided for tenant-isolated operation');
  }

  return db.transaction(async (tx: DrizzleTransaction) => {
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`
    );
    await tx.execute(
      sql`SELECT set_config('app.bypass_rls', 'off', true)`
    );
    return callback(tx);
  });
}

/**
 * Executes an operation inside a PostgreSQL transaction with administrative system context (bypassing RLS).
 * Used exclusively for administrative migrations, seeds, and initial authentication credential lookups.
 */
export async function withSystemContext<T>(
  callback: (tx: DrizzleTransaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx: DrizzleTransaction) => {
    await tx.execute(
      sql`SELECT set_config('app.bypass_rls', 'on', true)`
    );
    return callback(tx);
  });
}
