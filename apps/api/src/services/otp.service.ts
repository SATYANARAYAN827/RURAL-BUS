import { randomBytes, createHmac, randomInt } from 'node:crypto';
import { db } from '@ruralbus/database';
import * as schema from '@ruralbus/database';
import { eq, and, gt, desc } from 'drizzle-orm';
import { BadRequestError, NotFoundError, UnauthorizedError, ConflictError } from '../errors/AppError.js';
import type { RequestOtpInput, VerifyOtpInput } from '@ruralbus/shared-validators';
import type { RequestOtpResponse, VerifyOtpResponse } from '@ruralbus/shared-types';
import { sendSmsOtp } from './sms.service.js';

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const MAX_ATTEMPTS = 5;
const HMAC_SECRET = process.env.JWT_SECRET || 'ruralbus_otp_secure_hmac_secret_fallback_key';

/**
 * Computes a secure SHA-256 HMAC hash of the OTP code so plaintext OTPs are never stored.
 */
function hashOtp(phone: string, otp: string, purpose: string): string {
  return createHmac('sha256', HMAC_SECRET)
    .update(`${phone.trim()}:${purpose}:${otp.trim()}`)
    .digest('hex');
}

/**
 * Generates a cryptographically random 6-digit numeric OTP code.
 */
function generate6DigitOtp(): string {
  return randomInt(100000, 999999).toString();
}

/**
 * Helper to determine whether development password or simulated OTP should be made available.
 * STRICTLY returns null/undefined in production (NODE_ENV === 'production').
 */
export function getDevelopmentPassword(rawPassword: string): string | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return rawPassword;
}

export async function requestOtp(input: RequestOtpInput): Promise<RequestOtpResponse> {
  const normalizedPhone = input.phone.trim();
  const purpose = input.purpose || 'PASSWORD_RESET';

  // 1. Account existence validation based on OTP purpose
  const [user] = await db
    .select({ id: schema.users.id, isActive: schema.users.isActive })
    .from(schema.users)
    .where(eq(schema.users.phone, normalizedPhone))
    .limit(1);

  if (purpose === 'PASSWORD_RESET' && !user) {
    throw new NotFoundError('No account registered with this mobile number');
  }

  if (purpose === 'REGISTRATION' && user) {
    throw new ConflictError('An account with this mobile number already exists. Please log in instead.');
  }

  if (user && !user.isActive) {
    throw new UnauthorizedError('User account is suspended or inactive');
  }

  // 2. Generate 6-digit OTP
  const rawOtp = generate6DigitOtp();
  const otpHash = hashOtp(normalizedPhone, rawOtp, purpose);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

  // 3. Store OTP record with 5-minute expiry
  await db.insert(schema.otpVerifications).values({
    phone: normalizedPhone,
    otpHash,
    purpose,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    expiresAt,
  });

  // 4. Dispatch real telecom SMS via configured SMS Gateway
  const smsResult = await sendSmsOtp({
    phone: normalizedPhone,
    otp: rawOtp,
    purpose,
  });

  // If the SMS gateway dispatched an effective OTP code (e.g. from Twilio trial template), sync the hash in DB
  const effectiveOtp = smsResult.dispatchedOtp || rawOtp;
  if (effectiveOtp !== rawOtp) {
    const updatedHash = hashOtp(normalizedPhone, effectiveOtp, purpose);
    await db
      .update(schema.otpVerifications)
      .set({ otpHash: updatedHash })
      .where(
        and(
          eq(schema.otpVerifications.phone, normalizedPhone),
          eq(schema.otpVerifications.purpose, purpose)
        )
      );
  }

  // Simulated OTP is suppressed when live provider succeeds, but provided in non-production if gateway is pending verification
  const isLiveProvider = process.env.SMS_PROVIDER && process.env.SMS_PROVIDER !== 'mock';
  const simulatedOtp = (process.env.NODE_ENV === 'production' || (isLiveProvider && smsResult.success)) ? undefined : effectiveOtp;

  return {
    success: true,
    message: smsResult.success
      ? `OTP has been sent to registered mobile ending with ${normalizedPhone.slice(-4)}. Valid for 5 minutes.`
      : `OTP generated for mobile ending with ${normalizedPhone.slice(-4)}. (${smsResult.message || 'SMS pending'})`,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    simulatedOtp,
  };
}

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResponse> {
  const normalizedPhone = input.phone.trim();
  const purpose = input.purpose || 'PASSWORD_RESET';
  const enteredOtp = input.otp.trim();

  // 1. Find the latest active OTP verification record for this phone and purpose
  const [record] = await db
    .select()
    .from(schema.otpVerifications)
    .where(
      and(
        eq(schema.otpVerifications.phone, normalizedPhone),
        eq(schema.otpVerifications.purpose, purpose),
        gt(schema.otpVerifications.expiresAt, new Date())
      )
    )
    .orderBy(desc(schema.otpVerifications.createdAt))
    .limit(1);

  if (!record) {
    throw new BadRequestError('OTP has expired or does not exist. Please request a new OTP.');
  }

  if (record.verifiedAt) {
    throw new BadRequestError('This OTP code has already been used. Please request a new OTP.');
  }

  if (record.attempts >= record.maxAttempts) {
    throw new BadRequestError('Maximum verification attempts exceeded. Please request a new OTP.');
  }

  // 2. Verify OTP hash
  const expectedHash = hashOtp(normalizedPhone, enteredOtp, purpose);
  const isMatch = record.otpHash === expectedHash;

  if (!isMatch) {
    // Increment attempts
    await db
      .update(schema.otpVerifications)
      .set({ attempts: record.attempts + 1 })
      .where(eq(schema.otpVerifications.id, record.id));

    const remainingAttempts = record.maxAttempts - (record.attempts + 1);
    throw new UnauthorizedError(
      `Invalid OTP code. ${remainingAttempts > 0 ? `${remainingAttempts} attempt(s) remaining.` : 'Maximum attempts reached.'}`
    );
  }

  // 3. Mark OTP as verified and issue a 15-minute single-use reset token
  const resetToken = randomBytes(32).toString('hex');
  await db
    .update(schema.otpVerifications)
    .set({
      verifiedAt: new Date(),
      resetToken,
    })
    .where(eq(schema.otpVerifications.id, record.id));

  // 4. If purpose was FIRST_LOGIN_VERIFICATION, mark user phone_verified
  if (purpose === 'FIRST_LOGIN_VERIFICATION') {
    await db
      .update(schema.users)
      .set({ phoneVerified: true, updatedAt: new Date() })
      .where(eq(schema.users.phone, normalizedPhone));
  }

  return {
    success: true,
    message: 'OTP verified successfully.',
    resetToken,
    phoneVerified: true,
  };
}
