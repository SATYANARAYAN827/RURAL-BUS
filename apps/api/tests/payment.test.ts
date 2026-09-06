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
import { sql, eq } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 14: Razorpay Payment Pipeline & Webhook Reconciliation Integration Tests', () => {
  let app: FastifyInstance;

  let operatorId: string;
  let driverId: string;
  let busId: string;
  let tripId: string;
  let stop1Id: string;
  let stop2Id: string;

  let passengerId: string;
  let passengerToken: string;
  let heldBookingId: string;
  let issuedTicketId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Hassan Coastal Express',
          businessCode: `has-pay-${Date.now()}`,
          contactEmail: 'payment@hassan.gov.in',
          contactPhone: '9876543801',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      // 2. Create Driver
      const [dr] = await tx
        .insert(users)
        .values({
          fullName: 'Driver Payment',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driver-pay-${Date.now()}@hassan.gov.in`,
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

      // 3. Create Bus & Stops & Route
      const [bus] = await tx
        .insert(buses)
        .values({
          tenantId: operatorId,
          registrationNumber: `KA-13-P-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Eicher Skyline',
          totalSeats: 32,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busId = bus.id;

      const [s1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Hassan Bus Stand',
          code: `HSN-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 13.0033,
          longitude: 76.1004,
          location: sql`ST_SetSRID(ST_MakePoint(76.1004, 13.0033), 4326)`,
        })
        .returning();
      stop1Id = s1.id;

      const [s2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Sakleshpur Ghat',
          code: `SKL-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 12.9439,
          longitude: 75.7865,
          location: sql`ST_SetSRID(ST_MakePoint(75.7865, 12.9439), 4326)`,
        })
        .returning();
      stop2Id = s2.id;

      const [route] = await tx
        .insert(routes)
        .values({
          tenantId: operatorId,
          routeCode: `RT-PAY-${Date.now().toString().slice(-4)}`,
          origin: 'Hassan Bus Stand',
          destination: 'Sakleshpur Ghat',
          totalDistanceKm: 40,
          estimatedDurationMinutes: 50,
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
              distanceFromStartKm: 40,
              estimatedMinutesFromStart: 50,
              fareFromStart: 75,
            },
          ],
          isActive: true,
        })
        .returning();

      // 4. Create Trip
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
          availableSeats: 32,
          totalSeats: 32,
        })
        .returning();
      tripId = trip.id;

      // 5. Create Passenger
      const [pUser] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Payee',
          phone: `98766${Math.floor(10000 + Math.random() * 90000)}`,
          email: `payee-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passengerId = pUser.id;

      passengerToken = app.jwt.sign({
        sub: passengerId,
        role: 'PASSENGER',
        tenantId: null,
      });

      // 6. Create initial HELD booking (Seat 7)
      const [held] = await tx
        .insert(bookings)
        .values({
          tenantId: operatorId,
          tripId: trip.id,
          passengerId: passengerId,
          seatNumber: 7,
          boardingStopId: stop1Id,
          droppingStopId: stop2Id,
          fareAmount: 75,
          status: 'HELD',
          lockedUntil: new Date(Date.now() + 300 * 1000),
        })
        .returning();
      heldBookingId = held.id;
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Razorpay Order & Payment Confirmation Pipeline', () => {
    let razorpayOrderId: string;

    it('should generate a Razorpay payment order for held booking', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/create-order',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: { bookingId: heldBookingId },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.amountInPaise).toBe(7500);
      expect(json.data.currency).toBe('INR');
      expect(json.data.orderId).toContain('order_mock_');
      razorpayOrderId = json.data.orderId;
    });

    it('should verify payment signature, transition booking to CONFIRMED, and issue digital ticket', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/verify',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: {
          bookingId: heldBookingId,
          razorpayOrderId,
          razorpayPaymentId: 'pay_test_hassan_123',
          razorpaySignature: 'sig_mock_signature',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('CONFIRMED');
      expect(json.data.ticketId).toBeDefined();
      expect(json.data.qrSignature).toContain('TKT-QR:');
      issuedTicketId = json.data.ticketId;

      // Verify in database
      const [updatedBooking] = await withSystemContext(async (tx) => {
        return tx.select().from(bookings).where(eq(bookings.id, heldBookingId));
      });
      expect(updatedBooking.status).toBe('CONFIRMED');
      expect(updatedBooking.paymentId).toBe('pay_test_hassan_123');
      expect(updatedBooking.lockedUntil).toBeNull();
    });

    it('should handle idempotent payment verification for already confirmed booking', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/verify',
        headers: { authorization: `Bearer ${passengerToken}` },
        payload: {
          bookingId: heldBookingId,
          razorpayOrderId,
          razorpayPaymentId: 'pay_test_hassan_123',
          razorpaySignature: 'sig_mock_signature',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.ticketId).toBe(issuedTicketId);
    });

    it('should process webhook event payment.captured idempotently', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook',
        headers: {
          'x-razorpay-signature': 'mock_signature',
        },
        payload: {
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: 'pay_webhook_999',
                order_id: razorpayOrderId,
                amount: 7500,
                currency: 'INR',
                status: 'captured',
                notes: {
                  bookingId: heldBookingId,
                },
              },
            },
          },
          mock_webhook_bypass: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.processed).toBe(true);
    });
  });
});
