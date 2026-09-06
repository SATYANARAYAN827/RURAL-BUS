import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { db, withSystemContext, users, operators, operatorMembers, buses } from '@ruralbus/database';
import { eq, ne } from 'drizzle-orm';
import { hashPassword, verifyPassword } from '../src/services/password.service.js';

describe('Super Admin Operator & Owner Provisioning Flow', () => {
  let app: FastifyInstance;
  let superAdminToken: string;
  let operatorAdminToken: string;
  let passengerToken: string;

  const testTimestamp = Date.now();
  const superAdminPhone = `98700${testTimestamp.toString().slice(-5)}`;
  const existingOperatorPhone = `98701${testTimestamp.toString().slice(-5)}`;
  const passengerPhone = `98702${testTimestamp.toString().slice(-5)}`;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();

    const pwdHash = await hashPassword('TestSuperAdmin123!');

    await withSystemContext(async (tx) => {
      // 1. Create Super Admin (PLATFORM_ADMIN)
      const [saUser] = await tx
        .insert(users)
        .values({
          fullName: 'Super Admin Tester',
          phone: superAdminPhone,
          email: `sa-${testTimestamp}@ruralbus.gov.in`,
          passwordHash: pwdHash,
          role: 'PLATFORM_ADMIN',
          isActive: true,
        })
        .returning();

      // 2. Create an existing operator for isolation testing
      const [op] = await tx
        .insert(operators)
        .values({
          companyName: `Baseline Operator ${testTimestamp}`,
          businessCode: `BASE-${testTimestamp.toString().slice(-6)}`,
          contactEmail: `base-${testTimestamp}@transport.com`,
          contactPhone: existingOperatorPhone,
          status: 'ACTIVE',
        })
        .returning();

      // 3. Create Operator Admin
      const [opAdminUser] = await tx
        .insert(users)
        .values({
          fullName: 'Existing Owner',
          phone: existingOperatorPhone,
          email: `owner-${testTimestamp}@transport.com`,
          passwordHash: pwdHash,
          role: 'PASSENGER',
          isActive: true,
        })
        .returning();

      await tx.insert(operatorMembers).values({
        userId: opAdminUser.id,
        tenantId: op.id,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      });

      // 4. Create a regular passenger
      await tx.insert(users).values({
        fullName: 'Regular Passenger',
        phone: passengerPhone,
        email: `pass-${testTimestamp}@gmail.com`,
        passwordHash: pwdHash,
        role: 'PASSENGER',
        isActive: true,
      });
    });

    // Generate tokens via login
    const saLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: superAdminPhone, password: 'TestSuperAdmin123!' },
    });
    superAdminToken = saLogin.json().data.tokens.accessToken;

    const opLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: existingOperatorPhone, password: 'TestSuperAdmin123!' },
    });
    operatorAdminToken = opLogin.json().data.tokens.accessToken;

    const passLogin = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: passengerPhone, password: 'TestSuperAdmin123!' },
    });
    passengerToken = passLogin.json().data.tokens.accessToken;
  });

  afterAll(async () => {
    await withSystemContext(async (tx) => {
      await tx.delete(operators).where(ne(operators.id, 'a54b0153-8246-4f88-bba9-7ef85b51a6ed'));
      await tx.delete(users).where(eq(users.phone, superAdminPhone));
      await tx.delete(users).where(eq(users.phone, existingOperatorPhone));
      await tx.delete(users).where(eq(users.phone, passengerPhone));
    });
    await app.close();
  });

  it('1. should reject unauthenticated requests to POST /api/v1/tenant/operators', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      payload: {
        companyName: 'Unauthorized Transit',
        ownerName: 'Unauthorized Owner',
        phone: '9871234567',
        email: 'unauth@transit.com',
        password: 'InitialPassword123!',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('2. should reject non-platform-admins (OPERATOR_ADMIN) with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${operatorAdminToken}` },
      payload: {
        companyName: 'Rogue Operator Transit',
        ownerName: 'Rogue Owner',
        phone: '9871234568',
        email: 'rogue@transit.com',
        password: 'InitialPassword123!',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('3. should reject passengers with 403 Forbidden', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${passengerToken}` },
      payload: {
        companyName: 'Passenger Transit',
        ownerName: 'Passenger Owner',
        phone: '9871234569',
        email: 'passenger@transit.com',
        password: 'InitialPassword123!',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('4. should reject operator creation without required initial password (min 8 chars)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        companyName: 'Short Pwd Transit',
        ownerName: 'Owner Name',
        phone: '9871234570',
        email: 'shortpwd@transit.com',
        password: 'short', // less than 8 chars
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error.message).toContain('Password must be at least 8 characters long');
  });

  it('5. should successfully create operator, owner user, and OPERATOR_ADMIN membership in PostgreSQL', async () => {
    const newOwnerPhone = `98799${Date.now().toString().slice(-5)}`;
    const newOwnerEmail = `newowner-${Date.now()}@himalayan.com`;
    const initialPassword = 'InitialSecurePass2026!';

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        companyName: `Himalayan Rural Transit ${Date.now()}`,
        ownerName: 'Rajesh Sharma',
        phone: newOwnerPhone,
        email: newOwnerEmail,
        password: initialPassword,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);

    const createdOp = body.data.operator;
    const createdOwner = body.data.owner;
    const sms = body.data.sms;

    expect(createdOp.id).toBeDefined();
    expect(createdOp.status).toBe('ACTIVE');
    expect(createdOp.businessCode).toBeDefined();
    expect(createdOwner.id).toBeDefined();
    expect(createdOwner.role).toBe('OPERATOR_ADMIN');
    expect(createdOwner.phone).toBe(newOwnerPhone);

    // 6. Security & Plaintext Verification: Plaintext password is NEVER returned in API
    expect(body.data).not.toHaveProperty('password');
    expect(body.data).not.toHaveProperty('initialPassword');
    expect(createdOp).not.toHaveProperty('password');
    expect(createdOwner).not.toHaveProperty('password');
    expect(createdOwner).not.toHaveProperty('passwordHash');

    // 7. Honest SMS Reporting: Never fake SMS delivery
    expect(sms).toBeDefined();
    expect(sms.maskedPhone).toContain('****');
    expect(typeof sms.sent).toBe('boolean');

    // 8. Direct PostgreSQL verification
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, createdOwner.id))
      .limit(1);

    expect(dbUser).toBeDefined();
    expect(dbUser.fullName).toBe('Rajesh Sharma');
    expect(dbUser.phone).toBe(newOwnerPhone);

    // CRITICAL SECURITY: development_password must be null, no plaintext storage!
    expect(dbUser.developmentPassword).toBeNull();

    // CRITICAL SECURITY: password must be hashed with Argon2id
    expect(dbUser.passwordHash.startsWith('$argon2id$')).toBe(true);
    const isPasswordValid = await verifyPassword(dbUser.passwordHash, initialPassword);
    expect(isPasswordValid).toBe(true);

    // must_change_password must be true
    expect(dbUser.mustChangePassword).toBe(true);

    // 9. Verify operator_members relationship in PostgreSQL (using withSystemContext for RLS)
    const [dbMember] = await withSystemContext(async (tx) => {
      return tx
        .select()
        .from(operatorMembers)
        .where(eq(operatorMembers.userId, createdOwner.id))
        .limit(1);
    });

    expect(dbMember).toBeDefined();
    expect(dbMember.tenantId).toBe(createdOp.id);
    expect(dbMember.role).toBe('OPERATOR_ADMIN');
    expect(dbMember.isActive).toBe(true);

    // 10. Tenant Isolation: New transport must have exactly 0 buses
    const newTenantBuses = await withSystemContext(async (tx) => {
      return tx
        .select()
        .from(buses)
        .where(eq(buses.tenantId, createdOp.id));
    });

    expect(newTenantBuses.length).toBe(0);


    // 11. New Owner can log in and resolves to OPERATOR_ADMIN with their unique tenant ID
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: newOwnerPhone,
        password: initialPassword,
      },
    });

    expect(loginRes.statusCode).toBe(200);
    const loginData = loginRes.json().data;
    expect(loginData.user.role).toBe('OPERATOR_ADMIN');
    expect(loginData.user.tenantId).toBe(createdOp.id);
    expect(loginData.user.mustChangePassword).toBe(true);
  });

  it('6. should reject duplicate mobile numbers with 409 Conflict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        companyName: `Duplicate Phone Transit ${Date.now()}`,
        ownerName: 'Duplicate Owner',
        phone: existingOperatorPhone, // already exists
        email: `unique-${Date.now()}@transit.com`,
        password: 'ValidPassword123!',
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.message).toContain('mobile number is already registered');
  });

  it('7. should return enriched operator list via GET /api/v1/tenant/operators', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${superAdminToken}` },
    });

    expect(res.statusCode).toBe(200);
    const operatorsList = res.json().data.operators;
    expect(Array.isArray(operatorsList)).toBe(true);
    expect(operatorsList.length).toBeGreaterThanOrEqual(1);

    const firstOp = operatorsList[0];
    expect(firstOp).toHaveProperty('id');
    expect(firstOp).toHaveProperty('companyName');
    expect(firstOp).toHaveProperty('ownerName');
    expect(firstOp).toHaveProperty('ownerPhone');
    expect(firstOp).toHaveProperty('busesCount');
    expect(firstOp).toHaveProperty('staffCount');
    expect(typeof firstOp.busesCount).toBe('number');
    expect(typeof firstOp.staffCount).toBe('number');
  });

  it('8. should successfully create operator without providing email (email is optional)', async () => {
    const phoneNoEmail = `98788${Date.now().toString().slice(-5)}`;
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/tenant/operators',
      headers: { authorization: `Bearer ${superAdminToken}` },
      payload: {
        companyName: `EmailFree Rural Lines ${Date.now()}`,
        ownerName: 'Sunil Mahanta',
        phone: phoneNoEmail,
        password: 'Password123!',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.operator.companyName).toContain('EmailFree Rural Lines');
    expect(body.data.owner.phone).toBe(phoneNoEmail);
  });
});
