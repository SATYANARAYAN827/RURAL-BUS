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
import {
  generateOfflineTicketCode,
  computeOfflineTicketHash,
} from '../src/services/offline-cash-ticket.service.js';

describe('Phase 19: Offline Cash Ticket Issuance & Financial Reconciliation Tests', () => {
  let app: FastifyInstance;

  let operatorId: string;
  let conductorId: string;
  let conductorToken: string;
  let busId: string;
  let tripId: string;
  let stop1Id: string;
  let stop2Id: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      const passwordHash = await hashPassword('Secret123!');

      // 1. Create Operator
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: 'Belagavi Rural Lines',
          businessCode: `bgm-csh-${Date.now()}`,
          contactEmail: 'cash@bgm.gov.in',
          contactPhone: '9876543301',
          status: 'ACTIVE',
        })
        .returning();
      operatorId = op.id;

      // 2. Create Conductor
      const [cnd] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor Mahadev',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `cnd-bgm-${Date.now()}@bgm.gov.in`,
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

      // 3. Create Bus & Stops & Route
      const [bus] = await tx
        .insert(buses)
        .values({
          tenantId: operatorId,
          registrationNumber: `KA-22-C-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus',
          totalSeats: 30,
          seatingType: 'SEATER_2X2',
          status: 'ACTIVE',
        })
        .returning();
      busId = bus.id;

      const [s1] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Belagavi Central Stand',
          code: `BGM-C-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 15.8497,
          longitude: 74.4977,
          location: sql`ST_SetSRID(ST_MakePoint(74.4977, 15.8497), 4326)`,
        })
        .returning();
      stop1Id = s1.id;

      const [s2] = await tx
        .insert(stops)
        .values({
          tenantId: operatorId,
          name: 'Khanapur Stand',
          code: `KNP-S-${Math.floor(100 + Math.random() * 900)}`,
          latitude: 15.6358,
          longitude: 74.5151,
          location: sql`ST_SetSRID(ST_MakePoint(74.5151, 15.6358), 4326)`,
        })
        .returning();
      stop2Id = s2.id;

      const [route] = await tx
        .insert(routes)
        .values({
          tenantId: operatorId,
          routeCode: `RT-BGM-${Date.now().toString().slice(-4)}`,
          origin: 'Belagavi Central Stand',
          destination: 'Khanapur Stand',
          totalDistanceKm: 26,
          estimatedDurationMinutes: 40,
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
              distanceFromStartKm: 26,
              estimatedMinutesFromStart: 40,
              fareFromStart: 35,
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
          conductorId: conductorId,
          departureTime: new Date(Date.now() + 1800 * 1000),
          scheduledArrival: new Date(Date.now() + 5400 * 1000),
          status: 'BOARDING',
          availableSeats: 30,
          totalSeats: 30,
        })
        .returning();
      tripId = trip.id;

      conductorToken = app.jwt.sign({
        sub: conductorId,
        role: 'CONDUCTOR',
        tenantId: operatorId,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Monotonic Sequence & Cryptographic Hash Chaining', () => {
    it('generates deterministic composite ticket sequence code', () => {
      const code = generateOfflineTicketCode('BGM01', 'DEV01', tripId, 1);
      expect(code).toContain('TKT-BGM0-DEV0-');
      expect(code).toMatch(/-0001$/);
    });

    it('computes SHA-256 cryptographic hash chain correctly', () => {
      const genesisHash = '00000000000000000000000000000000';
      const ticket1 = {
        ticketSequence: 1,
        ticketCode: 'TKT-BGM0-DEV0-TRP1-0001',
        deviceId: 'DEV01',
        tripId,
        boardingStopId: stop1Id,
        droppingStopId: stop2Id,
        fareAmount: 35,
      };
      const hash1 = computeOfflineTicketHash(genesisHash, ticket1);
      expect(hash1).toBeDefined();
      expect(hash1.length).toBe(64); // SHA-256 hex string

      const ticket2 = {
        ticketSequence: 2,
        ticketCode: 'TKT-BGM0-DEV0-TRP1-0002',
        deviceId: 'DEV01',
        tripId,
        boardingStopId: stop1Id,
        droppingStopId: stop2Id,
        fareAmount: 35,
      };
      const hash2 = computeOfflineTicketHash(hash1, ticket2);
      expect(hash2).not.toBe(hash1);
    });
  });

  describe('Post-Trip Batch Sync & Depot Settlement', () => {
    let syncedBatchCode1: string;

    it('synchronizes a batch of offline cash tickets upon depot arrival', async () => {
      syncedBatchCode1 = generateOfflineTicketCode('BGM01', 'DEV01', tripId, 1);
      const syncedBatchCode2 = generateOfflineTicketCode('BGM01', 'DEV01', tripId, 2);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conductor/offline-tickets/sync',
        headers: { authorization: `Bearer ${conductorToken}` },
        payload: {
          tripId,
          deviceId: 'DEV01',
          tickets: [
            {
              ticketSequence: 1,
              ticketCode: syncedBatchCode1,
              deviceId: 'DEV01',
              tripId,
              boardingStopId: stop1Id,
              droppingStopId: stop2Id,
              passengerCount: 1,
              fareAmount: 35,
              paymentMethod: 'CASH',
              issuedAt: new Date().toISOString(),
              prevTicketHash: '00000000000000000000000000000000',
              ticketHash: 'hash_sample_1',
            },
            {
              ticketSequence: 2,
              ticketCode: syncedBatchCode2,
              deviceId: 'DEV01',
              tripId,
              boardingStopId: stop1Id,
              droppingStopId: stop2Id,
              passengerCount: 1,
              fareAmount: 35,
              paymentMethod: 'CASH',
              issuedAt: new Date().toISOString(),
              prevTicketHash: 'hash_sample_1',
              ticketHash: 'hash_sample_2',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.syncedCount).toBe(2);
      expect(json.data.totalCashAmount).toBe(70);
    });

    it('identifies and skips duplicate tickets on subsequent sync attempts', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/conductor/offline-tickets/sync',
        headers: { authorization: `Bearer ${conductorToken}` },
        payload: {
          tripId,
          deviceId: 'DEV01',
          tickets: [
            {
              ticketSequence: 1,
              ticketCode: syncedBatchCode1,
              deviceId: 'DEV01',
              tripId,
              boardingStopId: stop1Id,
              droppingStopId: stop2Id,
              passengerCount: 1,
              fareAmount: 35,
              paymentMethod: 'CASH',
              issuedAt: new Date().toISOString(),
              prevTicketHash: '00000000000000000000000000000000',
              ticketHash: 'hash_sample_1',
            },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.syncedCount).toBe(0);
      expect(json.data.processedTickets[0].status).toBe('DUPLICATE');
    });

    it('generates accurate conductor cash settlement & depot reconciliation report', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/conductor/cash-settlement/${tripId}`,
        headers: { authorization: `Bearer ${conductorToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.cashTicketCount).toBe(2);
      expect(json.data.cashRevenueAmount).toBe(70);
      expect(json.data.totalRevenue).toBe(70);
      expect(json.data.conductorName).toBe('Conductor Mahadev');
    });
  });
});
