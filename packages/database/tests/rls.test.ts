import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, withTenant, withSystemContext } from '../src/index.js';
import * as schema from '../src/schema/index.js';
import { eq } from 'drizzle-orm';

describe('PostgreSQL Row-Level Security (RLS) & Multi-Tenant Isolation', () => {
  let tenantAId: string;
  let tenantBId: string;
  let busAId: string;
  let busBId: string;

  beforeAll(async () => {
    // Setup test operators and fleet in system context
    await withSystemContext(async (tx) => {
      const [opA] = await tx
        .insert(schema.operators)
        .values({
          companyName: 'RLS Tenant Alpha',
          businessCode: `RLS-A-${Date.now()}`,
          contactEmail: 'alpha@rls.test',
          contactPhone: '9111111111',
          status: 'ACTIVE',
        })
        .returning();
      tenantAId = opA.id;

      const [opB] = await tx
        .insert(schema.operators)
        .values({
          companyName: 'RLS Tenant Beta',
          businessCode: `RLS-B-${Date.now()}`,
          contactEmail: 'beta@rls.test',
          contactPhone: '9222222222',
          status: 'ACTIVE',
        })
        .returning();
      tenantBId = opB.id;
    });

    // Insert Bus A in Tenant A context
    await withTenant(tenantAId, async (tx) => {
      const [busA] = await tx
        .insert(schema.buses)
        .values({
          tenantId: tenantAId,
          registrationNumber: `KA-01-A-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland Viking',
          totalSeats: 35,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busAId = busA.id;
    });

    // Insert Bus B in Tenant B context
    await withTenant(tenantBId, async (tx) => {
      const [busB] = await tx
        .insert(schema.buses)
        .values({
          tenantId: tenantBId,
          registrationNumber: `KA-02-B-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Eicher Starline 32-Seater',
          totalSeats: 32,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busBId = busB.id;
    });
  });

  it('Default-Deny: Direct query without tenant context must return zero rows for RLS tables', async () => {
    // Un-isolated query without withTenant
    const buses = await db.select().from(schema.buses);
    expect(buses).toHaveLength(0);
  });

  it('Tenant A context must only see Tenant A rows and 0 rows of Tenant B', async () => {
    const buses = await withTenant(tenantAId, async (tx) => {
      return tx.select().from(schema.buses);
    });

    expect(buses.length).toBeGreaterThanOrEqual(1);
    expect(buses.every((b) => b.tenantId === tenantAId)).toBe(true);
    expect(buses.some((b) => b.id === busAId)).toBe(true);
    expect(buses.some((b) => b.id === busBId)).toBe(false);
  });

  it('Tenant B context must only see Tenant B rows and 0 rows of Tenant A', async () => {
    const buses = await withTenant(tenantBId, async (tx) => {
      return tx.select().from(schema.buses);
    });

    expect(buses.length).toBeGreaterThanOrEqual(1);
    expect(buses.every((b) => b.tenantId === tenantBId)).toBe(true);
    expect(buses.some((b) => b.id === busBId)).toBe(true);
    expect(buses.some((b) => b.id === busAId)).toBe(false);
  });

  it('WITH CHECK constraint: Attempting to insert a row for Tenant B while in Tenant A context must fail', async () => {
    await expect(
      withTenant(tenantAId, async (tx) => {
        return tx.insert(schema.buses).values({
          tenantId: tenantBId, // Cross-tenant spoof
          registrationNumber: `KA-99-SPOOF-${Date.now().toString().slice(-4)}`,
          model: 'Spoof Bus',
          totalSeats: 20,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        });
      })
    ).rejects.toThrow();
  });

  it('Cross-tenant mutation: Tenant A cannot update records belonging to Tenant B', async () => {
    const updateResult = await withTenant(tenantAId, async (tx) => {
      return tx
        .update(schema.buses)
        .set({ model: 'Hacked Model' })
        .where(eq(schema.buses.id, busBId))
        .returning();
    });

    // Must return empty array because Tenant B's bus is invisible to Tenant A
    expect(updateResult).toHaveLength(0);

    // Verify Tenant B's bus model remained unchanged
    const [busB] = await withTenant(tenantBId, async (tx) => {
      return tx.select().from(schema.buses).where(eq(schema.buses.id, busBId));
    });
    expect(busB.model).toBe('Eicher Starline 32-Seater');
  });

  it('Cross-tenant deletion: Tenant A cannot delete records belonging to Tenant B', async () => {
    const deleteResult = await withTenant(tenantAId, async (tx) => {
      return tx
        .delete(schema.buses)
        .where(eq(schema.buses.id, busBId))
        .returning();
    });

    expect(deleteResult).toHaveLength(0);

    // Verify Tenant B's bus still exists
    const [busB] = await withTenant(tenantBId, async (tx) => {
      return tx.select().from(schema.buses).where(eq(schema.buses.id, busBId));
    });
    expect(busB).toBeDefined();
    expect(busB.id).toBe(busBId);
  });
});
