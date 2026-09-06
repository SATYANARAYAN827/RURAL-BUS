import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { eq } from 'drizzle-orm';
import {
  withSystemContext,
  users,
  operators,
  operatorMembers,
  buses,
  routes,
  trips,
  stops,
  assertResetAllowed,
} from '@ruralbus/database';
import { hashPassword } from '../src/services/password.service.js';

describe('Hardened Authorization Boundaries & Multi-Tenant Security Tests', () => {
  let app: FastifyInstance;

  // Tenant A Fixtures
  let operatorAId: string;
  let adminAToken: string;
  let driverAId: string;
  let driverAToken: string;
  let conductorAId: string;
  let conductorAToken: string;
  let busAId: string;
  let busAPendingId: string;
  let routeAId: string;

  // Tenant B Fixtures
  let operatorBId: string;
  let adminBToken: string;
  let driverBId: string;
  let driverBToken: string;
  let conductorBId: string;
  let conductorBToken: string;
  let busBId: string;

  // Roles without management authority
  let passengerToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'Auth-Test KSRTC Division',
          businessCode: `auth-op-a-${Date.now()}`,
          contactEmail: 'ksrtc-auth@gov.in',
          contactPhone: '9811100001',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      // Operator A Admin
      const [userA] = await tx
        .insert(users)
        .values({
          fullName: 'Owner A Admin',
          phone: `911${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `ownerA-${Date.now()}@ruralbus.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      await tx.insert(operatorMembers).values({
        userId: userA.id,
        tenantId: operatorAId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // Operator A Driver
      const [drvA] = await tx
        .insert(users)
        .values({
          fullName: 'Driver A',
          phone: `912${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `driverA-${Date.now()}@ruralbus.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverAId = drvA.id;
      await tx.insert(operatorMembers).values({
        userId: drvA.id,
        tenantId: operatorAId,
        role: 'DRIVER',
        isActive: true,
      });

      // Operator A Conductor
      const [cndA] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor A',
          phone: `913${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `conductorA-${Date.now()}@ruralbus.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      conductorAId = cndA.id;
      await tx.insert(operatorMembers).values({
        userId: cndA.id,
        tenantId: operatorAId,
        role: 'CONDUCTOR',
        isActive: true,
      });

      // Operator A Active Bus
      const [bA] = await tx
        .insert(buses)
        .values({
          tenantId: operatorAId,
          registrationNumber: `KA-AUTH-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Marcopolo',
          totalSeats: 35,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busAId = bA.id;

      // Operator A Pending Bus
      const [bAPending] = await tx
        .insert(buses)
        .values({
          tenantId: operatorAId,
          registrationNumber: `KA-PEND-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland Viking',
          totalSeats: 40,
          seatingType: 'SEATER_2X2',
          status: 'PENDING_APPROVAL',
        })
        .returning();
      busAPendingId = bAPending.id;

      // Operator A Stops & Route
      const [stop1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Hubli Central Terminal',
          code: `HBL-${Date.now().toString().slice(-4)}`,
          latitude: 15.3647,
          longitude: 75.1240,
        })
        .returning();
      const [stop2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Dharwad Old Bus Stand',
          code: `DWD-${Date.now().toString().slice(-4)}`,
          latitude: 15.4589,
          longitude: 75.0078,
        })
        .returning();

      const [rtA] = await tx
        .insert(routes)
        .values({
          tenantId: operatorAId,
          routeCode: `RT-HD-${Date.now().toString().slice(-4)}`,
          origin: stop1.name,
          destination: stop2.name,
          totalDistanceKm: 22,
          estimatedDurationMinutes: 45,
          stopsData: [
            { stopId: stop1.id, stopName: stop1.name, sequenceNumber: 1, distanceFromStartKm: 0, estimatedMinutesFromStart: 0 },
            { stopId: stop2.id, stopName: stop2.name, sequenceNumber: 2, distanceFromStartKm: 22, estimatedMinutesFromStart: 45 },
          ],
        })
        .returning();
      routeAId = rtA.id;

      // 2. Create Operator B
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'Auth-Test NWKRTC Division',
          businessCode: `auth-op-b-${Date.now()}`,
          contactEmail: 'nwkrtc-auth@gov.in',
          contactPhone: '9811100002',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      // Operator B Admin
      const [userB] = await tx
        .insert(users)
        .values({
          fullName: 'Owner B Admin',
          phone: `921${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `ownerB-${Date.now()}@ruralbus.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      await tx.insert(operatorMembers).values({
        userId: userB.id,
        tenantId: operatorBId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // Operator B Driver
      const [drvB] = await tx
        .insert(users)
        .values({
          fullName: 'Driver B',
          phone: `922${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `driverB-${Date.now()}@ruralbus.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverBId = drvB.id;
      await tx.insert(operatorMembers).values({
        userId: drvB.id,
        tenantId: operatorBId,
        role: 'DRIVER',
        isActive: true,
      });

      // Operator B Conductor
      const [cndB] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor B',
          phone: `923${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `conductorB-${Date.now()}@ruralbus.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      conductorBId = cndB.id;
      await tx.insert(operatorMembers).values({
        userId: cndB.id,
        tenantId: operatorBId,
        role: 'CONDUCTOR',
        isActive: true,
      });

      // Operator B Active Bus
      const [bB] = await tx
        .insert(buses)
        .values({
          tenantId: operatorBId,
          registrationNumber: `KA-OPB-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Eicher Starline',
          totalSeats: 32,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busBId = bB.id;

      // 3. Create Passenger
      const [passUser] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Test User',
          phone: `931${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `passenger-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();

      // Sign JWT Tokens
      adminAToken = app.jwt.sign({ sub: userA.id, role: 'OPERATOR_ADMIN', tenantId: operatorAId });
      driverAToken = app.jwt.sign({ sub: drvA.id, role: 'DRIVER', tenantId: operatorAId });
      conductorAToken = app.jwt.sign({ sub: cndA.id, role: 'CONDUCTOR', tenantId: operatorAId });

      adminBToken = app.jwt.sign({ sub: userB.id, role: 'OPERATOR_ADMIN', tenantId: operatorBId });
      driverBToken = app.jwt.sign({ sub: drvB.id, role: 'DRIVER', tenantId: operatorBId });
      conductorBToken = app.jwt.sign({ sub: cndB.id, role: 'CONDUCTOR', tenantId: operatorBId });

      passengerToken = app.jwt.sign({ sub: passUser.id, role: 'PASSENGER' });
      superAdminToken = app.jwt.sign({ sub: 'super-admin-uuid', role: 'PLATFORM_ADMIN' });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // 1. Database Reset Safety Tests
  // =========================================================================
  describe('Rule 8: Database Reset Production Safeguard', () => {
    it('reset-db production safeguard is enforced in production environment', () => {
      const originalEnv = process.env.NODE_ENV;
      const originalOverride = process.env.ALLOW_PRODUCTION_RESET;
      try {
        delete process.env.ALLOW_PRODUCTION_RESET;
        expect(() => assertResetAllowed('production')).toThrow(
          /CRITICAL SAFETY ERROR: Database reset is strictly prohibited in production/
        );
      } finally {
        if (originalEnv) process.env.NODE_ENV = originalEnv;
        if (originalOverride) process.env.ALLOW_PRODUCTION_RESET = originalOverride;
      }
    });

    it('reset-db allows execution when ALLOW_PRODUCTION_RESET=true override is explicit', () => {
      process.env.ALLOW_PRODUCTION_RESET = 'true';
      expect(() => assertResetAllowed('production')).not.toThrow();
      delete process.env.ALLOW_PRODUCTION_RESET;
    });

    it('reset-db allows normal execution in development/test', () => {
      expect(() => assertResetAllowed('development')).not.toThrow();
      expect(() => assertResetAllowed('test')).not.toThrow();
    });
  });

  // =========================================================================
  // 2. Bus Ownership & Mutation Security Tests
  // =========================================================================
  describe('Rule 3: Bus Ownership & Cross-Tenant Isolation', () => {
    it('owner A cannot access/mutate owner B\'s bus via PUT update', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busBId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { model: 'Hijacked Model Name' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Cannot access or mutate a bus belonging to another operator/);
    });

    it('owner A cannot delete owner B\'s bus', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/operator/buses/${busBId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Cannot access or mutate a bus belonging to another operator/);
    });

    it('owner A cannot register a bus under owner B\'s tenantId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          tenantId: operatorBId,
          registrationNumber: `KA-CROSS-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Cross-Tenant Exploit Bus',
          totalSeats: 30,
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Cannot register a bus for another operator/);
    });

    it('driver/conductor cannot mutate fleet records', async () => {
      const resDriver = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          registrationNumber: 'KA-DRV-0001',
          model: 'Driver Injected Bus',
          totalSeats: 30,
        },
      });
      expect(resDriver.statusCode).toBe(403);

      const resConductor = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAId}`,
        headers: { authorization: `Bearer ${conductorAToken}` },
        payload: { model: 'Conductor Mutated Bus' },
      });
      expect(resConductor.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 3. Bus Approval Security Tests
  // =========================================================================
  describe('Rule 1: Bus Approval Exclusivity & State Transitions', () => {
    it('non-admin (driver, conductor, passenger) cannot approve a bus', async () => {
      const resDriver = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}/approve`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });
      expect(resDriver.statusCode).toBe(403);

      const resConductor = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}/approve`,
        headers: { authorization: `Bearer ${conductorAToken}` },
      });
      expect(resConductor.statusCode).toBe(403);

      const resPassenger = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}/approve`,
        headers: { authorization: `Bearer ${passengerToken}` },
      });
      expect(resPassenger.statusCode).toBe(403);
    });

    it('owner cannot approve a bus directly via approve endpoint', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}/approve`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('owner cannot activate a pending bus via updateBus()', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { status: 'ACTIVE' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Only PLATFORM_ADMIN may approve buses/);
    });

    it('nonexistent bus returns 404 on approval attempt', async () => {
      const fakeBusId = '00000000-0000-0000-0000-000000000099';
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${fakeBusId}/approve`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('platform admin can approve a pending bus', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}/approve`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data?.bus?.status).toBe('ACTIVE');
    });

    it('already approved/ACTIVE bus cannot be approved again', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busAPendingId}/approve`,
        headers: { authorization: `Bearer ${superAdminToken}` },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Bus is already 'ACTIVE', not pending approval/);
    });
  });

  // =========================================================================
  // 4. Staff Ownership & Isolation Tests
  // =========================================================================
  describe('Rule 2: Staff Ownership Isolation', () => {
    let staffBMemberId: string;

    beforeAll(async () => {
      // Find Member ID for Driver B
      await withSystemContext(async (tx) => {
        const [mem] = await tx
          .select({ id: operatorMembers.id })
          .from(operatorMembers)
          .where(eq(operatorMembers.userId, driverBId));
        staffBMemberId = mem.id;
      });
    });

    it('owner A cannot access/mutate owner B\'s staff status', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/staff/${staffBMemberId}/status`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { isActive: false },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Cannot modify staff belonging to another operator/);
    });

    it('owner A cannot reset password of owner B\'s staff', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/operator/staff/${staffBMemberId}/reset-password`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: { newPassword: 'HackedPassword123!' },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Cannot modify staff belonging to another operator/);
    });

    it('driver/conductor/passenger cannot provision or modify staff', async () => {
      const resDriver = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/staff',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          fullName: 'Malicious Driver',
          phone: '9998887776',
          role: 'DRIVER',
          password: 'Password123!',
        },
      });
      expect(resDriver.statusCode).toBe(403);

      const resPassenger = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/staff',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: {
          fullName: 'Malicious Driver',
          phone: '9998887775',
          role: 'DRIVER',
          password: 'Password123!',
        },
      });
      expect(resPassenger.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 5. Trip Dispatching Rules Tests
  // =========================================================================
  describe('Rule 4: Trip Dispatch Authorization & Invariants', () => {
    let pendingBusAId: string;

    beforeAll(async () => {
      // Create another pending bus for dispatch testing
      await withSystemContext(async (tx) => {
        const [b] = await tx
          .insert(buses)
          .values({
            tenantId: operatorAId,
            registrationNumber: `KA-DISP-PEND-${Math.floor(1000 + Math.random() * 9000)}`,
            model: 'Pending Bus Model',
            totalSeats: 30,
            seatingType: 'SEATER_2X2',
            status: 'PENDING_APPROVAL',
          })
          .returning();
        pendingBusAId = b.id;
      });
    });

    it('pending bus cannot be dispatched', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: pendingBusAId,
          driverId: driverAId,
          conductorId: conductorAId,
          departureTime,
          scheduledArrival,
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/is pending approval and cannot be dispatched/);
    });

    it('owner A cannot dispatch owner B\'s bus', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busBId,
          driverId: driverAId,
          departureTime,
          scheduledArrival,
        },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Cannot dispatch a bus belonging to another operator/);
    });

    it('owner A cannot assign owner B\'s driver', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busAId,
          driverId: driverBId,
          departureTime,
          scheduledArrival,
        },
      });
      expect([400, 403]).toContain(res.statusCode);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/driver/i);
    });

    it('owner A cannot assign owner B\'s conductor', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busAId,
          driverId: driverAId,
          conductorId: conductorBId,
          departureTime,
          scheduledArrival,
        },
      });
      expect([400, 403]).toContain(res.statusCode);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/conductor/i);
    });

    it('driver/conductor/passenger cannot dispatch trips', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      const payload = {
        routeId: routeAId,
        busId: busAId,
        departureTime,
        scheduledArrival,
      };

      const resDrv = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload,
      });
      expect(resDrv.statusCode).toBe(403);

      const resPass = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload,
      });
      expect(resPass.statusCode).toBe(403);
    });

    it('duplicate active trip for same bus is rejected', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      // 1. Dispatch first trip
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busAId,
          driverId: driverAId,
          departureTime,
          scheduledArrival,
        },
      });
      expect(res1.statusCode).toBe(201);

      // 2. Try to dispatch second trip with same bus
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busAId,
          departureTime,
          scheduledArrival,
        },
      });
      expect(res2.statusCode).toBe(409);
      const body = JSON.parse(res2.payload);
      expect(body.error?.message).toMatch(/already has an active trip in progress/);
    });

    it('duplicate active trip for same driver is rejected', async () => {
      const departureTime = new Date(Date.now() + 3600000).toISOString();
      const scheduledArrival = new Date(Date.now() + 7200000).toISOString();

      // Create a second active bus for Operator A so bus conflict does not trigger
      let busA2Id: string;
      await withSystemContext(async (tx) => {
        const [b] = await tx
          .insert(buses)
          .values({
            tenantId: operatorAId,
            registrationNumber: `KA-SECOND-${Math.floor(1000 + Math.random() * 9000)}`,
            model: 'Second Active Bus',
            totalSeats: 35,
            seatingType: 'SEATER_2X2',
            status: 'ACTIVE',
          })
          .returning();
        busA2Id = b.id;
      });

      // Try to dispatch with driverA who is already assigned to the trip above
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busA2Id!,
          driverId: driverAId,
          departureTime,
          scheduledArrival,
        },
      });
      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/Driver already has an active trip in progress/);
    });
  });

  // =========================================================================
  // 6. Driver Trip Lifecycle Security Tests
  // =========================================================================
  describe('Rule 5: Driver Trip Lifecycle Authorization', () => {
    let tripAId: string;

    beforeAll(async () => {
      // Find the active trip assigned to Driver A
      await withSystemContext(async (tx) => {
        const [t] = await tx
          .select({ id: trips.id })
          .from(trips)
          .where(eq(trips.driverId, driverAId))
          .limit(1);
        tripAId = t.id;
      });
    });

    it('driver cannot start another driver\'s trip (returns 403)', async () => {
      // Driver B attempts to start Driver A's trip
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/start`,
        headers: { authorization: `Bearer ${driverBToken}` },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/not the designated driver/);
    });

    it('driver cannot end another driver\'s trip (returns 403)', async () => {
      // Driver B attempts to end Driver A's trip
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/end`,
        headers: { authorization: `Bearer ${driverBToken}` },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/not the designated driver/);
    });

    it('assigned driver can successfully start their designated trip', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/start`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data?.trip?.status).toBe('IN_TRANSIT');
    });
  });

  // =========================================================================
  // 7. Conductor Duty Authorization Tests
  // =========================================================================
  describe('Rule 6: Conductor Duty Authorization', () => {
    let tripAId: string;

    beforeAll(async () => {
      // Find trip where Conductor A is assigned
      await withSystemContext(async (tx) => {
        const [t] = await tx
          .select({ id: trips.id })
          .from(trips)
          .where(eq(trips.tenantId, operatorAId))
          .limit(1);
        // Ensure trip has conductorA assigned
        await tx.update(trips).set({ conductorId: conductorAId }).where(eq(trips.id, t.id));
        tripAId = t.id;
      });
    });

    it('conductor cannot operate another conductor\'s trip manifest (returns 403)', async () => {
      // Conductor B attempts to view Conductor A's manifest
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conductor/manifest/${tripAId}`,
        headers: { authorization: `Bearer ${conductorBToken}` },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/not the designated conductor/);
    });

    it('conductor cannot board passenger on another conductor\'s trip (returns 403)', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: `/api/v1/conductor/manifest/${tripAId}/board/00000000-0000-0000-0000-000000000001`,
        headers: { authorization: `Bearer ${conductorBToken}` },
        payload: { isBoarded: true },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/not the designated conductor/);
    });

    it('conductor cannot access offline manifest of another conductor\'s trip (returns 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/manifest/offline/${tripAId}`,
        headers: { authorization: `Bearer ${conductorBToken}` },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/not authorized|not the designated conductor/);
    });

    it('conductor cannot access cash settlement of another conductor\'s trip (returns 403)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/conductor/cash-settlement/${tripAId}`,
        headers: { authorization: `Bearer ${conductorBToken}` },
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error?.message).toMatch(/not authorized|not the designated conductor/);
    });
  });
});
