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
import { generateTicketQrSignature } from '../src/services/payment.service.js';

describe('Phase 15: Digital Tickets & Conductor Offline QR Validation Integration Tests', () => {
  let app: FastifyInstance;

  // Tenant A
  let operatorAId: string;
  let conductorAId: string;
  let conductorAToken: string;
  let tripAId: string;
  let ticketAId: string;
  let ticketAQrSignature: string;

  // Tenant B
  let operatorBId: string;
  let conductorBId: string;
  let conductorBToken: string;

  // Passenger
  let passengerId: string;
  let passengerToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator A & Conductor A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'Chitradurga Fast Transport',
          businessCode: `cta-tkt-${Date.now()}`,
          contactEmail: 'ticket@cta.gov.in',
          contactPhone: '9876543901',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      const [cndA] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor A Manifest',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `conductor-cta-${Date.now()}@cta.gov.in`,
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

      // 2. Create Bus & Stops & Route for Tenant A
      const [busA] = await tx
        .insert(buses)
        .values({
          tenantId: operatorAId,
          registrationNumber: `KA-16-T-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus 35',
          totalSeats: 35,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();

      const [st1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Chitradurga Fort Stand',
          code: `CTA-F-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 14.2251,
          longitude: 76.4018,
          location: sql`ST_SetSRID(ST_MakePoint(76.4018, 14.2251), 4326)`,
        })
        .returning();

      const [st2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorAId,
          name: 'Davangere Main Stand',
          code: `DVG-M-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 14.4644,
          longitude: 75.9218,
          location: sql`ST_SetSRID(ST_MakePoint(75.9218, 14.4644), 4326)`,
        })
        .returning();

      const [routeA] = await tx
        .insert(routes)
        .values({
          tenantId: operatorAId,
          routeCode: `RT-CTA-${Date.now().toString().slice(-4)}`,
          origin: 'Chitradurga Fort Stand',
          destination: 'Davangere Main Stand',
          totalDistanceKm: 65,
          estimatedDurationMinutes: 80,
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
              distanceFromStartKm: 65,
              estimatedMinutesFromStart: 80,
              fareFromStart: 90,
            },
          ],
          isActive: true,
        })
        .returning();

      // 3. Create Trip A assigned to Conductor A
      const [tripA] = await tx
        .insert(trips)
        .values({
          tenantId: operatorAId,
          routeId: routeA.id,
          busId: busA.id,
          conductorId: conductorAId,
          departureTime: new Date(Date.now() + 3600 * 1000),
          scheduledArrival: new Date(Date.now() + 7200 * 1000),
          status: 'BOARDING',
          availableSeats: 34,
          totalSeats: 35,
        })
        .returning();
      tripAId = tripA.id;

      // 4. Create Passenger & Confirmed Ticket
      const [pass] = await tx
        .insert(users)
        .values({
          fullName: 'Passenger Vikram',
          phone: `98744${Math.floor(10000 + Math.random() * 90000)}`,
          email: `vikram-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();
      passengerId = pass.id;

      const [bkg] = await tx
        .insert(bookings)
        .values({
          tenantId: operatorAId,
          tripId: tripA.id,
          passengerId: pass.id,
          seatNumber: 14,
          boardingStopId: st1.id,
          droppingStopId: st2.id,
          fareAmount: 90,
          status: 'CONFIRMED',
          paymentId: 'pay_test_cta_14',
        })
        .returning();

      ticketAId = crypto.randomUUID();
      ticketAQrSignature = generateTicketQrSignature({
        ticketId: ticketAId,
        bookingId: bkg.id,
        tripId: tripA.id,
        tenantId: operatorAId,
        passengerId: pass.id,
        seatNumber: 14,
        issuedAt: Date.now(),
      });

      await tx.insert(tickets).values({
        id: ticketAId,
        tenantId: operatorAId,
        bookingId: bkg.id,
        tripId: tripA.id,
        passengerId: pass.id,
        qrSignature: ticketAQrSignature,
        status: 'VALID',
      });

      // 5. Create Tenant B Conductor
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'Shimoga Lines',
          businessCode: `shm-tkt-${Date.now()}`,
          contactEmail: 'ticket@shm.gov.in',
          contactPhone: '9876543902',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      const [cndB] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor B Shimoga',
          phone: `98755${Math.floor(10000 + Math.random() * 90000)}`,
          email: `cnd-shm-${Date.now()}@shm.gov.in`,
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

      conductorAToken = app.jwt.sign({
        sub: conductorAId,
        role: 'CONDUCTOR',
        tenantId: operatorAId,
      });

      conductorBToken = app.jwt.sign({
        sub: conductorBId,
        role: 'CONDUCTOR',
        tenantId: operatorBId,
      });

      passengerToken = app.jwt.sign({
        sub: passengerId,
        role: 'PASSENGER',
        tenantId: null,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Offline Manifest Sync & QR Validation', () => {
    it('Conductor A downloads offline pre-departure passenger manifest', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/manifest/offline/${tripAId}`,
        headers: { authorization: `Bearer ${conductorAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.totalBooked).toBe(1);
      expect(json.data.passengers.length).toBe(1);
      expect(json.data.passengers[0].passengerName).toBe('Passenger Vikram');
      expect(json.data.passengers[0].seatNumber).toBe(14);
      expect(json.data.passengers[0].status).toBe('VALID');
    });

    it('Passenger views personal digital ticket details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/tickets/${ticketAId}`,
        headers: { authorization: `Bearer ${passengerToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.seatNumber).toBe(14);
      expect(json.data.fareAmount).toBe(90);
      expect(json.data.status).toBe('VALID');
      expect(json.data.qrSignature).toContain('TKT-QR:');
    });

    it('Conductor A validates passenger QR code and transitions to BOARDED', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tickets/validate-qr',
        headers: { authorization: `Bearer ${conductorAToken}` },
        payload: { qrData: ticketAQrSignature },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.valid).toBe(true);
      expect(json.data.alreadyBoarded).toBe(false);
      expect(json.data.ticket.status).toBe('BOARDED');

      // Verify in DB
      const [ticket] = await withSystemContext(async (tx) => {
        return tx.select().from(tickets).where(eq(tickets.id, ticketAId));
      });
      expect(ticket.status).toBe('BOARDED');
      expect(ticket.boardedAt).toBeDefined();
    });

    it('Duplicate Boarding Defense: Conductor A re-scans the same QR code and is alerted of duplicate scan', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tickets/validate-qr',
        headers: { authorization: `Bearer ${conductorAToken}` },
        payload: { qrData: ticketAQrSignature },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.valid).toBe(false);
      expect(json.data.alreadyBoarded).toBe(true);
      expect(json.data.message).toContain('Duplicate Scan: Ticket was already scanned');
    });

    it('Conductor B (cross-tenant) is forbidden from validating Ticket A (403)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tickets/validate-qr',
        headers: { authorization: `Bearer ${conductorBToken}` },
        payload: { qrData: ticketAQrSignature },
      });

      expect(response.statusCode).toBe(403);
    });

    it('Rejects invalid / corrupted QR code signature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/tickets/validate-qr',
        headers: { authorization: `Bearer ${conductorAToken}` },
        payload: { qrData: 'TKT-QR:invalidbase64data.invalidsignature' },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
