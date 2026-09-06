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
  tickets,
} from '@ruralbus/database';
import { sql } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 10: Driver & Conductor Mode Foundations Integration Tests', () => {
  let app: FastifyInstance;

  // Tenant A Fixtures
  let operatorAId: string;
  let driverAId: string;
  let driverAToken: string;
  let conductorAId: string;
  let conductorAToken: string;
  let passenger1Id: string;
  let passenger2Id: string;
  let passengerToken: string;

  let tripAId: string;
  let ticket1Id: string;
  let ticket2Id: string;

  // Tenant B Fixtures
  let operatorBId: string;
  let driverBId: string;
  let driverBToken: string;
  let conductorBId: string;
  let conductorBToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('CrewPass123!');

      // 1. Create Operator A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'KSRTC Southern Corridor',
          businessCode: `ksrtc-south-${Date.now()}`,
          contactEmail: 'south@ksrtc.gov.in',
          contactPhone: '9876543401',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      // 2. Create Driver A
      const [drA] = await tx
        .insert(users)
        .values({
          fullName: 'Driver Venkatesh',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-venkat-${Date.now()}@ksrtc.gov.in`,
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

      // 3. Create Conductor A
      const [cnA] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor Suresh',
          phone: `98722${Math.floor(10000 + Math.random() * 90000)}`,
          email: `conductor-suresh-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      conductorAId = cnA.id;

      await tx.insert(operatorMembers).values({
        userId: cnA.id,
        tenantId: operatorAId,
        role: 'CONDUCTOR',
        isActive: true,
      });

      // 4. Create Passengers
      const [p1] = await tx
        .insert(users)
        .values({
          fullName: 'Ramesh Kumar',
          phone: `98733${Math.floor(10000 + Math.random() * 90000)}`,
          email: `ramesh-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passenger1Id = p1.id;

      const [p2] = await tx
        .insert(users)
        .values({
          fullName: 'Sunita Devi',
          phone: `98744${Math.floor(10000 + Math.random() * 90000)}`,
          email: `sunita-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passenger2Id = p2.id;

      // 5. Create Bus & Stops for Tenant A
      const [busA] = await tx
        .insert(buses)
        .values({
          tenantId: operatorAId,
          registrationNumber: `KA-09-E-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus Urban',
          totalSeats: 35,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();

      const [stop1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Mysore Rural Terminal',
          code: `MYSR-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.3082,
          longitude: 76.6554,
          location: sql`ST_SetSRID(ST_MakePoint(76.6554, 12.3082), 4326)`,
        })
        .returning();

      const [stop2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Hunsur Town Stand',
          code: `HNSR-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.3075,
          longitude: 76.2910,
          location: sql`ST_SetSRID(ST_MakePoint(76.2910, 12.3075), 4326)`,
        })
        .returning();

      // 6. Create Route with sequenced stopsData
      const [routeA] = await tx
        .insert(routes)
        .values({
          tenantId: operatorAId,
          routeCode: `RT-MYS-HNS-${Date.now().toString().slice(-4)}`,
          origin: 'Mysore Rural',
          destination: 'Hunsur Town',
          totalDistanceKm: 45,
          estimatedDurationMinutes: 60,
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
              distanceFromStartKm: 45,
              estimatedMinutesFromStart: 60,
              fareFromStart: 55,
            },
          ],
          isActive: true,
        })
        .returning();

      // 7. Create Trip A assigned to Driver A & Conductor A
      const [tripA] = await tx
        .insert(trips)
        .values({
          tenantId: operatorAId,
          routeId: routeA.id,
          busId: busA.id,
          driverId: driverAId,
          conductorId: conductorAId,
          departureTime: new Date(Date.now() + 3600 * 1000),
          scheduledArrival: new Date(Date.now() + 7200 * 1000),
          status: 'SCHEDULED',
          availableSeats: 33,
          totalSeats: 35,
        })
        .returning();
      tripAId = tripA.id;

      // 8. Create Bookings & Tickets for Trip A
      const [b1] = await tx
        .insert(bookings)
        .values({
          tenantId: operatorAId,
          tripId: tripA.id,
          passengerId: passenger1Id,
          seatNumber: 12,
          boardingStopId: stop1.id,
          droppingStopId: stop2.id,
          fareAmount: 55,
          status: 'CONFIRMED',
        })
        .returning();

      const [t1] = await tx
        .insert(tickets)
        .values({
          tenantId: operatorAId,
          bookingId: b1.id,
          tripId: tripA.id,
          passengerId: passenger1Id,
          qrSignature: `QR-SIG-T1-${Date.now()}`,
          status: 'VALID',
        })
        .returning();
      ticket1Id = t1.id;

      const [b2] = await tx
        .insert(bookings)
        .values({
          tenantId: operatorAId,
          tripId: tripA.id,
          passengerId: passenger2Id,
          seatNumber: 15,
          boardingStopId: stop1.id,
          droppingStopId: stop2.id,
          fareAmount: 55,
          status: 'CONFIRMED',
        })
        .returning();

      const [t2] = await tx
        .insert(tickets)
        .values({
          tenantId: operatorAId,
          bookingId: b2.id,
          tripId: tripA.id,
          passengerId: passenger2Id,
          qrSignature: `QR-SIG-T2-${Date.now()}`,
          status: 'VALID',
        })
        .returning();
      ticket2Id = t2.id;

      // 9. Create Tenant B with Driver B & Conductor B
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'KKRTC North Division',
          businessCode: `kkrtc-north-${Date.now()}`,
          contactEmail: 'north@kkrtc.gov.in',
          contactPhone: '9876543402',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      const [drB] = await tx
        .insert(users)
        .values({
          fullName: 'Driver B North',
          phone: `98755${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driverB-${Date.now()}@kkrtc.gov.in`,
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

      const [cnB] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor B North',
          phone: `98766${Math.floor(10000 + Math.random() * 90000)}`,
          email: `conductorB-${Date.now()}@kkrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      conductorBId = cnB.id;

      await tx.insert(operatorMembers).values({
        userId: cnB.id,
        tenantId: operatorBId,
        role: 'CONDUCTOR',
        isActive: true,
      });

      // Sign JWTs
      driverAToken = app.jwt.sign({
        sub: driverAId,
        role: 'DRIVER',
        tenantId: operatorAId,
      });

      conductorAToken = app.jwt.sign({
        sub: conductorAId,
        role: 'CONDUCTOR',
        tenantId: operatorAId,
      });

      driverBToken = app.jwt.sign({
        sub: driverBId,
        role: 'DRIVER',
        tenantId: operatorBId,
      });

      conductorBToken = app.jwt.sign({
        sub: conductorBId,
        role: 'CONDUCTOR',
        tenantId: operatorBId,
      });

      passengerToken = app.jwt.sign({
        sub: passenger1Id,
        role: 'PASSENGER',
        tenantId: null,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ==========================================
  // 1. Driver Duty Execution Tests
  // ==========================================
  describe('Driver Duty Workflow', () => {
    it('should retrieve assigned active duty for Driver A', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/driver/duty',
        headers: { authorization: `Bearer ${driverAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.activeTrip).toBeDefined();
      expect(json.data.activeTrip.id).toBe(tripAId);
      expect(json.data.activeTrip.origin).toBe('Mysore Rural');
      expect(json.data.activeTrip.destination).toBe('Hunsur Town');
      expect(json.data.activeTrip.status).toBe('SCHEDULED');
      expect(json.data.activeTrip.stops.length).toBe(2);
    });

    it('should start assigned trip (transitions to IN_TRANSIT)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/start`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.trip.status).toBe('IN_TRANSIT');
      expect(json.data.trip.actualDeparture).toBeDefined();
    });

    it('should reject redundant start call on trip already IN_TRANSIT', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/start`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toContain('Trip is already in transit');
    });

    it('should reject unassigned Driver B from controlling Driver A trip', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/start`,
        headers: { authorization: `Bearer ${driverBToken}` },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });

  // ==========================================
  // 2. Conductor Manifest & Boarding Tests
  // ==========================================
  describe('Conductor Manifest & Boarding Check-in Workflow', () => {
    it('should retrieve assigned conductor duty with real-time occupancy', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conductor/duty',
        headers: { authorization: `Bearer ${conductorAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.activeTrip.id).toBe(tripAId);
      expect(json.data.totalBookedSeats).toBe(2);
      expect(json.data.totalBoardedSeats).toBe(0);
      expect(json.data.totalAwaitingSeats).toBe(2);
    });

    it('should fetch passenger manifest for trip with seat details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/conductor/manifest/${tripAId}`,
        headers: { authorization: `Bearer ${conductorAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.passengers.length).toBe(2);
      expect(json.data.passengers[0].passengerName).toBe('Ramesh Kumar');
      expect(json.data.passengers[0].seatNumber).toBe('12');
      expect(json.data.passengers[0].isBoarded).toBe(false);
    });

    it('should mark Passenger 1 as BOARDED', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/conductor/manifest/${tripAId}/board/${ticket1Id}`,
        headers: { authorization: `Bearer ${conductorAToken}` },
        payload: { isBoarded: true },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.isBoarded).toBe(true);
    });

    it('should reflect updated boarding count in conductor duty summary', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conductor/duty',
        headers: { authorization: `Bearer ${conductorAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.totalBoardedSeats).toBe(1);
      expect(json.data.totalAwaitingSeats).toBe(1);
    });

    it('should reject unassigned Conductor B from viewing Conductor A manifest', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/conductor/manifest/${tripAId}`,
        headers: { authorization: `Bearer ${conductorBToken}` },
      });

      expect([403, 404]).toContain(response.statusCode);
    });
  });

  // ==========================================
  // 3. Trip Completion & Crew History Tests
  // ==========================================
  describe('Trip Completion & Duty History', () => {
    it('should complete trip by Driver A (transitions to COMPLETED)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripAId}/end`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.trip.status).toBe('COMPLETED');
      expect(json.data.trip.actualArrival).toBeDefined();
    });

    it('should display completed trip in Driver A history log', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/driver/history',
        headers: { authorization: `Bearer ${driverAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.totalCompleted).toBeGreaterThanOrEqual(1);
      expect(json.data.totalDistanceDrivenKm).toBeGreaterThanOrEqual(45);
      expect(json.data.trips[0].id).toBe(tripAId);
    });

    it('should display accurate shift statistics for Conductor A', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conductor/stats',
        headers: { authorization: `Bearer ${conductorAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.totalTripsHandled).toBeGreaterThanOrEqual(1);
      expect(json.data.totalPassengersBoarded).toBeGreaterThanOrEqual(1);
      expect(json.data.totalShiftCollections).toBeGreaterThanOrEqual(55);
    });
  });

  // ==========================================
  // 4. Role-Based Access Control (RBAC) Security
  // ==========================================
  describe('RBAC Security Boundaries', () => {
    it('Passenger receives 403 Forbidden on Driver Duty endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/driver/duty',
        headers: { authorization: `Bearer ${passengerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('Passenger receives 403 Forbidden on Conductor Duty endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/conductor/duty',
        headers: { authorization: `Bearer ${passengerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('Driver receives 403 Forbidden on Conductor Manifest endpoint', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/conductor/manifest/${tripAId}`,
        headers: { authorization: `Bearer ${driverAToken}` },
      });

      expect(response.statusCode).toBe(403);
    });

    it('Conductor receives 403 Forbidden on Driver Duty endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/driver/duty',
        headers: { authorization: `Bearer ${conductorAToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
