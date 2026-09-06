import { describe, it, expect } from 'vitest';
import { db, withTenant, sql } from '../src/index.js';
import * as schema from '../src/schema/index.js';

describe('withTenant Transaction Isolation', () => {
  it('should set app.current_tenant_id inside transaction and clear it outside', async () => {
    const [operator] = await db.select().from(schema.operators).limit(1);
    expect(operator).toBeDefined();

    const result = await withTenant(operator.id, async (tx) => {
      const txResult = await tx.execute<{ setting: string }>(
        sql`SELECT current_setting('app.current_tenant_id', true) as setting;`
      );
      return txResult.rows[0]?.setting;
    });

    // Verified set inside transaction
    expect(result).toBe(operator.id);

    // Outside transaction, NULLIF(current_setting('app.current_tenant_id', true), '') must be null
    const outsideResult = await db.execute<{ setting: string | null }>(
      sql`SELECT NULLIF(current_setting('app.current_tenant_id', true), '') as setting;`
    );
    expect(outsideResult.rows[0]?.setting).toBeNull();
  });

  it('should throw error if tenantId is omitted', async () => {
    await expect(
      withTenant('', async () => {
        return Promise.resolve(true);
      })
    ).rejects.toThrow('Tenant ID must be provided');
  });
});
