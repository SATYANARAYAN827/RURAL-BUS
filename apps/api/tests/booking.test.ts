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
  bookings,
} from '@ruralbus/database';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 13: Authoritative Seat-Locking & Booking Engine Integration Tests', () => {
  let app: FastifyInstance;

  let operatorId: string;
  let driverId: string;
  let busId: string;
  let tripId: string;
  let stop1Id: string;
  let stop2Id: string;

  let passengerAId: string;
  let passengerAToken: string;
  let passengerBId: string;
  let passengerBToken: string;

  let bookingAId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Karnataka State Express',
          businessCode: `kse-seat-${Date.now()}`,
          contactEmail: 'booking@kse.gov.in',
          contactPhone: '9876543701',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      // 2. Create Driver
      const [dr] = await tx
        .insert(users)
        .values({
          fullName: 'Driver SEAT',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-seat-${Date.now()}@kse.gov.in`,
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

      // 3. Create Bus (30 seats)
      const [bus] = await tx
        .insert(buses)
        .values({
          tenantId: operatorId,
          registrationNumber: `KA-09-BK-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus 30',
          totalSeats: 30,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busId = bus.id;

      // 4. Create Stops & Route
      const [s1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Mysore Origin',
          code: `MY-BK-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.3082,
          longitude: 76.6554,
          location: sql`ST_SetSRID(ST_MakePoint(76.6554, 12.3082), 4326)`,
        })
        .returning();
      stop1Id = s1.id;

      const [s2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Hunsur Destination',
          code: `HN-BK-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.3075,
          longitude: 76.2910,
          location: sql`ST_SetSRID(ST_MakePoint(76.2910, 12.3075), 4326)`,
        })
        .returning();
      stop2Id = s2.id;

      const [route] = await tx
        .insert(routes)
        .values({
          tenantId: operatorId,
          routeCode: `RT-SEAT-${Date.now().toString().slice(-4)}`,
          origin: 'Mysore Origin',
          destination: 'Hunsur Destination',
          totalDistanceKm: 45,
          estimatedDurationMinutes: 60,
          stopsData: [
            {
              stopId: s1.id,
              stopName: s1.name,
              sequenceNumber: 1,
              distanceFromStartKm: 0,
              estimatedMinutesFromStart: 0,
              fareFromStart: 0,
            },
            {
              stopId: s2.id,
              stopName: s2.name,
              sequenceNumber: 2,
              distanceFromStartKm: 45,
              estimatedMinutesFromStart: 60,
              fareFromStart: 65,
            },
          ],
          isActive: true,
        })
        .returning();

      // 5. Create Trip
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
          availableSeats: 30,
          totalSeats: 30,
        })
        .returning();
      tripId = trip.id;

      // 6. Create Passengers A and B
      const [pA] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Alice',
          phone: `98788${Math.floor(10000 + Math.random() * 90000)}`,
          email: `alice-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passengerAId = pA.id;

      const [pB] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Bob',
          phone: `98799${Math.floor(10000 + Math.random() * 90000)}`,
          email: `bob-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passengerBId = pB.id;

      passengerAToken = app.jwt.sign({
        sub: passengerAId,
        role: 'PASSENGER',
        tenantId: null,
      });

      passengerBToken = app.jwt.sign({
        sub: passengerBId,
        role: 'PASSENGER',
        tenantId: null,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Seat Map & ACID Hold Pipeline', () => {
    it('should retrieve initial seat map with all 30 seats available', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/trips/${tripId}/seats`,
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalSeats).toBe(30);
      expect(json.data.availableSeatCount).toBe(30);
      expect(json.data.seats.length).toBe(30);
      expect(json.data.seats[11].status).toBe('AVAILABLE');
    });

    it('Passenger A successfully holds Seat 12 (5 min lock)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/hold',
        headers: { authorization: `Bearer ${passengerAToken}` },
        payload: {
          tripId,
          seatNumber: 12,
          boardingStopId: stop1Id,
          droppingStopId: stop2Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.seatNumber).toBe(12);
      expect(json.data.status).toBe('HELD');
      expect(json.data.fareAmount).toBe(65);
      expect(json.data.expiresInSeconds).toBe(300);
      bookingAId = json.data.bookingId;
    });

    it('Seat Map reflects YOUR_HOLD for Passenger A and HELD for Passenger B', async () => {
      // For Passenger A:
      const resA = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/trips/${tripId}/seats`,
        headers: { authorization: `Bearer ${passengerAToken}` },
      });
      expect(resA.statusCode).toBe(200);
      const seat12A = resA.json().data.seats.find((s: any) => s.seatNumber === 12);
      expect(seat12A.status).toBe('YOUR_HOLD');

      // For Passenger B:
      const resB = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/trips/${tripId}/seats`,
        headers: { authorization: `Bearer ${passengerBToken}` },
      });
      expect(resB.statusCode).toBe(200);
      const seat12B = resB.json().data.seats.find((s: any) => s.seatNumber === 12);
      expect(seat12B.status).toBe('HELD');
    });

    it('Concurrent Double-Booking Defense: Passenger B receives 409 Conflict when attempting to hold Seat 12', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/hold',
        headers: { authorization: `Bearer ${passengerBToken}` },
        payload: {
          tripId,
          seatNumber: 12,
          boardingStopId: stop1Id,
          droppingStopId: stop2Id,
        },
      });

      expect(response.statusCode).toBe(409);
    });

    it('Passenger A releases Seat 12 hold', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/bookings/${bookingAId}/hold`,
        headers: { authorization: `Bearer ${passengerAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
    });

    it('Passenger B can now successfully hold Seat 12 after release', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/hold',
        headers: { authorization: `Bearer ${passengerBToken}` },
        payload: {
          tripId,
          seatNumber: 12,
          boardingStopId: stop1Id,
          droppingStopId: stop2Id,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.seatNumber).toBe(12);
      expect(json.data.status).toBe('HELD');
    });

    it('Rejects invalid seat number exceeding bus capacity (Seat 99 on 30-seat bus)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/hold',
        headers: { authorization: `Bearer ${passengerAToken}` },
        payload: {
          tripId,
          seatNumber: 99,
          boardingStopId: stop1Id,
          droppingStopId: stop2Id,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('Passenger B fetches personal bookings list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/bookings/my-bookings',
        headers: { authorization: `Bearer ${passengerBToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.bookings.length).toBeGreaterThanOrEqual(1);
      expect(json.data.bookings[0].seatNumber).toBe(12);
      expect(json.data.bookings[0].status).toBe('HELD');
    });
  });
});
