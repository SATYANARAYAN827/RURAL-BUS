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

describe('Phase 12: Passenger Route Discovery & Live Bus Tracking Integration Tests', () => {
  let app: FastifyInstance;

  let operatorId: string;
  let driverId: string;
  let busId: string;
  let tripId: string;
  let stopAId: string;
  let stopBId: string;
  let stopCId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Kaveri Rural Transport',
          businessCode: `kaveri-disc-${Date.now()}`,
          contactEmail: 'discovery@kaveri.com',
          contactPhone: '9876543601',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      // 2. Create Driver
      const [dr] = await tx
        .insert(users)
        .values({
          fullName: 'Driver Kaveri',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-kav-${Date.now()}@kaveri.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverId = dr.id;

      await tx.insert(operatorMembers).values({
        userId: dr.id,
        tenantId: operatorId,
        role: 'DRIVER',
        isActive: true,
      });

      // 3. Create Bus
      const [bus] = await tx
        .insert(buses)
        .values({
          tenantId: operatorId,
          registrationNumber: `KA-55-D-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland Viking',
          totalSeats: 40,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busId = bus.id;

      // 4. Create 3 Sequenced Stops: Mysore (1) -> Mandya (2) -> Bangalore (3)
      const [sA] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Mysore Suburban Stand',
          code: `MYS-SUB-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.3100,
          longitude: 76.6600,
          location: sql`ST_SetSRID(ST_MakePoint(76.6600, 12.3100), 4326)`,
        })
        .returning();
      stopAId = sA.id;

      const [sB] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Mandya Sugar Town',
          code: `MDY-SGR-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.5200,
          longitude: 76.9000,
          location: sql`ST_SetSRID(ST_MakePoint(76.9000, 12.5200), 4326)`,
        })
        .returning();
      stopBId = sB.id;

      const [sC] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Bangalore Majestic Hub',
          code: `BLR-MAJ-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.9716,
          longitude: 77.5946,
          location: sql`ST_SetSRID(ST_MakePoint(77.5946, 12.9716), 4326)`,
        })
        .returning();
      stopCId = sC.id;

      // 5. Create Route with Sequenced Stops
      const [route] = await tx
        .insert(routes)
        .values({
          tenantId: operatorId,
          routeCode: `RT-KAV-${Date.now().toString().slice(-4)}`,
          origin: 'Mysore Suburban Stand',
          destination: 'Bangalore Majestic Hub',
          totalDistanceKm: 140,
          estimatedDurationMinutes: 180,
          stopsData: [
            {
              stopId: sA.id,
              stopName: sA.name,
              sequenceNumber: 1,
              distanceFromStartKm: 0,
              estimatedMinutesFromStart: 0,
              fareFromStart: 0,
            },
            {
              stopId: sB.id,
              stopName: sB.name,
              sequenceNumber: 2,
              distanceFromStartKm: 45,
              estimatedMinutesFromStart: 50,
              fareFromStart: 60,
            },
            {
              stopId: sC.id,
              stopName: sC.name,
              sequenceNumber: 3,
              distanceFromStartKm: 140,
              estimatedMinutesFromStart: 180,
              fareFromStart: 180,
            },
          ],
          isActive: true,
        })
        .returning();

      // 6. Create Trip
      const [trip] = await tx
        .insert(trips)
        .values({
          tenantId: operatorId,
          routeId: route.id,
          busId: bus.id,
          driverId: driverId,
          departureTime: new Date(Date.now() + 3600 * 1000),
          scheduledArrival: new Date(Date.now() + 7200 * 1000),
          status: 'SCHEDULED',
          availableSeats: 40,
          totalSeats: 40,
        })
        .returning();
      tripId = trip.id;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Route Discovery & Stop Queries', () => {
    it('should search and return trips matching corridor (Mysore -> Bangalore)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/routes',
        query: {
          origin: 'Mysore',
          destination: 'Bangalore',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalCount).toBeGreaterThanOrEqual(1);

      const matchedTrip = json.data.trips.find((t: any) => t.tripId === tripId);
      expect(matchedTrip).toBeDefined();
      expect(matchedTrip.operatorName).toBe('Kaveri Rural Transport');
      expect(matchedTrip.fareAmount).toBe(180);
      expect(matchedTrip.totalSeats).toBe(40);
    });

    it('should return intermediate sub-segment trip (Mandya -> Bangalore)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/routes',
        query: {
          origin: 'Mandya',
          destination: 'Bangalore',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      const matched = json.data.trips.find((t: any) => t.tripId === tripId);
      expect(matched).toBeDefined();
      // Segment fare: 180 - 60 = 120
      expect(matched.fareAmount).toBe(120);
    });

    it('should NOT return trip for reverse corridor (Bangalore -> Mysore on one-way route)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/routes',
        query: {
          origin: 'Bangalore',
          destination: 'Mysore',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const matched = json.data.trips.find((t: any) => t.tripId === tripId);
      expect(matched).toBeUndefined();
    });

    it('should fetch public stops for autocomplete query', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/stops',
        query: { q: 'Sugar' },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.stops.length).toBeGreaterThanOrEqual(1);
      expect(json.data.stops[0].name).toContain('Mandya Sugar Town');
    });

    it('should fetch detailed trip itinerary with stops progression', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/discovery/trips/${tripId}`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.trip.tripId).toBe(tripId);
      expect(json.data.trip.stops.length).toBe(3);
      expect(json.data.trip.stops[0].stopName).toContain('Mysore');
      expect(json.data.trip.stops[2].stopName).toContain('Bangalore');
    });

    it('should return 404 for non-existent trip ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/discovery/trips/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
