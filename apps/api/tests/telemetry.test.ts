import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import {
  db,
  withSystemContext,
  users,
  operators,
  operatorMembers,
  buses,
  stops,
  routes,
  trips,
} from '@ruralbus/database';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 11: Real-Time GPS Telemetry & WebSockets Hub Integration Tests', () => {
  let app: FastifyInstance;

  // Tenant A Fixtures
  let operatorAId: string;
  let adminAToken: string;
  let driverAId: string;
  let driverAToken: string;
  let tripAId: string;
  let busAId: string;

  // Tenant B Fixtures
  let operatorBId: string;
  let driverBId: string;
  let driverBToken: string;

  // Passenger
  let passengerToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'KSRTC South Telemetry',
          businessCode: `ksrtc-tel-${Date.now()}`,
          contactEmail: 'telemetry@ksrtc.gov.in',
          contactPhone: '9876543501',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      // 2. Create Admin A
      const [adminA] = await tx
        .insert(users)
        .values({
          fullName: 'Admin A Telemetry',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `admin-tel-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();

      await tx.insert(operatorMembers).values({
        userId: adminA.id,
        tenantId: operatorAId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // 3. Create Driver A
      const [drA] = await tx
        .insert(users)
        .values({
          fullName: 'Driver A GPS',
          phone: `98722${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-tel-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverAId = drA.id;

      await tx.insert(operatorMembers).values({
        userId: drA.id,
        tenantId: operatorAId,
        role: 'DRIVER',
        isActive: true,
      });

      // 4. Create Bus A & Stops for Tenant A
      const [busA] = await tx
        .insert(buses)
        .values({
          tenantId: operatorAId,
          registrationNumber: `KA-09-TR-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus GPS',
          totalSeats: 35,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busAId = busA.id;

      const [stop1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Mysore Bus Stand',
          code: `MYS-T-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.3082,
          longitude: 76.6554,
          location: sql`ST_SetSRID(ST_MakePoint(76.6554, 12.3082), 4326)`,
        })
        .returning();

      const [stop2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Mandya Highway',
          code: `MDY-T-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.5242,
          longitude: 76.8958,
          location: sql`ST_SetSRID(ST_MakePoint(76.8958, 12.5242), 4326)`,
        })
        .returning();

      const [routeA] = await tx
        .insert(routes)
        .values({
          tenantId: operatorAId,
          routeCode: `RT-GPS-${Date.now().toString().slice(-4)}`,
          origin: 'Mysore Bus Stand',
          destination: 'Mandya Highway',
          totalDistanceKm: 42,
          estimatedDurationMinutes: 50,
          stopsData: [
            {
              stopId: stop1.id,
              stopName: stop1.name,
              sequenceNumber: 1,
              distanceFromStartKm: 0,
              estimatedMinutesFromStart: 0,
              fareFromStart: 0,
            },
            {
              stopId: stop2.id,
              stopName: stop2.name,
              sequenceNumber: 2,
              distanceFromStartKm: 42,
              estimatedMinutesFromStart: 50,
              fareFromStart: 50,
            },
          ],
          isActive: true,
        })
        .returning();

      // 5. Create Trip A
      const [tripA] = await tx
        .insert(trips)
        .values({
          tenantId: operatorAId,
          routeId: routeA.id,
          busId: busA.id,
          driverId: driverAId,
          departureTime: new Date(Date.now() + 3600 * 1000),
          scheduledArrival: new Date(Date.now() + 7200 * 1000),
          status: 'IN_TRANSIT',
          availableSeats: 35,
          totalSeats: 35,
        })
        .returning();
      tripAId = tripA.id;

      // 6. Create Tenant B with Driver B
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'NWKRTC Belgaum',
          businessCode: `nwkrtc-tel-${Date.now()}`,
          contactEmail: 'belgaum@nwkrtc.gov.in',
          contactPhone: '9876543502',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      const [drB] = await tx
        .insert(users)
        .values({
          fullName: 'Driver B NWKRTC',
          phone: `98733${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-nw-${Date.now()}@nwkrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverBId = drB.id;

      await tx.insert(operatorMembers).values({
        userId: drB.id,
        tenantId: operatorBId,
        role: 'DRIVER',
        isActive: true,
      });

      // Passenger User
      const [pass] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Telemetry',
          phone: `98744${Math.floor(10000 + Math.random() * 90000)}`,
          email: `passenger-tel-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();

      // Sign JWTs
      adminAToken = app.jwt.sign({
        sub: adminA.id,
        role: 'OPERATOR_ADMIN',
        tenantId: operatorAId,
      });

      driverAToken = app.jwt.sign({
        sub: driverAId,
        role: 'DRIVER',
        tenantId: operatorAId,
      });

      driverBToken = app.jwt.sign({
        sub: driverBId,
        role: 'DRIVER',
        tenantId: operatorBId,
      });

      passengerToken = app.jwt.sign({
        sub: pass.id,
        role: 'PASSENGER',
        tenantId: null,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GPS Ingestion & Live Querying', () => {
    it('Driver A successfully ingests valid GPS coordinates for assigned Trip A', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3500,
          longitude: 76.7000,
          speed: 48,
          heading: 65,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.tripLocation.latitude).toBe(12.35);
      expect(json.data.tripLocation.longitude).toBe(76.7);
      expect(json.data.tripLocation.speed).toBe(48);
    });

    it('Passenger queries public live GPS tracking for Trip A', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tracking/trip/${tripAId}`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.location).toBeDefined();
      expect(json.data.location.latitude).toBe(12.35);
      expect(json.data.location.longitude).toBe(76.7);
      expect(json.data.location.speed).toBe(48);
    });

    it('Operator Admin receives updated Live Fleet Radar snapshot', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/tracking/fleet',
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.buses.length).toBeGreaterThanOrEqual(1);
      const myBus = json.data.buses.find((b: any) => b.tripId === tripAId);
      expect(myBus).toBeDefined();
      expect(myBus.speed).toBe(48);
    });

    it('Driver B (unassigned / wrong tenant) is rejected from sending GPS ping for Trip A', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverBToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3500,
          longitude: 76.7000,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('Passenger is forbidden from sending Driver GPS pings (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3500,
          longitude: 76.7000,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('Driver A successfully ingests GPS coordinates with ISO string timestamp', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3550,
          longitude: 76.7050,
          speed: 52,
          heading: 70,
          timestamp: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(typeof json.data.tripLocation.timestamp).toBe('number');
    });

    it('Driver A successfully ingests GPS ping with nullish/omitted optional speed/heading fields (200 OK)', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3560,
          longitude: 76.7060,
          speed: null,
          heading: null,
          accuracy: null,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.tripLocation.speed).toBe(0);
      expect(json.data.tripLocation.heading).toBe(0);
    });

    it('Rejects invalid non-UUID tripId with 400 validation error', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: 'invalid-non-uuid-trip-id',
          latitude: 12.3500,
          longitude: 76.7000,
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details[0].field).toBe('tripId');
    });

    it('Rejects invalid latitude/longitude exceeding geographical bounds', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 120.5, // Invalid > 90
          longitude: 76.7000,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('Rejects future timestamp > 5 minutes with 400 validation error', async () => {
      const futureTime = Date.now() + 10 * 60 * 1000;
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3500,
          longitude: 76.7000,
          timestamp: futureTime,
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('Rejects past timestamp > 24 hours with 400 validation error', async () => {
      const pastTime = Date.now() - 48 * 60 * 60 * 1000;
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3500,
          longitude: 76.7000,
          timestamp: pastTime,
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('Passenger / Public query GET /api/v1/tracking/trip/:tripId returns 200 with freshness status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tracking/trip/${tripAId}`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.location).toBeDefined();
      expect(['LIVE', 'STALE', 'OFFLINE', 'NO_DATA']).toContain(json.data.freshness);
    });

    it('Rejects GPS ping when trip status is COMPLETED', async () => {
      await withSystemContext(async (tx) => {
        await tx.update(trips).set({ status: 'COMPLETED' }).where(sql`id = ${tripAId}`);
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.3500,
          longitude: 76.7000,
        },
      });

      expect(response.statusCode).toBe(400);
      const json = response.json();
      expect(json.error.message).toContain('GPS ping rejected');

      await withSystemContext(async (tx) => {
        await tx.update(trips).set({ status: 'IN_TRANSIT' }).where(sql`id = ${tripAId}`);
      });
    });

    it('Ignores out-of-order GPS ping (timestamp older than current location)', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const tNow = Date.now();

      // Send recent ping
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.4000,
          longitude: 76.7500,
          speed: 60,
          heading: 90,
          timestamp: tNow,
        },
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().data.tripLocation.latitude).toBe(12.4);

      // Send older ping (1 minute before tNow)
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverAToken}` },
        payload: {
          tripId: tripAId,
          latitude: 12.1111,
          longitude: 76.2222,
          speed: 20,
          heading: 10,
          timestamp: tNow - 60000,
        },
      });
      expect(res2.statusCode).toBe(200);
      // Location should NOT be overwritten by the older ping
      expect(res2.json().data.tripLocation.latitude).toBe(12.4);
      expect(res2.json().data.tripLocation.longitude).toBe(76.75);
    });

    it('Evicts live location cache when clearLiveTripCache is called', async () => {
      const { clearLiveTripCache } = await import('../src/services/telemetry.service.js');
      clearLiveTripCache(tripAId);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tracking/trip/${tripAId}`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.location).toBeNull();
      expect(json.data.freshness).toBe('NO_DATA');
    });
  });
});
