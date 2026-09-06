import { z } from 'zod';

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Email or phone is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerPassengerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type RegisterPassengerInput = z.infer<typeof registerPassengerSchema>;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export const requestOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
  purpose: z.enum(['FIRST_LOGIN_VERIFICATION', 'PASSWORD_RESET', 'REGISTRATION']).default('PASSWORD_RESET'),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;

export const verifyOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid 10-digit mobile number'),
  otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit numeric code'),
  purpose: z.enum(['FIRST_LOGIN_VERIFICATION', 'PASSWORD_RESET', 'REGISTRATION']).default('PASSWORD_RESET'),
});

export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const resetPasswordWithOtpSchema = z.object({
  resetToken: z.string().min(10, 'Valid reset token is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export type ResetPasswordWithOtpInput = z.infer<typeof resetPasswordWithOtpSchema>;

export const forceChangePasswordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

export type ForceChangePasswordInput = z.infer<typeof forceChangePasswordSchema>;
