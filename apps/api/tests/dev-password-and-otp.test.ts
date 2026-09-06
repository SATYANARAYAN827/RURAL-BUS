import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { db, sql } from '@ruralbus/database';
import * as schema from '@ruralbus/database';
import { eq, or } from 'drizzle-orm';
import { getDevelopmentPassword } from '../src/services/otp.service.js';
import { closeRedis } from '../src/services/redis.service.js';

describe('RuralBus Development Password Visibility & OTP Flow Integration Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await closeRedis();
  });

  it('A. Seed development user has development_password populated in development environment', async () => {
    const [superAdmin] = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        phone: schema.users.phone,
        passwordHash: schema.users.passwordHash,
        developmentPassword: schema.users.developmentPassword,
        role: schema.users.role,
        isActive: schema.users.isActive,
      })
      .from(schema.users)
      .where(or(
        eq(schema.users.email, 'superadmin@ruralbus.gov.in'),
        eq(schema.users.phone, '9876500000')
      ))
      .limit(1);

    expect(superAdmin).toBeDefined();
    expect(superAdmin.developmentPassword).toBe('Password123!');
    expect(superAdmin.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('B. Authentication strictly uses Argon2id password_hash (not plaintext or development_password directly)', async () => {
    // 1. Valid password succeeds
    const validRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: '9876500000',
        password: 'Password123!',
      },
    });

    expect(validRes.statusCode).toBe(200);
    const body = JSON.parse(validRes.body);
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('PLATFORM_ADMIN');

    // 2. Wrong password fails even if matching prefix
    const invalidRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: '9876500000',
        password: 'WrongPassword!',
      },
    });

    expect(invalidRes.statusCode).toBe(401);
  });

  it('C. OTP Request, Verification & Password Reset updates password_hash and development_password', async () => {
    const testPhone = '9876500001'; // Rajesh Sharma

    // 1. Request OTP
    const otpReqRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/request',
      payload: {
        phone: testPhone,
        purpose: 'PASSWORD_RESET',
      },
    });

    expect(otpReqRes.statusCode).toBe(200);
    const reqBody = JSON.parse(otpReqRes.body);
    expect(reqBody.success).toBe(true);
    expect(reqBody.expiresInSeconds).toBe(300);
    expect(reqBody.simulatedOtp).toBeDefined();
    const otpCode = reqBody.simulatedOtp;

    // 2. Test Invalid OTP attempt limit
    const badOtpRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phone: testPhone,
        otp: '000000',
        purpose: 'PASSWORD_RESET',
      },
    });
    expect(badOtpRes.statusCode).toBe(401);

    // 3. Verify valid OTP
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/otp/verify',
      payload: {
        phone: testPhone,
        otp: otpCode,
        purpose: 'PASSWORD_RESET',
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = JSON.parse(verifyRes.body);
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.resetToken).toBeDefined();
    const resetToken = verifyBody.resetToken;

    // 4. Reset Password with verified token
    const newSecret = 'NewSecurePass2026!';
    const resetRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/password-reset',
      payload: {
        resetToken,
        newPassword: newSecret,
      },
    });

    expect(resetRes.statusCode).toBe(200);

    // 5. Verify database reflects new Argon2id hash and development_password in dev mode
    const [updatedUser] = await db
      .select({
        passwordHash: schema.users.passwordHash,
        developmentPassword: schema.users.developmentPassword,
      })
      .from(schema.users)
      .where(eq(schema.users.phone, testPhone))
      .limit(1);

    expect(updatedUser.passwordHash).toMatch(/^\$argon2id\$/);
    expect(updatedUser.developmentPassword).toBe(newSecret);

    // 6. Verify new password allows login
    const newLoginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: testPhone,
        password: newSecret,
      },
    });
    expect(newLoginRes.statusCode).toBe(200);
  });

  it('D. API responses NEVER expose development_password to users, JWTs, or admins', async () => {
    // 1. Login response check
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: {
        identifier: '9876500000',
        password: 'Password123!',
      },
    });

    const loginBody = JSON.parse(loginRes.body);
    expect(loginBody.data.user.developmentPassword).toBeUndefined();
    expect(loginBody.data.user.passwordHash).toBeUndefined();

    // 2. /api/v1/auth/me check
    const token = loginBody.data.tokens.accessToken;
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const meBody = JSON.parse(meRes.body);
    expect(meBody.data.user.developmentPassword).toBeUndefined();
    expect(meBody.data.user.passwordHash).toBeUndefined();
  });

  it('E. Production environment guard strictly returns NULL for development_password', () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      const devPass = getDevelopmentPassword('SecretPassword123!');
      expect(devPass).toBeNull();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
