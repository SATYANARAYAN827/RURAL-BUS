import { randomBytes } from 'node:crypto';
import { db, sql, withSystemContext } from '@ruralbus/database';
import * as schema from '@ruralbus/database';
import { eq, or, and } from 'drizzle-orm';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../errors/AppError.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { getDevelopmentPassword } from './otp.service.js';
import {
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  RefreshTokenSessionData,
} from './redis.service.js';
import type {
  AuthUser,
  AuthTokens,
  LoginResponse,
  AppUserRole,
  JwtAccessTokenPayload,
  ResetPasswordResponse,
} from '@ruralbus/shared-types';
import type {
  LoginInput,
  RegisterPassengerInput,
  RefreshTokenInput,
  ResetPasswordWithOtpInput,
  ForceChangePasswordInput,
} from '@ruralbus/shared-validators';

export type JwtSignerFn = (payload: JwtAccessTokenPayload) => string;

function generateOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Resolves effective user role and tenant context by checking operator memberships.
 */
async function resolveUserRoleAndTenant(userId: string, defaultRole: AppUserRole): Promise<{
  role: AppUserRole;
  tenantId: string | null;
}> {
  return withSystemContext(async (tx) => {
    const members = await tx
      .select({
        memberRole: schema.operatorMembers.role,
        tenantId: schema.operatorMembers.tenantId,
        operatorStatus: schema.operators.status,
      })
      .from(schema.operatorMembers)
      .innerJoin(
        schema.operators,
        eq(schema.operatorMembers.tenantId, schema.operators.id)
      )
      .where(
        and(
          eq(schema.operatorMembers.userId, userId),
          eq(schema.operatorMembers.isActive, true),
          eq(schema.operators.status, 'ACTIVE')
        )
      )
      .limit(1);

    if (members.length > 0) {
      return {
        role: members[0].memberRole as AppUserRole,
        tenantId: members[0].tenantId,
      };
    }

    return {
      role: defaultRole,
      tenantId: null,
    };
  });
}

export async function registerPassenger(
  input: RegisterPassengerInput,
  jwtSigner: JwtSignerFn
): Promise<LoginResponse> {
  const normalizedPhone = input.phone.trim();
  const normalizedEmail = input.email ? input.email.trim().toLowerCase() : null;

  // 1. Check if phone is already registered
  const existingPhone = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.phone, normalizedPhone))
    .limit(1);

  if (existingPhone.length > 0) {
    throw new ConflictError('Mobile number is already registered');
  }

  // 2. Check if email is already registered (if provided)
  if (normalizedEmail) {
    const existingEmail = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existingEmail.length > 0) {
      throw new ConflictError('Email address is already registered');
    }
  }

  // 3. Hash password via Argon2id
  const passwordHash = await hashPassword(input.password);

  // 4. Insert user record
  const developmentPassword = getDevelopmentPassword(input.password);
  const [newUser] = await db
    .insert(schema.users)
    .values({
      fullName: input.fullName.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      passwordHash,
      developmentPassword,
      role: 'PASSENGER',
      isActive: true,
      mustChangePassword: false,
      phoneVerified: true,
    })
    .returning();

  const authUser: AuthUser = {
    id: newUser.id,
    fullName: newUser.fullName,
    email: newUser.email,
    phone: newUser.phone,
    role: 'PASSENGER',
    tenantId: null,
    isActive: newUser.isActive,
    mustChangePassword: newUser.mustChangePassword,
    phoneVerified: newUser.phoneVerified,
    lastLoginAt: newUser.lastLoginAt?.toISOString() || null,
    createdAt: newUser.createdAt.toISOString(),
    updatedAt: newUser.updatedAt.toISOString(),
  };

  // 5. Issue JWT & Refresh Token
  const accessToken = jwtSigner({
    sub: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    mustChangePassword: authUser.mustChangePassword,
  });

  const refreshToken = generateOpaqueToken();
  await saveRefreshToken(refreshToken, {
    userId: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId ?? null,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    createdAt: Date.now(),
  });

  return {
    user: authUser,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    },
  };
}

export async function login(
  input: LoginInput,
  jwtSigner: JwtSignerFn
): Promise<LoginResponse> {
  const identifier = input.identifier.trim();

  // 1. Query user by email or phone
  const usersFound = await db
    .select()
    .from(schema.users)
    .where(
      or(
        eq(schema.users.email, identifier.toLowerCase()),
        eq(schema.users.phone, identifier)
      )
    )
    .limit(1);

  if (usersFound.length === 0) {
    throw new UnauthorizedError('Invalid email/phone or password');
  }

  const user = usersFound[0];

  if (!user.isActive) {
    throw new UnauthorizedError('Account has been deactivated. Please contact support.');
  }

  // 2. Verify password strictly with Argon2id (NEVER authenticate using development_password)
  const isMatch = await verifyPassword(user.passwordHash, input.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email/phone or password');
  }

  // 3. Update last login timestamp
  const now = new Date();
  await db
    .update(schema.users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(schema.users.id, user.id));

  // 4. Resolve role and tenantId from operator memberships
  const { role, tenantId } = await resolveUserRoleAndTenant(user.id, user.role);

  const authUser: AuthUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role,
    tenantId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    phoneVerified: user.phoneVerified,
    lastLoginAt: now.toISOString(),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  // 5. Issue JWT & Refresh Token
  const accessToken = jwtSigner({
    sub: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    mustChangePassword: authUser.mustChangePassword,
  });

  const refreshToken = generateOpaqueToken();
  await saveRefreshToken(refreshToken, {
    userId: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId ?? null,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    createdAt: Date.now(),
  });

  return {
    user: authUser,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 900,
    },
  };
}

