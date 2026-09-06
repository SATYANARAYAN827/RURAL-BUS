import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { db, withSystemContext, users, operators, operatorMembers } from '@ruralbus/database';
import { hashPassword } from '../src/services/password.service.js';
import { eq } from 'drizzle-orm';

describe('Phase 8: Operator Profile & Staff Management Integration Tests', () => {
  let app: FastifyInstance;

  // Test Fixtures
  let operatorAId: string;
  let adminAId: string;
  let adminAToken: string;

  let operatorBId: string;
  let adminBId: string;
  let adminBToken: string;

  let passengerToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    await withSystemContext(async (tx) => {
      // 1. Create Operator A
      const [opA] = await tx
        .insert(operators)
        .values({
          companyName: 'KSRTC Southern Division',
          businessCode: `ksrtc-south-${Date.now()}`,
          contactEmail: 'south@ksrtc.gov.in',
          contactPhone: '9876543201',
          status: 'ACTIVE',
        })
        .returning();
      operatorAId = opA.id;

      // 2. Create Admin A User
      const passwordHash = await hashPassword('AdminPass123!');
      const [userA] = await tx
        .insert(users)
        .values({
          fullName: 'Operator Admin A',
          phone: `98711${Math.floor(10000 + Math.random() * 90000)}`,
          email: `adminA-${Date.now()}@ksrtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      adminAId = userA.id;

      // Link Admin A to Operator A
      await tx.insert(operatorMembers).values({
        userId: userA.id,
        tenantId: operatorAId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // 3. Create Operator B
      const [opB] = await tx
        .insert(operators)
        .values({
          companyName: 'BMTC Express Transit',
          businessCode: `bmtc-exp-${Date.now()}`,
          contactEmail: 'contact@bmtc.gov.in',
          contactPhone: '9876543202',
          status: 'ACTIVE',
        })
        .returning();
      operatorBId = opB.id;

      // 4. Create Admin B User
      const [userB] = await tx
        .insert(users)
        .values({
          fullName: 'Operator Admin B',
          phone: `98722${Math.floor(10000 + Math.random() * 90000)}`,
          email: `adminB-${Date.now()}@bmtc.gov.in`,
          passwordHash,
          isActive: true,
        })
        .returning();
      adminBId = userB.id;

      // Link Admin B to Operator B
      await tx.insert(operatorMembers).values({
        userId: userB.id,
        tenantId: operatorBId,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // 5. Create Passenger User
      const [passenger] = await tx
        .insert(users)
        .values({
          fullName: 'Regular Passenger',
          phone: `98733${Math.floor(10000 + Math.random() * 90000)}`,
          email: `passenger-${Date.now()}@gmail.com`,
          passwordHash,
          isActive: true,
        })
        .returning();

      // Generate Access Tokens
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
    });
  });

  afterAll(async () => {
    await app.close();
  });

  let createdDriverStaffId: string;
  let createdDriverPhone: string;

  // 1. Operator Profile Tests
  describe('GET /api/v1/operator/profile', () => {
    it('should return operator company profile for authenticated OPERATOR_ADMIN', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/profile',
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.profile.id).toBe(operatorAId);
      expect(json.data.profile.companyName).toBe('KSRTC Southern Division');
    });

    it('should update operator company profile with valid input', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/operator/profile',
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          companyName: 'KSRTC Southern Superfast Division',
          contactEmail: 'new-contact@ksrtc.gov.in',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.profile.companyName).toBe('KSRTC Southern Superfast Division');
      expect(json.data.profile.contactEmail).toBe('new-contact@ksrtc.gov.in');
    });
  });

  // 2. Staff Provisioning Tests
  describe('POST /api/v1/operator/staff', () => {
    it('should provision a new DRIVER for the active operator tenant', async () => {
      createdDriverPhone = `98744${Math.floor(10000 + Math.random() * 90000)}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/staff',
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          fullName: 'Ramesh Driver',
          phone: createdDriverPhone,
          email: `ramesh.driver-${Date.now()}@ksrtc.gov.in`,
          role: 'DRIVER',
          password: 'DriverPassword123!',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.staff.fullName).toBe('Ramesh Driver');
      expect(json.data.staff.role).toBe('DRIVER');
      expect(json.data.staff.tenantId).toBe(operatorAId);
      expect(json.data.staff.isActive).toBe(true);

      createdDriverStaffId = json.data.staff.id;
    });

    it('should provision a new CONDUCTOR for the active operator tenant', async () => {
      const conductorPhone = `98755${Math.floor(10000 + Math.random() * 90000)}`;

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/staff',
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          fullName: 'Suresh Conductor',
          phone: conductorPhone,
          email: `suresh.conductor-${Date.now()}@ksrtc.gov.in`,
          role: 'CONDUCTOR',
          password: 'ConductorPassword123!',
        },
      });

      expect(response.statusCode).toBe(201);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.staff.fullName).toBe('Suresh Conductor');
      expect(json.data.staff.role).toBe('CONDUCTOR');
    });

    it('should reject provision attempt with duplicate mobile number', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/operator/staff',
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          fullName: 'Duplicate Driver',
          phone: createdDriverPhone,
          role: 'DRIVER',
          password: 'AnotherPassword123!',
        },
      });

      expect(response.statusCode).toBe(409);
      const json = response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CONFLICT');
    });
  });

  // 3. Staff Mobile Login Verification
  describe('Mobile App Login with Provisioned Staff Credentials', () => {
    it('should allow newly provisioned driver to log in via /auth/login and return DRIVER role and tenantId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: createdDriverPhone,
          password: 'DriverPassword123!',
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.user.role).toBe('DRIVER');
      expect(json.data.user.tenantId).toBe(operatorAId);
      expect(json.data.tokens.accessToken).toBeDefined();
    });
  });

  // 4. Staff Lifecycle Operations
  describe('Staff Status and Password Reset Operations', () => {
    it('should list staff members for Operator A including created driver', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/staff',
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.success).toBe(true);
      expect(json.data.staff.length).toBeGreaterThanOrEqual(2);
      expect(json.data.activeDrivers).toBeGreaterThanOrEqual(1);
      expect(json.data.activeConductors).toBeGreaterThanOrEqual(1);
    });

    it('should suspend staff member when isActive is set to false', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/staff/${createdDriverStaffId}/status`,
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.data.staff.isActive).toBe(false);
    });

    it('should reset staff password and allow login with new password', async () => {
      // 1. Reset password
      const resetRes = await app.inject({
        method: 'POST',
        url: `/api/v1/operator/staff/${createdDriverStaffId}/reset-password`,
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          newPassword: 'BrandNewPassword123!',
        },
      });

      expect(resetRes.statusCode).toBe(200);
      expect(resetRes.json().success).toBe(true);

      // 2. Reactivate driver
      await app.inject({
        method: 'PUT',
        url: `/api/v1/operator/staff/${createdDriverStaffId}/status`,
        headers: {
          authorization: `Bearer ${adminAToken}`,
        },
        payload: {
          isActive: true,
        },
      });

      // 3. Old password fails
      const oldPassLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: createdDriverPhone,
          password: 'DriverPassword123!',
        },
      });
      expect(oldPassLogin.statusCode).toBe(401);

      // 4. New password succeeds
      const newPassLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: createdDriverPhone,
          password: 'BrandNewPassword123!',
        },
      });
      expect(newPassLogin.statusCode).toBe(200);
    }, 20000);
  });

  // 5. Cross-Tenant Isolation Tests
  describe('Multi-Tenant RLS & Security Isolation', () => {
    it('Operator B cannot see Operator A staff members', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/staff',
        headers: {
          authorization: `Bearer ${adminBToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      const staffFromA = json.data.staff.find((s: any) => s.id === createdDriverStaffId);
      expect(staffFromA).toBeUndefined();
    });

    it('Operator B cannot modify or reset password for Operator A staff', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/operator/staff/${createdDriverStaffId}/reset-password`,
        headers: {
          authorization: `Bearer ${adminBToken}`,
        },
        payload: {
          newPassword: 'HackedPassword123!',
        },
      });

      expect([403, 404]).toContain(response.statusCode);
    });

    it('Non-admin user (Passenger) receives 403 Forbidden on operator endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/operator/staff',
        headers: {
          authorization: `Bearer ${passengerToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
