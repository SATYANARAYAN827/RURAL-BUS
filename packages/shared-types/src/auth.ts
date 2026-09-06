export type GlobalUserRole = 'PASSENGER' | 'PLATFORM_ADMIN';

export type OperatorMemberRole = 'OPERATOR_ADMIN' | 'DRIVER' | 'CONDUCTOR';

export type AppUserRole = GlobalUserRole | OperatorMemberRole;

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: AppUserRole;
  tenantId?: string | null;
  isActive: boolean;
  mustChangePassword?: boolean;
  phoneVerified?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JwtAccessTokenPayload {
  sub: string; // User ID
  role: AppUserRole;
  tenantId?: string | null; // null for platform passengers
  email?: string | null;
  phone?: string | null;
  fullName?: string;
  mustChangePassword?: boolean;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export type OtpPurpose = 'FIRST_LOGIN_VERIFICATION' | 'PASSWORD_RESET' | 'REGISTRATION';

export interface RequestOtpResponse {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  simulatedOtp?: string;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  resetToken?: string;
  phoneVerified?: boolean;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}
