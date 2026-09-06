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

describe('Phase 20: Push Notifications & Multi-Operator Advanced Features Tests', () => {
  let app: FastifyInstance;

  let operatorId: string;
  let adminId: string;
  let adminToken: string;
  let passengerId: string;
  let passengerToken: string;

  let ticketId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Udupi Coastal Lines',
          businessCode: `udp-notif-${Date.now()}`,
          contactEmail: 'notif@udupi.gov.in',
          contactPhone: '9876543401',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      // 2. Create Admin
      const [adm] = await tx
        .insert(users)
        .values({
          fullName: 'Udupi Fleet Manager',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `admin-udp-${Date.now()}@udupi.gov.in`,
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

      // 3. Create Passenger
      const [pass] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Preetham',
          phone: `98722${Math.floor(10000 + Math.random() * 90000)}`,
          email: `preetham-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passengerId = pass.id;

      // 4. Create Bus & Stops & Route
      const [bus] = await tx
        .insert(buses)
        .values({
          tenantId: operatorId,
          registrationNumber: `KA-20-U-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Volvo 9400',
          totalSeats: 40,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();

      const [s1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Udupi Service Bus Stand',
          code: `UDP-S-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 13.3409,
          longitude: 74.7421,
          location: sql`ST_SetSRID(ST_MakePoint(74.7421, 13.3409), 4326)`,
        })
        .returning();

      const [s2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Manipal Tiger Circle',
          code: `MNP-T-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 13.3525,
          longitude: 74.7928,
          location: sql`ST_SetSRID(ST_MakePoint(74.7928, 13.3525), 4326)`,
        })
        .returning();

      const [route] = await tx
        .insert(routes)
        .values({
          tenantId: operatorId,
          routeCode: `RT-UDP-${Date.now().toString().slice(-4)}`,
          origin: 'Udupi Service Bus Stand',
          destination: 'Manipal Tiger Circle',
          totalDistanceKm: 6,
          estimatedDurationMinutes: 15,
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
              distanceFromStartKm: 6,
              estimatedMinutesFromStart: 15,
              fareFromStart: 20,
            },
          ],
          isActive: true,
        })
        .returning();

      // 5. Create Trip & Booking & Ticket
      const [trip] = await tx
        .insert(trips)
        .values({
          tenantId: operatorId,
          routeId: route.id,
          busId: bus.id,
          departureTime: new Date(Date.now() + 1800 * 1000),
          scheduledArrival: new Date(Date.now() + 5400 * 1000),
          status: 'BOARDING',
          availableSeats: 40,
          totalSeats: 40,
        })
        .returning();

      const [bkg] = await tx
        .insert(bookings)
        .values({
          tenantId: operatorId,
          tripId: trip.id,
          passengerId: pass.id,
          seatNumber: 18,
          boardingStopId: s1.id,
          droppingStopId: s2.id,
          fareAmount: 20,
          status: 'CONFIRMED',
          paymentId: 'pay_test_thermal_18',
        })
        .returning();

      const [tkt] = await tx
        .insert(tickets)
        .values({
          tenantId: operatorId,
          bookingId: bkg.id,
          tripId: trip.id,
          passengerId: pass.id,
          qrSignature: 'TKT-QR:sample_signature_for_thermal',
          status: 'VALID',
        })
        .returning();
      ticketId = tkt.id;

      adminToken = app.jwt.sign({
        sub: adm.id,
        role: 'OPERATOR_ADMIN',
        tenantId: operatorId,
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

  describe('Multi-Channel Notification Dispatcher', () => {
    it('Operator Admin dispatches a trip delay alert notification', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/notifications/send',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          type: 'DELAY_ALERT',
          title: 'Trip Delayed by 10 Minutes',
          body: 'Due to road maintenance on NH-66, the departure is delayed by 10 minutes.',
          channel: 'PUSH',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.delivered).toBe(true);
      expect(json.data.notificationId).toBeDefined();
      expect(json.data.channel).toBe('PUSH');
    });
  });

  describe('ESC/POS Thermal Ticket Receipt Formatter', () => {
    it('generates formatted thermal receipt text block for conductor Bluetooth printer', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/${ticketId}/receipt`,
        headers: { authorization: `Bearer ${passengerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.operatorName).toBe('Udupi Coastal Lines');
      expect(json.data.seatNumber).toBe(18);
      expect(json.data.fare).toBe(20);
      expect(json.data.fromStop).toBe('Udupi Service Bus Stand');
      expect(json.data.toStop).toBe('Manipal Tiger Circle');
      expect(json.data.escPosRawText).toContain('UDUPI COASTAL LINES');
      expect(json.data.escPosRawText).toContain('Seat:      #18');
      expect(json.data.escPosRawText).toContain('Fare:      INR 20.00');
      expect(json.data.escPosRawText).toContain('HAVE A SAFE JOURNEY');
    });
  });
});
