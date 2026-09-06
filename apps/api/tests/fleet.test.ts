import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { db, withSystemContext, users, operators, operatorMembers } from '@ruralbus/database';
import { hashPassword } from '../src/services/password.service.js';

describe('Phase 9: Fleet, Route, Stop & Timetable Scheduling Integration Tests', () => {
  let app: FastifyInstance;

  // Test Fixtures
  let operatorAId: string;
  let adminAId: string;
  let adminAToken: string;
  let driverAId: string;
  let conductorAId: string;

  let operatorBId: string;
  let adminBId: string;
  let adminBToken: string;
  let driverBId: string;

  let passengerToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      // 1. Create Operator A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'KSRTC Express Division',
          businessCode: `ksrtc-exp-${Date.now()}`,
          contactEmail: 'express@ksrtc.gov.in',
          contactPhone: '9876543301',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      // 2. Create Admin A User
      const passwordHash = await hashPassword('AdminPass123!');
      const [userA] = await tx
        .insert(users)
        .values({
          fullName: 'Fleet Admin A',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `adminA-fleet-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      adminAId = userA.id;

      await tx.insert(operatorMembers).values({
        userId: userA.id,
        tenantId: operatorAId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // 3. Create Driver A User
      const [drvA] = await tx
        .insert(users)
        .values({
          fullName: 'Driver Ashok',
          phone: `98722${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driverA-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverAId = drvA.id;

      await tx.insert(operatorMembers).values({
        userId: drvA.id,
        tenantId: operatorAId,
        role: 'DRIVER',
        isActive: true,
      });

      // 4. Create Conductor A User
      const [cndA] = await tx
        .insert(users)
        .values({
          fullName: 'Conductor Basavaraj',
          phone: `98733${Math.floor(10000 + Math.random() * 90000)}`,
          email: `conductorA-${Date.now()}@ksrtc.gov.in`,
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

      // 5. Create Operator B & Admin B
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'NWKRTC Regional Transit',
          businessCode: `nwkrtc-reg-${Date.now()}`,
          contactEmail: 'contact@nwkrtc.gov.in',
          contactPhone: '9876543302',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      const [userB] = await tx
        .insert(users)
        .values({
          fullName: 'Fleet Admin B',
          phone: `98744${Math.floor(10000 + Math.random() * 90000)}`,
          email: `adminB-fleet-${Date.now()}@nwkrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      adminBId = userB.id;

      await tx.insert(operatorMembers).values({
        userId: userB.id,
        tenantId: operatorBId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      const [drvB] = await tx
        .insert(users)
        .values({
          fullName: 'Driver B From NWKRTC',
          phone: `98755${Math.floor(10000 + Math.random() * 90000)}`,
          email: `driverB-${Date.now()}@nwkrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      driverBId = drvB.id;

      await tx.insert(operatorMembers).values({
        userId: drvB.id,
        tenantId: operatorBId,
        role: 'DRIVER',
        isActive: true,
      });

      // 6. Create Passenger User
      const [passenger] = await tx
        .insert(users)
        .values({
          fullName: 'Normal Passenger',
          phone: `98766${Math.floor(10000 + Math.random() * 90000)}`,
          email: `passenger-fleet-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();

      // Sign JWT Tokens
      adminAToken = app.jwt.sign({
        sub: userA.id,
        role: 'OPERATOR_ADMIN',
        tenantId: operatorAId,
      });

      adminBToken = app.jwt.sign({
        sub: userB.id,
        role: 'OPERATOR_ADMIN',
        tenantId: operatorBId,
      });

      passengerToken = app.jwt.sign({
        sub: passenger.id,
        role: 'PASSENGER',
        tenantId: null,
      });

      superAdminToken = app.jwt.sign({
        sub: 'super-admin-uuid-001',
        role: 'PLATFORM_ADMIN',
        tenantId: null,
      });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // State IDs across tests
  let busAId: string;
  let busMaintenanceId: string;
  let stop1Id: string;
  let stop2Id: string;
  let stop3Id: string;
  let routeAId: string;
  let scheduleAId: string;
  let tripAId: string;

  // ==========================================
  // 1. Bus Fleet Tests
  // ==========================================
  describe('Bus Fleet Management', () => {
    it('should forbid OPERATOR_ADMIN from creating a bus (403 Forbidden)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          tenantId: operatorAId,
          registrationNumber: `KA-01-F-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus Ultra 40S',
          totalSeats: 40,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should allow PLATFORM_ADMIN (Super Admin) to register a new bus in active fleet (201 Created)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          tenantId: operatorAId,
          registrationNumber: `KA-01-F-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Tata Starbus Ultra 40S',
          totalSeats: 40,
          seatingType: 'SEATER_2X2',
          amenities: ['CCTV', 'GPS', 'USB_CHARGING'],
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.bus.totalSeats).toBe(40);
      expect(json.data.bus.status).toBe('ACTIVE');
      busAId = json.data.bus.id;
    });

    it('should allow Super Admin to register another bus and update to MAINTENANCE status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${superAdminToken}` },
        payload: {
          tenantId: operatorAId,
          registrationNumber: `KA-01-M-${Math.floor(1000 + Math.random() * 9000)}`,
          model: 'Ashok Leyland Viking',
          totalSeats: 45,
          seatingType: 'SEATER_3X2',
        },
      });

      expect(response.statusCode).toBe(201);
      busMaintenanceId = response.json().data.bus.id;

      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/buses/${busMaintenanceId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          status: 'MAINTENANCE',
        },
      });

      expect(updateRes.statusCode).toBe(200);
      expect(updateRes.json().data.bus.status).toBe('MAINTENANCE');
    });

    it('should list buses for operator with accurate status counts', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.total).toBeGreaterThanOrEqual(2);
      expect(json.data.activeCount).toBeGreaterThanOrEqual(1);
      expect(json.data.maintenanceCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // 2. Geo-Fenced Stops Tests
  // ==========================================
  describe('Geo-Fenced Stops Management', () => {
    it('should create Stop 1 (Bangalore Majestic) with PostGIS coordinates', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/stops',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: 'Bangalore Majestic Kempegowda Bus Station',
          code: `BNG-${Math.floor(100 + Math.random() * 900)}`,
          location: {
            latitude: 12.9778,
            longitude: 77.5727,
          },
          landmark: 'Opposite City Railway Station',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.stop.location.latitude).toBeCloseTo(12.9778);
      stop1Id = json.data.stop.id;
    });

    it('should create Stop 2 (Mandya Bus Stand)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/stops',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: 'Mandya Highway Bus Stand',
          code: `MND-${Math.floor(100 + Math.random() * 900)}`,
          location: {
            latitude: 12.5230,
            longitude: 76.8980,
          },
          landmark: 'Near Sugar Factory Junction',
        },
      });

      expect(response.statusCode).toBe(201);
      stop2Id = response.json().data.stop.id;
    });

    it('should create Stop 3 (Mysore Suburb Bus Stand)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/stops',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          name: 'Mysore Suburb Bus Stand',
          code: `MYS-${Math.floor(100 + Math.random() * 900)}`,
          location: {
            latitude: 12.3082,
            longitude: 76.6554,
          },
          landmark: 'Near Mysore Palace North Gate',
        },
      });

      expect(response.statusCode).toBe(201);
      stop3Id = response.json().data.stop.id;
    });

    it('should list all operator stops', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/stops',
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.total).toBeGreaterThanOrEqual(3);
    });
  });

  // ==========================================
  // 3. Route Corridor & Polyline Tests
  // ==========================================
  describe('Route Network & Corridor Operations', () => {
    it('should create route corridor with sequenced stops and cumulative distance', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/routes',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeCode: `RT-BNG-MYS-${Date.now().toString().slice(-4)}`,
          origin: 'Bangalore Majestic',
          destination: 'Mysore Suburb',
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
              distanceFromStartKm: 95,
              estimatedMinutesFromStart: 90,
              fareFromStart: 110,
            },
            {
              stopId: stop3Id,
              sequenceNumber: 3,
              distanceFromStartKm: 145,
              estimatedMinutesFromStart: 150,
              fareFromStart: 180,
            },
          ],
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.route.totalDistanceKm).toBe(145);
      expect(json.data.route.estimatedDurationMinutes).toBe(150);
      expect(json.data.route.stops.length).toBe(3);
      routeAId = json.data.route.id;
    });

    it('should fetch single route corridor details by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/operator/routes/${routeAId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.route.id).toBe(routeAId);
      expect(json.data.route.stops[1].stopName).toBe('Mandya Highway Bus Stand');
    });
  });

  // ==========================================
  // 4. Timetable Schedule Tests
  // ==========================================
  describe('Timetable Schedules Management', () => {
    it('should create recurring timetable schedule for route', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/schedules',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          departureTime: '07:30:00',
          arrivalTime: '10:00:00',
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          baseFare: 180,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.schedule.departureTime).toBe('07:30:00');
      expect(json.data.schedule.baseFare).toBe(180);
      scheduleAId = json.data.schedule.id;
    });

    it('should list schedules for operator route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/operator/schedules?routeId=${routeAId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().data.total).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // 5. Trip Dispatching Tests
  // ==========================================
  describe('Trip Dispatching & Status Lifecycle', () => {
    it('should successfully dispatch a daily trip instance with Route, Bus, Driver, and Conductor', async () => {
      const departureTime = new Date(Date.now() + 3600 * 1000).toISOString();
      const scheduledArrival = new Date(Date.now() + 3600 * 4 * 1000).toISOString();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busAId,
          driverId: driverAId,
          conductorId: conductorAId,
          departureTime,
          scheduledArrival,
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.trip.status).toBe('SCHEDULED');
      expect(json.data.trip.availableSeats).toBe(40);
      expect(json.data.trip.totalSeats).toBe(40);
      expect(json.data.trip.driverName).toBe('Driver Ashok');
      expect(json.data.trip.conductorName).toBe('Conductor Basavaraj');

      tripAId = json.data.trip.id;
    });

    it('should reject dispatch if assigned bus is in MAINTENANCE status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busMaintenanceId,
          departureTime: new Date().toISOString(),
          scheduledArrival: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('BAD_REQUEST');
    });

    it('should reject dispatch if assigned driver belongs to a different tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          routeId: routeAId,
          busId: busAId,
          driverId: driverBId, // Driver from Operator B
          departureTime: new Date().toISOString(),
          scheduledArrival: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should update trip status to IN_TRANSIT and populate actualDeparture', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/trips/${tripAId}/status`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          status: 'IN_TRANSIT',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.trip.status).toBe('IN_TRANSIT');
      expect(json.data.trip.actualDeparture).toBeDefined();
    });

    it('should list dispatched trips with crew and route details', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/trips',
        headers: { authorization: `Bearer ${adminAToken}` },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.total).toBeGreaterThanOrEqual(1);
      expect(json.data.inTransitCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // 6. Cross-Tenant Isolation & RBAC Protection
  // ==========================================
  describe('Cross-Tenant Isolation & RBAC Security', () => {
    it('Operator B cannot see Operator A buses, stops, or routes', async () => {
      const busesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${adminBToken}` },
      });
      const bFound = busesRes.json().data.buses.find((b: any) => b.id === busAId);
      expect(bFound).toBeUndefined();

      const routesRes = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/routes',
        headers: { authorization: `Bearer ${adminBToken}` },
      });
      const rFound = routesRes.json().data.routes.find((r: any) => r.id === routeAId);
      expect(rFound).toBeUndefined();
    });

    it('Operator B cannot dispatch trips on Operator A routes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/trips/dispatch',
        headers: { authorization: `Bearer ${adminBToken}` },
        payload: {
          routeId: routeAId, // Route from Operator A
          busId: busAId,
          departureTime: new Date().toISOString(),
          scheduledArrival: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('Passenger receives 403 Forbidden on operator fleet endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/buses',
        headers: { authorization: `Bearer ${passengerToken}` },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
