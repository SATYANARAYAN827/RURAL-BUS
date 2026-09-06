import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { db, sql, withSystemContext } from '@ruralbus/database';
import * as schema from '@ruralbus/database';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/services/password.service.js';
import { closeRedis } from '../src/services/redis.service.js';
import { requireRole } from '../src/plugins/rbac.js';

describe('Phase 4: Authentication & Identity Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();

    // Register a test-only RBAC protected route to verify requireRole guard
    app.get(
      '/test/operator-admin-only',
      {
        preHandler: [app.authenticate, requireRole(['OPERATOR_ADMIN'])],
      },
      async (req, reply) => {
        return reply.status(200).send({ success: true, message: 'Welcome Operator Admin' });
      }
    );

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await closeRedis();
  });

  describe('POST /api/v1/auth/register', () => {
    const testPhone = `987${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testEmail = `test.passenger.${Date.now()}@ruralbus.com`;

    it('should successfully register a new passenger user and return tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Ananya Deshmukh',
          phone: testPhone,
          email: testEmail,
          password: 'SecurePassword123!',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user).toBeDefined();
      expect(body.data.user.fullName).toBe('Ananya Deshmukh');
      expect(body.data.user.phone).toBe(testPhone);
      expect(body.data.user.email).toBe(testEmail);
      expect(body.data.user.role).toBe('PASSENGER');
      expect(body.data.user.tenantId).toBeNull();
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();

      // Verify Argon2id hash in database
      const [dbUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.phone, testPhone));
      expect(dbUser).toBeDefined();
      expect(dbUser.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('should reject registration with duplicate phone number', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Duplicate User',
          phone: testPhone,
          email: `other.${Date.now()}@ruralbus.com`,
          password: 'SecurePassword123!',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('Mobile number is already registered');
    });

    it('should reject registration with duplicate email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Duplicate Email User',
          phone: `987${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: testEmail,
          password: 'SecurePassword123!',
        },
      });

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('CONFLICT');
      expect(body.error.message).toContain('Email address is already registered');
    });

    it('should reject registration with invalid phone format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Invalid Phone User',
          phone: '12345', // Invalid Indian mobile
          password: 'SecurePassword123!',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login & Multi-Role Identity Resolution', () => {
    const sharedPassword = 'CommonPassword@123';
    let seededOperatorId: string;
    let passengerEmail: string;
    let adminEmail: string;
    let driverPhone: string;
    let conductorPhone: string;

    beforeAll(async () => {
      // Create dedicated test operator and users with known hashed password
      const hashedPassword = await hashPassword(sharedPassword);

      const [operator] = await db
        .insert(schema.operators)
        .values({
          companyName: 'Auth Test Transport Corp',
          businessCode: `AUTHTEST-${Date.now()}`,
          contactEmail: 'auth@test.com',
          contactPhone: '9900000000',
          status: 'ACTIVE',
        })
        .returning();
      seededOperatorId = operator.id;

      passengerEmail = `passenger.${Date.now()}@auth.com`;
      adminEmail = `admin.${Date.now()}@auth.com`;
      driverPhone = `981${Math.floor(1000000 + Math.random() * 9000000)}`;
      conductorPhone = `982${Math.floor(1000000 + Math.random() * 9000000)}`;

      const [pUser] = await db
        .insert(schema.users)
        .values({
          fullName: 'Test Passenger',
          email: passengerEmail,
          phone: `983${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      const [aUser] = await db
        .insert(schema.users)
        .values({
          fullName: 'Test Operator Admin',
          email: adminEmail,
          phone: `984${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      const [dUser] = await db
        .insert(schema.users)
        .values({
          fullName: 'Test Driver',
          email: `driver.${Date.now()}@auth.com`,
          phone: driverPhone,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      const [cUser] = await db
        .insert(schema.users)
        .values({
          fullName: 'Test Conductor',
          email: `conductor.${Date.now()}@auth.com`,
          phone: conductorPhone,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      // Assign tenant staff roles inside system context
      await withSystemContext(async (tx) => {
        await tx.insert(schema.operatorMembers).values([
          { userId: aUser.id, tenantId: seededOperatorId, role: 'OPERATOR_ADMIN' },
          { userId: dUser.id, tenantId: seededOperatorId, role: 'DRIVER' },
          { userId: cUser.id, tenantId: seededOperatorId, role: 'CONDUCTOR' },
        ]);
      });
    });

    it('should authenticate Passenger and resolve role PASSENGER with null tenantId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: passengerEmail,
          password: sharedPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('PASSENGER');
      expect(body.data.user.tenantId).toBeNull();
      expect(body.data.tokens.accessToken).toBeDefined();
    });

    it('should authenticate Operator Admin and resolve role OPERATOR_ADMIN with tenantId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: adminEmail,
          password: sharedPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('OPERATOR_ADMIN');
      expect(body.data.user.tenantId).toBe(seededOperatorId);
    });

    it('should authenticate Driver by phone and resolve role DRIVER with tenantId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: driverPhone,
          password: sharedPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('DRIVER');
      expect(body.data.user.tenantId).toBe(seededOperatorId);
    });

    it('should authenticate Conductor by phone and resolve role CONDUCTOR with tenantId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: conductorPhone,
          password: sharedPassword,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.role).toBe('CONDUCTOR');
      expect(body.data.user.tenantId).toBe(seededOperatorId);
    });

    it('should reject login with wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: passengerEmail,
          password: 'IncorrectPassword999!',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject login for non-existent user identifier', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          identifier: 'nonexistent@nowhere.com',
          password: sharedPassword,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/auth/me & Token Verification', () => {
    let validToken: string;

    beforeAll(async () => {
      // Register temporary user to get token
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Profile Tester',
          phone: `986${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `profile.${Date.now()}@ruralbus.com`,
          password: 'Password@123',
        },
      });
      const body = JSON.parse(res.body);
      validToken = body.data.tokens.accessToken;
    });

    it('should return current user profile when valid Bearer token is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${validToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.user.fullName).toBe('Profile Tester');
      expect(body.data.user.role).toBe('PASSENGER');
    });

    it('should reject request when Authorization header is missing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject request when token signature is invalid or forged', async () => {
      const forgedToken = validToken.slice(0, -5) + 'xxxxx';
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: {
          authorization: `Bearer ${forgedToken}`,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Refresh Token Rotation & Revocation', () => {
    let initialRefreshToken: string;
    let rotatedRefreshToken: string;

    beforeAll(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          fullName: 'Rotation Tester',
          phone: `985${Math.floor(1000000 + Math.random() * 9000000)}`,
          email: `rotation.${Date.now()}@ruralbus.com`,
          password: 'Password@123',
        },
      });
      const body = JSON.parse(res.body);
      initialRefreshToken = body.data.tokens.refreshToken;
    });

    it('should successfully exchange a valid refresh token for a new access token and rotated refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: initialRefreshToken,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.data.tokens.accessToken).toBeDefined();
      expect(body.data.tokens.refreshToken).toBeDefined();
      expect(body.data.tokens.refreshToken).not.toBe(initialRefreshToken);

      rotatedRefreshToken = body.data.tokens.refreshToken;
    });

    it('should reject reuse of already-rotated refresh token (replay prevention)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: initialRefreshToken, // Re-using old token
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should revoke active session upon logout', async () => {
      // Logout using the active rotated token
      const logoutRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        payload: {
          refreshToken: rotatedRefreshToken,
        },
      });

      expect(logoutRes.statusCode).toBe(200);

      // Attempting to refresh using the logged-out token must fail
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: {
          refreshToken: rotatedRefreshToken,
        },
      });

      expect(refreshRes.statusCode).toBe(401);
    });
  });

  describe('RBAC Guard (requireRole)', () => {
    let passengerToken: string;
    let operatorAdminToken: string;

    beforeAll(async () => {
      const hashedPassword = await hashPassword('RBACPassword@123');

      // Operator
      const [op] = await db
        .insert(schema.operators)
        .values({
          companyName: 'RBAC Test Operator',
          businessCode: `RBAC-${Date.now()}`,
          contactEmail: 'rbac@test.com',
          contactPhone: '9888888888',
          status: 'ACTIVE',
        })
        .returning();

      // Passenger User
      const [pUser] = await db
        .insert(schema.users)
        .values({
          fullName: 'RBAC Passenger',
          email: `rbac.passenger.${Date.now()}@ruralbus.com`,
          phone: `984${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      // Operator Admin User
      const [aUser] = await db
        .insert(schema.users)
        .values({
          fullName: 'RBAC Admin',
          email: `rbac.admin.${Date.now()}@ruralbus.com`,
          phone: `985${Math.floor(1000000 + Math.random() * 9000000)}`,
          passwordHash: hashedPassword,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      await withSystemContext(async (tx) => {
        await tx.insert(schema.operatorMembers).values({
          userId: aUser.id,
          tenantId: op.id,
          role: 'OPERATOR_ADMIN',
        });
      });

      // Login Passenger
      const pLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: pUser.email, password: 'RBACPassword@123' },
      });
      passengerToken = JSON.parse(pLogin.body).data.tokens.accessToken;

      // Login Admin
      const aLogin = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { identifier: aUser.email, password: 'RBACPassword@123' },
      });
      operatorAdminToken = JSON.parse(aLogin.body).data.tokens.accessToken;
    });

    it('should reject PASSENGER role accessing OPERATOR_ADMIN protected endpoint with 403 Forbidden', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test/operator-admin-only',
        headers: {
          authorization: `Bearer ${passengerToken}`,
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should allow OPERATOR_ADMIN role accessing OPERATOR_ADMIN protected endpoint with 200 OK', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/test/operator-admin-only',
        headers: {
          authorization: `Bearer ${operatorAdminToken}`,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Welcome Operator Admin');
    });
  });
});