export async function refreshTokens(
  input: RefreshTokenInput,
  jwtSigner: JwtSignerFn
): Promise<LoginResponse> {
  const session = await getRefreshToken(input.refreshToken);
  if (!session) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Rotate token: revoke old token immediately
  await revokeRefreshToken(input.refreshToken);

  // Re-verify user status in DB
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User account not found or inactive');
  }

  const { role, tenantId } = await resolveUserRoleAndTenant(user.id, user.role);

  const authUser: AuthUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role,
    tenantId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    phoneVerified: user.phoneVerified,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };

  // Issue new access token & new rotated refresh token
  const newAccessToken = jwtSigner({
    sub: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    mustChangePassword: authUser.mustChangePassword,
  });

  const newRefreshToken = generateOpaqueToken();
  await saveRefreshToken(newRefreshToken, {
    userId: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId ?? null,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    createdAt: Date.now(),
  });

  return {
    user: authUser,
    tokens: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    },
  };
}

export async function logout(refreshToken?: string): Promise<{ success: boolean }> {
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  return { success: true };
}

export async function getProfile(userId: string): Promise<AuthUser> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('User not found');
  }

  const { role, tenantId } = await resolveUserRoleAndTenant(user.id, user.role);

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role,
    tenantId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    phoneVerified: user.phoneVerified,
    lastLoginAt: user.lastLoginAt?.toISOString() || null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function resetPasswordWithToken(
  input: ResetPasswordWithOtpInput
): Promise<ResetPasswordResponse> {
  const [otpRecord] = await db
    .select()
    .from(schema.otpVerifications)
    .where(eq(schema.otpVerifications.resetToken, input.resetToken))
    .limit(1);

  if (!otpRecord || !otpRecord.verifiedAt) {
    throw new BadRequestError('Invalid or expired password reset authorization.');
  }

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  if (otpRecord.verifiedAt < fifteenMinutesAgo) {
    throw new BadRequestError('Password reset authorization has expired. Please request a new OTP.');
  }

  // 1. Hash new password with Argon2id
  const passwordHash = await hashPassword(input.newPassword);
  const developmentPassword = getDevelopmentPassword(input.newPassword);

  // 2. Update user credentials
  await db
    .update(schema.users)
    .set({
      passwordHash,
      developmentPassword,
      mustChangePassword: false,
      phoneVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.phone, otpRecord.phone));

  // 3. Invalidate reset token on otp_verifications
  await db
    .update(schema.otpVerifications)
    .set({ resetToken: null })
    .where(eq(schema.otpVerifications.id, otpRecord.id));

  return {
    success: true,
    message: 'Your password has been reset successfully. You may now log in with your new password.',
  };
}

export async function forceChangePassword(
  userId: string,
  input: ForceChangePasswordInput,
  jwtSigner: JwtSignerFn
): Promise<LoginResponse> {
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User account not found or inactive');
  }

  // 1. Verify current password with Argon2id
  const isMatch = await verifyPassword(user.passwordHash, input.currentPassword);
  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // 2. Hash new password with Argon2id
  const passwordHash = await hashPassword(input.newPassword);
  const developmentPassword = getDevelopmentPassword(input.newPassword);

  // 3. Update user password and clear mustChangePassword
  const [updatedUser] = await db
    .update(schema.users)
    .set({
      passwordHash,
      developmentPassword,
      mustChangePassword: false,
      phoneVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning();

  const { role, tenantId } = await resolveUserRoleAndTenant(updatedUser.id, updatedUser.role);

  const authUser: AuthUser = {
    id: updatedUser.id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
    phone: updatedUser.phone,
    role,
    tenantId,
    isActive: updatedUser.isActive,
    mustChangePassword: false,
    phoneVerified: true,
    lastLoginAt: updatedUser.lastLoginAt?.toISOString() || null,
    createdAt: updatedUser.createdAt.toISOString(),
    updatedAt: updatedUser.updatedAt.toISOString(),
  };

  const accessToken = jwtSigner({
    sub: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    mustChangePassword: false,
  });

  const refreshToken = generateOpaqueToken();
  await saveRefreshToken(refreshToken, {
    userId: authUser.id,
    role: authUser.role,
    tenantId: authUser.tenantId ?? null,
    email: authUser.email,
    phone: authUser.phone,
    fullName: authUser.fullName,
    createdAt: Date.now(),
  });

  return {
    user: authUser,
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: 900,
    },
  };
}

