import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { db, withTenant, withSystemContext } from '@ruralbus/database';
import * as schema from '@ruralbus/database';
import { hashPassword } from '../src/services/password.service.js';
import { closeRedis } from '../src/services/redis.service.js';

describe('Phase 5: Multi-Tenant Ingress & Fastify RLS Integration Tests', () => {
  let app: FastifyInstance;
  let tenantAId: string;
  let tenantBId: string;
  let tokenA: string;
  let tokenB: string;
  let tokenPassenger: string;
  let busAId: string;
  let busBId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const hashedPassword = await hashPassword('TenantTestPass@123');

    let emailA = '';
    let emailB = '';
    let emailP = '';

    // 1. Create Operators Alpha and Beta & Users
    await withSystemContext(async (tx) => {
      const [opA] = await tx
        .insert(schema.operators)
        .values({
          companyName: 'Alpha Transit Corp',
          businessCode: `ALPHA-${Date.now()}`,
          contactEmail: 'alpha@transit.test',
          contactPhone: '9311111111',
          status: 'ACTIVE',
        })
        .returning();
      tenantAId = opA.id;

      const [opB] = await tx
        .insert(schema.operators)
        .values({
          companyName: 'Beta Transit Corp',
          businessCode: `BETA-${Date.now()}`,
          contactEmail: 'beta@transit.test',
          contactPhone: '9322222222',
          status: 'ACTIVE',
        })
        .returning();
      tenantBId = opB.id;

      emailA = `admin.alpha.${Date.now()}@test.com`;
      emailB = `admin.beta.${Date.now()}@test.com`;
      emailP = `passenger.${Date.now()}@test.com`;

      // 2. Create Users
      const [userAdminA] = await tx
        .insert(schema.users)
        .values({
          fullName: 'Admin Alpha',
          email: emailA,
          phone: `933${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      const [userAdminB] = await tx
        .insert(schema.users)
        .values({
          fullName: 'Admin Beta',
          email: emailB,
          phone: `934${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      const [userPassenger] = await tx
        .insert(schema.users)
        .values({
          fullName: 'Tenant Test Passenger',
          email: emailP,
          phone: `935${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      // 3. Assign Memberships
      await tx.insert(schema.operatorMembers).values([
        { userId: userAdminA.id, tenantId: tenantAId, role: 'OPERATOR_ADMIN' },
        { userId: userAdminB.id, tenantId: tenantBId, role: 'OPERATOR_ADMIN' },
      ]);
    });

    // 4. Authenticate Users via login route
    const loginA = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: emailA, password: 'TenantTestPass@123' },
    });
    tokenA = JSON.parse(loginA.body).data.tokens.accessToken;

    const loginB = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: emailB, password: 'TenantTestPass@123' },
    });
    tokenB = JSON.parse(loginB.body).data.tokens.accessToken;

    const loginP = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: emailP, password: 'TenantTestPass@123' },
    });
    tokenPassenger = JSON.parse(loginP.body).data.tokens.accessToken;

    // 5. Create Buses under respective tenants
    await withTenant(tenantAId, async (tx) => {
      const [busA] = await tx
        .insert(schema.buses)
        .values({
          tenantId: tenantAId,
          registrationNumber: `KA-ALPHA-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Volvo B11R Alpha Fleet',
          totalSeats: 45,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busAId = busA.id;
    });

    await withTenant(tenantBId, async (tx) => {
      const [busB] = await tx
        .insert(schema.buses)
        .values({
          tenantId: tenantBId,
          registrationNumber: `KA-BETA-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Scania Metrolink Beta Fleet',
          totalSeats: 40,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busBId = busB.id;
    });
  });

  afterAll(async () => {
    await app.close();
    await closeRedis();
  });

  describe('GET /api/v1/tenant/context', () => {
    it('should return verified server-side tenant context for Operator Admin A', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/context',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.tenant.tenantId).toBe(tenantAId);
      expect(body.data.tenant.role).toBe('OPERATOR_ADMIN');
    });

    it('should return verified server-side tenant context for Operator Admin B', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/context',
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.tenant.tenantId).toBe(tenantBId);
      expect(body.data.tenant.role).toBe('OPERATOR_ADMIN');
    });

    it('should reject Passenger from accessing tenant-scoped endpoints with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/context',
        headers: { authorization: `Bearer ${tokenPassenger}` },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should reject unauthenticated request with 401 Unauthorized', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/context',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/tenant/buses & Cross-Tenant Isolation', () => {
    it('should return ONLY Tenant Alpha buses for Admin Alpha', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/buses',
        headers: { authorization: `Bearer ${tokenA}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      const buses = body.data.buses;
      expect(buses.length).toBeGreaterThanOrEqual(1);
      expect(buses.every((b: { tenantId: string }) => b.tenantId === tenantAId)).toBe(true);
      expect(buses.some((b: { id: string }) => b.id === busAId)).toBe(true);
      expect(buses.some((b: { id: string }) => b.id === busBId)).toBe(false);
    });

    it('should return ONLY Tenant Beta buses for Admin Beta', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/buses',
        headers: { authorization: `Bearer ${tokenB}` },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      const buses = body.data.buses;
      expect(buses.length).toBeGreaterThanOrEqual(1);
      expect(buses.every((b: { tenantId: string }) => b.tenantId === tenantBId)).toBe(true);
      expect(buses.some((b: { id: string }) => b.id === busBId)).toBe(true);
      expect(buses.some((b: { id: string }) => b.id === busAId)).toBe(false);
    });

    it('Anti-Spoofing: should ignore client-supplied x-tenant-id header and strictly enforce JWT tenant', async () => {
      // Admin Alpha attempts to spoof Tenant B by supplying x-tenant-id: tenantBId
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/tenant/buses',
        headers: {
          authorization: `Bearer ${tokenA}`,
          'x-tenant-id': tenantBId, // Spoofed header
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      const buses = body.data.buses;
      // Must STILL only return Tenant Alpha's buses
      expect(buses.every((b: { tenantId: string }) => b.tenantId === tenantAId)).toBe(true);
      expect(buses.some((b: { id: string }) => b.id === busBId)).toBe(false);
    });

    it('Connection Pool Safety: Interleaved concurrent requests between Tenant A and B must maintain absolute isolation', async () => {
      const requests = Array.from({ length: 20 }, (_, i) => {
        const isAlpha = i % 2 === 0;
        return app.inject({
          method: 'GET',
          url: '/api/v1/tenant/buses',
          headers: { authorization: `Bearer ${isAlpha ? tokenA : tokenB}` },
        }).then((res) => {
          const body = JSON.parse(res.body);
          const expectedTenantId = isAlpha ? tenantAId : tenantBId;
          const unexpectedBusId = isAlpha ? busBId : busAId;
          const buses = body.data.buses;

          expect(res.statusCode).toBe(200);
          expect(buses.every((b: { tenantId: string }) => b.tenantId === expectedTenantId)).toBe(true);
          expect(buses.some((b: { id: string }) => b.id === unexpectedBusId)).toBe(false);
        });
      });

      await Promise.all(requests);
    });
  });
});
