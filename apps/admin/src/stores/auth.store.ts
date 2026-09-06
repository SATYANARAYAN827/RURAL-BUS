import { create } from 'zustand';
import { apiClient } from '../services/api.client.js';
import type {
  AuthUser,
  AuthTokens,
  LoginResponse,
} from '@ruralbus/shared-types';
import type { LoginInput } from '@ruralbus/shared-validators';

export type UserRole = 'PASSENGER' | 'DRIVER' | 'CONDUCTOR' | 'OPERATOR_ADMIN' | 'PLATFORM_ADMIN';

export interface RegisterInput {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  role?: UserRole;
}

export interface AdminAuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  tenant: { id: string; name: string; slug: string } | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  showWelcome: boolean;

  initialize: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginAsDemo?: never;
  logout: () => Promise<void>;
  requestOtp: (phone: string, purpose?: 'FIRST_LOGIN_VERIFICATION' | 'PASSWORD_RESET' | 'REGISTRATION') => Promise<{ success: boolean; message: string; expiresInSeconds: number; simulatedOtp?: string }>;
  verifyOtp: (phone: string, otp: string, purpose?: 'FIRST_LOGIN_VERIFICATION' | 'PASSWORD_RESET' | 'REGISTRATION') => Promise<{ success: boolean; message: string; resetToken?: string; phoneVerified?: boolean }>;
  resetPassword: (resetToken: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  forceChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  triggerWelcome: () => void;
  dismissWelcome: () => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  user: null,
  tokens: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  showWelcome: false,

  triggerWelcome: () => set({ showWelcome: true }),
  dismissWelcome: () => set({ showWelcome: false }),

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        set({ user: null, tokens: null, tenant: null, isAuthenticated: false, isLoading: false });
        return;
      }

      const storedUser = localStorage.getItem('ruralbus_user');
      const accessToken = localStorage.getItem('ruralbus_access_token');
      const refreshToken = localStorage.getItem('ruralbus_refresh_token');

      if (storedUser && accessToken && refreshToken) {
        const user = JSON.parse(storedUser) as AuthUser;
        const tokens: AuthTokens = {
          accessToken,
          refreshToken,
          expiresIn: 900,
        };

        try {
          const [meRes, tenantRes] = await Promise.all([
            apiClient.get<{ success: boolean; data: { user: AuthUser } }>('/api/v1/auth/me'),
            user.role !== 'PASSENGER'
              ? apiClient.get<{
                  success: boolean;
                  data: { tenant: { id: string; name: string; slug: string } };
                }>('/api/v1/tenant/context').catch(() => null)
              : Promise.resolve(null),
          ]);

          const verifiedUser = meRes?.data?.data?.user || user;
          const verifiedTenant = tenantRes?.data?.data?.tenant || null;

          set({
            user: verifiedUser,
            tenant: verifiedTenant,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch {
          // If token verification fails and refresh fails, clear invalid session
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('ruralbus_access_token');
            localStorage.removeItem('ruralbus_refresh_token');
            localStorage.removeItem('ruralbus_user');
          }
          set({ user: null, tokens: null, tenant: null, isAuthenticated: false, isLoading: false });
          return;
        }
      }

      set({ user: null, tokens: null, tenant: null, isAuthenticated: false, isLoading: false });
    } catch {
      set({ user: null, tokens: null, tenant: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });

    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/api/v1/auth/login',
        {
          identifier: input.identifier.trim(),
          password: input.password,
        }
      );

      if (res?.data?.data?.user && res.data.data.tokens) {
        const { user, tokens } = res.data.data;

        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('ruralbus_user', JSON.stringify(user));
          localStorage.setItem('ruralbus_access_token', tokens.accessToken);
          localStorage.setItem('ruralbus_refresh_token', tokens.refreshToken);
        }

        let tenant: { id: string; name: string; slug: string } | null = null;
        if (user.role !== 'PASSENGER') {
          try {
            const tenantRes = await apiClient.get<{
              success: boolean;
              data: { tenant: { id: string; name: string; slug: string } };
            }>('/api/v1/tenant/context');
            tenant = tenantRes?.data?.data?.tenant || null;
          } catch {
            tenant = null;
          }
        }

        set({
          user,
          tokens,
          tenant,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          showWelcome: true,
        });
        return;
      }

      throw new Error('Authentication response missing user or tokens');
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.message ||
        err?.message ||
        'Authentication failed. Please check your credentials.';
      set({ error: errorMsg, isLoading: false, isAuthenticated: false, user: null, tokens: null, tenant: null });
      throw new Error(errorMsg);
    }
  },

  register: async (input: RegisterInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/api/v1/auth/register',
        {
          fullName: input.fullName.trim(),
          phone: input.phone.trim(),
          email: input.email ? input.email.trim().toLowerCase() : undefined,
          password: input.password,
        }
      );

      const { user, tokens } = res.data.data;

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('ruralbus_user', JSON.stringify(user));
        localStorage.setItem('ruralbus_access_token', tokens.accessToken);
        localStorage.setItem('ruralbus_refresh_token', tokens.refreshToken);
      }

      set({
        user,
        tokens,
        tenant: null,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        showWelcome: true,
      });
    } catch (err: unknown) {
      const errorData = (err as { response?: { data?: { error?: { message?: string; code?: string } } } })
        ?.response?.data?.error;

      let errorMsg =
        errorData?.message ||
        (err as Error).message ||
        'Registration failed. Please verify your details.';

      if (errorData?.code === 'CONFLICT' || errorMsg.toLowerCase().includes('already registered')) {
        errorMsg = `${errorMsg}. Please log in instead.`;
      }

      set({ error: errorMsg, isLoading: false, isAuthenticated: false });
      throw new Error(errorMsg);
    }
  },


  logout: async () => {
    const { tokens } = get();
    try {
      if (tokens?.refreshToken) {
        await apiClient.post('/api/v1/auth/logout', {
          refreshToken: tokens.refreshToken,
        });
      }
    } catch {
      // Ignore network errors
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('ruralbus_user');
      localStorage.removeItem('ruralbus_access_token');
      localStorage.removeItem('ruralbus_refresh_token');
      localStorage.removeItem('ruralbus_admin_user');
      localStorage.removeItem('ruralbus_admin_access_token');
      localStorage.removeItem('ruralbus_admin_refresh_token');
    }

    set({
      user: null,
      tokens: null,
      tenant: null,
      isAuthenticated: false,
      error: null,
      showWelcome: false,
    });
  },

  requestOtp: async (phone: string, purpose = 'PASSWORD_RESET') => {
    try {
      const res = await apiClient.post<{ success: boolean; message: string; expiresInSeconds: number; simulatedOtp?: string }>(
        '/api/v1/auth/otp/request',
        { phone: phone.trim(), purpose }
      );
      return res.data;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to send OTP';
      throw new Error(msg);
    }
  },

  verifyOtp: async (phone: string, otp: string, purpose = 'PASSWORD_RESET') => {
    try {
      const res = await apiClient.post<{ success: boolean; message: string; resetToken?: string; phoneVerified?: boolean }>(
        '/api/v1/auth/otp/verify',
        { phone: phone.trim(), otp: otp.trim(), purpose }
      );
      return res.data;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Invalid OTP verification code';
      throw new Error(msg);
    }
  },

  resetPassword: async (resetToken: string, newPassword: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        '/api/v1/auth/password-reset',
        { resetToken, newPassword }
      );
      return res.data;
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to reset password';
      throw new Error(msg);
    }
  },

  forceChangePassword: async (currentPassword: string, newPassword: string) => {
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/api/v1/auth/force-change-password',
        { currentPassword, newPassword }
      );

      if (res?.data?.data?.user && res.data.data.tokens) {
        const { user, tokens } = res.data.data;
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('ruralbus_user', JSON.stringify(user));
          localStorage.setItem('ruralbus_access_token', tokens.accessToken);
          localStorage.setItem('ruralbus_refresh_token', tokens.refreshToken);
        }
        set({
          user,
          tokens,
          isAuthenticated: true,
          error: null,
        });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to update password';
      throw new Error(msg);
    }
  },

  clearError: () => set({ error: null }),
}));

if (typeof window !== 'undefined') {
  window.addEventListener('ruralbus:session-expired', () => {
    useAdminAuthStore.setState({
      user: null,
      tokens: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
      error: 'Your session has expired. Please sign in again.',
    });
  });
}

