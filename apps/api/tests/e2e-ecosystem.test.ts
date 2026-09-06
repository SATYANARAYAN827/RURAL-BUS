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
  tripTrajectories,
} from '@ruralbus/database';
import { sql, eq } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 18: Complete Localhost Multi-Role End-to-End Ecosystem Rehearsal', () => {
  let app: FastifyInstance;

  // Actors
  let operatorId: string;
  let adminId: string;
  let adminToken: string;
  let superAdminToken: string;

  let driverId: string;
  let driverToken: string;

  let conductorId: string;
  let conductorToken: string;

  let passengerId: string;
  let passengerToken: string;

  // Infrastructure & Trip entities
  let busId: string;
  let stop1Id: string;
  let stop2Id: string;
  let routeId: string;
  let tripId: string;

  // Booking & Ticket
  let heldBookingId: string;
  let razorpayOrderId: string;
  let issuedTicketId: string;
  let issuedQrSignature: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Karnataka State Rural Transport Corp',
          businessCode: `ksrtc-e2e-${Date.now()}`,
          contactEmail: 'e2e@ksrtc.gov.in',
          contactPhone: '9876543210',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      // 2. Create Admin
      const [adm] = await tx
        .insert(users)
        .values({
          fullName: 'KSRTC Depot Manager',
          phone: `98701${Math.floor(10000 + Math.random() * 90000)}`,
          email: `manager-e2e-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      adminId = adm.id;

      await tx.insert(operatorMembers).values({
        userId: adm.id,
        tenantId: operatorId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // 3. Create Driver
      const [dr] = await tx
        .insert(users)
        .values({
          fullName: 'Driver Basavaraj',
          phone: `98702${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-e2e-${Date.now()}@ksrtc.gov.in`,
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

      // 4. Create Conductor
      const [cnd] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor Ningappa',
          phone: `98703${Math.floor(10000 + Math.random() * 90000)}`,
          email: `cnd-e2e-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      conductorId = cnd.id;

      await tx.insert(operatorMembers).values({
        userId: cnd.id,
        tenantId: operatorId,
        role: 'CONDUCTOR',
        isActive: true,
      });

      // 5. Create Passenger
      const [pass] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Ramesh Kumar',
          phone: `98704${Math.floor(10000 + Math.random() * 90000)}`,
          email: `ramesh-e2e-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passengerId = pass.id;

      adminToken = app.jwt.sign({ sub: adminId, role: 'OPERATOR_ADMIN', tenantId: operatorId });
      superAdminToken = app.jwt.sign({ sub: 'superadmin-e2e', role: 'PLATFORM_ADMIN' });
      driverToken = app.jwt.sign({ sub: driverId, role: 'DRIVER', tenantId: operatorId });
      conductorToken = app.jwt.sign({ sub: conductorId, role: 'CONDUCTOR', tenantId: operatorId });
      passengerToken = app.jwt.sign({ sub: passengerId, role: 'PASSENGER', tenantId: null });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Full Ecosystem Rehearsal Workflow', () => {
    it('Step 1: Operator Admin creates Bus, Stops, Route, and dispatches Trip', async () => {
      // 1a. Operator Admin receives HTTP 403 Forbidden (Strict Super Admin creation rule)
      const opBusRes = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          tenantId: operatorId,
          registrationNumber: `KA-09-F-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland Viking',
          totalSeats: 30,
        },
      });
      expect(opBusRes.statusCode).toBe(403);

      // 1b. Super Admin (PLATFORM_ADMIN) registers bus to Operator
      const busRes = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          tenantId: operatorId,
          registrationNumber: `KA-09-F-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland Viking',
          totalSeats: 30,
        },
      });
      expect(busRes.statusCode).toBe(201);
      busId = busRes.json().data.bus.id;

      // 2. Create Origin & Destination Stops
      const s1Res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/stops',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Mysuru Central Bus Stand',
          code: `MYS-CBS-${Math.floor(100 + Math.random() * 900)}`,
          location: {
            latitude: 12.3118,
            longitude: 76.6529,
          },
        },
      });
      expect(s1Res.statusCode).toBe(201);
      stop1Id = s1Res.json().data.stop.id;

      const s2Res = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/stops',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          name: 'Hunsur Rural Junction',
          code: `HNS-RJ-${Math.floor(100 + Math.random() * 900)}`,
          location: {
            latitude: 12.3045,
            longitude: 76.2893,
          },
        },
      });
      expect(s2Res.statusCode).toBe(201);
      stop2Id = s2Res.json().data.stop.id;

      // 3. Create Route
      const routeRes = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/routes',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          routeCode: `RT-MYS-${Date.now().toString().slice(-4)}`,
          origin: 'Mysuru Central Bus Stand',
          destination: 'Hunsur Rural Junction',
          stops: [
            {
              stopId: stop1Id,
              sequenceNumber: 1,
              distanceFromStartKm: 0,
              estimatedMinutesFromStart: 0,
              fareFromStart: 0,
            },
            {
              stopId: stop2Id,
              sequenceNumber: 2,
              distanceFromStartKm: 45,
              estimatedMinutesFromStart: 60,
              fareFromStart: 65,
            },
          ],
        },
      });
      expect(routeRes.statusCode).toBe(201);
      routeId = routeRes.json().data.route.id;

      // 4. Dispatch Trip
      await withSystemContext(async (tx) => {
        const [tp] = await tx
          .insert(trips)
          .values({
            tenantId: operatorId,
            routeId,
            busId,
            driverId,
            conductorId,
            departureTime: new Date(Date.now() + 1800 * 1000),
            scheduledArrival: new Date(Date.now() + 5400 * 1000),
            status: 'SCHEDULED',
            availableSeats: 30,
            totalSeats: 30,
          })
          .returning();
        tripId = tp.id;
      });
      expect(tripId).toBeDefined();
    });

    it('Step 2: Driver logs in, starts trip duty, and streams GPS telemetry', async () => {
      // 1. Check active duty
      const dutyRes = await app.inject({
        method: 'GET',
        url: '/api/v1/driver/duty',
        headers: { authorization: `Bearer ${driverToken}` },
      });
      expect(dutyRes.statusCode).toBe(200);

      // 2. Start Trip
      const startRes = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripId}/start`,
        headers: { authorization: `Bearer ${driverToken}` },
      });
      expect(startRes.statusCode).toBe(200);

      // 3. Stream Telemetry
      const pingRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tracking/ping',
        headers: { authorization: `Bearer ${driverToken}` },
        payload: {
          tripId,
          latitude: 12.3118,
          longitude: 76.6529,
          speed: 35,
          heading: 270,
        },
      });
      expect(pingRes.statusCode).toBe(200);
    });

    it('Step 3: Passenger discovers route, locks Seat #5, and completes Razorpay payment', async () => {
      // 1. Search Route
      const searchRes = await app.inject({
        method: 'GET',
        url: `/api/v1/discovery/routes?originStop=Mysuru&destStop=Hunsur`,
      });
      expect(searchRes.statusCode).toBe(200);
      expect(searchRes.json().data.trips.length).toBeGreaterThan(0);

      // 2. View Seat Map
      const seatMapRes = await app.inject({
        method: 'GET',
        url: `/api/v1/bookings/trips/${tripId}/seats`,
      });
      expect(seatMapRes.statusCode).toBe(200);

      // 3. Lock Seat #5
      const holdRes = await app.inject({
        method: 'POST',
        url: '/api/v1/bookings/hold',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: {
          tripId,
          seatNumber: 5,
          boardingStopId: stop1Id,
          droppingStopId: stop2Id,
        },
      });
      expect(holdRes.statusCode).toBe(200);
      heldBookingId = holdRes.json().data.bookingId;

      // 4. Create Razorpay Payment Order
      const orderRes = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-order',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: { bookingId: heldBookingId },
      });
      expect(orderRes.statusCode).toBe(200);
      razorpayOrderId = orderRes.json().data.orderId;

      // 5. Verify Payment & Issue Digital Ticket
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/verify',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: {
          bookingId: heldBookingId,
          razorpayOrderId,
          razorpayPaymentId: 'pay_e2e_rehearsal_555',
          razorpaySignature: 'sig_mock_signature',
        },
      });
      expect(verifyRes.statusCode).toBe(200);
      issuedTicketId = verifyRes.json().data.ticketId;
      issuedQrSignature = verifyRes.json().data.qrSignature;
      expect(issuedQrSignature).toContain('TKT-QR:');
    });

    it('Step 4: Conductor downloads offline manifest and scans passenger QR code', async () => {
      // 1. Download Manifest
      const manifestRes = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/manifest/offline/${tripId}`,
        headers: { authorization: `Bearer ${conductorToken}` },
      });
      expect(manifestRes.statusCode).toBe(200);
      expect(manifestRes.json().data.passengers.length).toBeGreaterThan(0);

      // 2. Scan & Board Passenger
      const boardRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tickets/validate-qr',
        headers: { authorization: `Bearer ${conductorToken}` },
        payload: { qrData: issuedQrSignature },
      });
      expect(boardRes.statusCode).toBe(200);
      expect(boardRes.json().data.valid).toBe(true);
      expect(boardRes.json().data.alreadyBoarded).toBe(false);

      // 3. Duplicate Boarding Attempt Rejection
      const duplicateRes = await app.inject({
        method: 'POST',
        url: '/api/v1/tickets/validate-qr',
        headers: { authorization: `Bearer ${conductorToken}` },
        payload: { qrData: issuedQrSignature },
      });
      expect(duplicateRes.statusCode).toBe(200);
      expect(duplicateRes.json().data.valid).toBe(false);
      expect(duplicateRes.json().data.alreadyBoarded).toBe(true);
    });

    it('Step 5: Driver ends trip and PostGIS stores compressed RDP trajectory', async () => {
      // 1. End Trip
      const endRes = await app.inject({
        method: 'POST',
        url: `/api/v1/driver/duty/${tripId}/end`,
        headers: { authorization: `Bearer ${driverToken}` },
      });
      expect(endRes.statusCode).toBe(200);

      // 2. Query Trajectory
      const trajRes = await app.inject({
        method: 'GET',
        url: `/api/v1/trips/${tripId}/trajectory`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(trajRes.statusCode).toBe(200);
      expect(trajRes.json().data.tripId).toBe(tripId);
    });
  });
});
