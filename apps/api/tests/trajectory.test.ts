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
  tripTrajectories,
} from '@ruralbus/database';
import { sql, eq } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 16: Downsampled GPS Trajectory Storage Integration Tests', () => {
  let app: FastifyInstance;

  // Tenant A
  let operatorAId: string;
  let adminAToken: string;
  let driverAId: string;
  let driverAToken: string;
  let tripAId: string;

  // Tenant B
  let operatorBId: string;
  let adminBToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator A & Admin A & Driver A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'Hubli Urban & Rural Transit',
          businessCode: `hub-traj-${Date.now()}`,
          contactEmail: 'trajectory@hubli.gov.in',
          contactPhone: '9876543001',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      const [admA] = await tx
        .insert(users)
        .values({
          fullName: 'Admin A Hubli',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `admin-hub-${Date.now()}@hubli.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();

      await tx.insert(operatorMembers).values({
        userId: admA.id,
        tenantId: operatorAId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      const [drA] = await tx
        .insert(users)
        .values({
          fullName: 'Driver A Hubli',
          phone: `98722${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-hub-${Date.now()}@hubli.gov.in`,
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

      // 2. Create Bus & Stops & Route
      const [bus] = await tx
        .insert(buses)
        .values({
          tenantId: operatorAId,
          registrationNumber: `KA-25-TR-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland 40',
          totalSeats: 40,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();

      const [st1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Hubli Old Bus Stand',
          code: `HBL-O-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 15.3647,
          longitude: 75.1240,
          location: sql`ST_SetSRID(ST_MakePoint(75.1240, 15.3647), 4326)`,
        })
        .returning();

      const [st2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Dharwad City Stand',
          code: `DWD-C-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 15.4589,
          longitude: 75.0078,
          location: sql`ST_SetSRID(ST_MakePoint(75.0078, 15.4589), 4326)`,
        })
        .returning();

      const [route] = await tx
        .insert(routes)
        .values({
          tenantId: operatorAId,
          routeCode: `RT-HBL-${Date.now().toString().slice(-4)}`,
          origin: 'Hubli Old Bus Stand',
          destination: 'Dharwad City Stand',
          totalDistanceKm: 22,
          estimatedDurationMinutes: 35,
          stopsData: [
            {
              stopId: st1.id,
              stopName: st1.name,
              sequenceNumber: 1,
              distanceFromStartKm: 0,
              estimatedMinutesFromStart: 0,
              fareFromStart: 0,
            },
            {
              stopId: st2.id,
              stopName: st2.name,
              sequenceNumber: 2,
              distanceFromStartKm: 22,
              estimatedMinutesFromStart: 35,
              fareFromStart: 30,
            },
          ],
          isActive: true,
        })
        .returning();

      // 3. Create Trip A
      const [trip] = await tx
        .insert(trips)
        .values({
          tenantId: operatorAId,
          routeId: route.id,
          busId: bus.id,
          driverId: driverAId,
          departureTime: new Date(Date.now() + 1800 * 1000),
          scheduledArrival: new Date(Date.now() + 5400 * 1000),
          status: 'SCHEDULED',
          availableSeats: 40,
          totalSeats: 40,
        })
        .returning();
      tripAId = trip.id;

      // 4. Create Tenant B
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'Gadag Lines',
          businessCode: `gdg-traj-${Date.now()}`,
          contactEmail: 'trajectory@gadag.gov.in',
          contactPhone: '9876543002',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      const [admB] = await tx
        .insert(users)
        .values({
          fullName: 'Admin B Gadag',
          phone: `98733${Math.floor(10000 + Math.random() * 90000)}`,
          email: `admin-gdg-${Date.now()}@gadag.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();

      await tx.insert(operatorMembers).values({
        userId: admB.id,
        tenantId: operatorBId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      adminAToken = app.jwt.sign({
        sub: admA.id,
        role: 'OPERATOR_ADMIN',
        tenantId: operatorAId,
      });

      driverAToken = app.jwt.sign({
        sub: driverAId,
        role: 'DRIVER',
        tenantId: operatorAId,
      });

      adminBToken = app.jwt.sign({
        sub: admB.id,
        role: 'OPERATOR_ADMIN',
        tenantId: operatorBId,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GPS Telemetry Buffer & RDP Compression Pipeline', () => {
    it('Driver starts trip, streams high-frequency GPS points, and ends trip', async () => {
      // 1. Start Trip
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/start`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });
      expect(startRes.statusCode).toBe(200);

      // 2. Stream 6 high-density GPS coordinates along Hubli-Dharwad corridor
      const testCoordinates = [
        { latitude: 15.3647, longitude: 75.1240, speed: 20 },
        { latitude: 15.3800, longitude: 75.1000, speed: 45 },
        { latitude: 15.4000, longitude: 75.0800, speed: 55 },
        { latitude: 15.4200, longitude: 75.0500, speed: 50 },
        { latitude: 15.4400, longitude: 75.0300, speed: 40 },
        { latitude: 15.4589, longitude: 75.0078, speed: 0 },
      ];

      for (const coord of testCoordinates) {
        const pingRes = await app.inject({
          method: 'POST',
          url: '/api/v1/tracking/ping',
          headers: { authorization: `Bearer ${driverAToken}` },
          payload: {
            tripId: tripAId,
            latitude: coord.latitude,
            longitude: coord.longitude,
            speed: coord.speed,
            heading: 315,
          },
        });
        expect(pingRes.statusCode).toBe(200);
      }

      // 3. End Trip (triggers RDP simplification and PostGIS LineString persistence)
      const endRes = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/end`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });
      expect(endRes.statusCode).toBe(200);
      expect(endRes.json().data.trip.status).toBe('COMPLETED');
    });

    it('Operator Admin queries compressed trajectory for completed trip', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/trips/${tripAId}/trajectory`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.tripId).toBe(tripAId);
      expect(json.data.totalPoints).toBeGreaterThanOrEqual(2);
      expect(json.data.simplifiedPoints).toBeGreaterThanOrEqual(2);
      expect(json.data.totalDistanceKm).toBeGreaterThan(0);
      expect(json.data.polyline.length).toBeGreaterThanOrEqual(2);
      expect(json.data.polyline[0].latitude).toBeDefined();

      // Verify in DB
      const [trajRecord] = await withSystemContext(async (tx) => {
        return tx.select().from(tripTrajectories).where(eq(tripTrajectories.tripId, tripAId));
      });
      expect(trajRecord).toBeDefined();
      expect(trajRecord.totalPoints).toBeGreaterThanOrEqual(2);
    });

    it('Cross-tenant Admin is isolated and cannot view Tenant A trip trajectory (404)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/trips/${tripAId}/trajectory`,
        headers: { authorization: `Bearer ${adminBToken}` },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
