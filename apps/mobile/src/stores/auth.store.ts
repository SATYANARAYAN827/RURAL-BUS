import { create } from 'zustand';
import { storage } from './storage.js';
import { apiClient } from '../services/api.client.js';
import type {
  AuthUser,
  AuthTokens,
  LoginResponse,
} from '@ruralbus/shared-types';
import type {
  LoginInput,
  RegisterPassengerInput,
} from '@ruralbus/shared-validators';

export interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterPassengerInput) => Promise<void>;
  logout: () => Promise<void>;
  setSession: (user: AuthUser, tokens: AuthTokens) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialize: async () => {
    set({ isLoading: true, error: null });
    try {
      const storedUser = await storage.getItem('ruralbus_user');
      const accessToken = await storage.getItem('ruralbus_access_token');
      const refreshToken = await storage.getItem('ruralbus_refresh_token');

      if (storedUser && accessToken && refreshToken) {
        const user = JSON.parse(storedUser) as AuthUser;
        const tokens: AuthTokens = {
          accessToken,
          refreshToken,
          expiresIn: 900,
        };

        // Optionally verify profile with server
        try {
          const res = await apiClient.get<{ success: boolean; data: { user: AuthUser } }>(
            '/api/v1/auth/me'
          );
          set({
            user: res.data.data.user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        } catch {
          // If network error, still trust persisted session temporarily
          set({
            user,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
    } catch {
      set({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/api/v1/auth/login',
        input
      );

      const { user, tokens } = res.data.data;
      await get().setSession(user, tokens);
      set({ isLoading: false });
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ||
        (err as Error).message ||
        'Authentication failed';

      set({ error: errorMsg, isLoading: false, isAuthenticated: false });
      throw new Error(errorMsg);
    }
  },

  register: async (input: RegisterPassengerInput) => {
    set({ isLoading: true, error: null });
    try {
      const res = await apiClient.post<{ success: boolean; data: LoginResponse }>(
        '/api/v1/auth/register',
        input
      );

      const { user, tokens } = res.data.data;
      await get().setSession(user, tokens);
      set({ isLoading: false });
    } catch (err: unknown) {
      const errorMsg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ||
        (err as Error).message ||
        'Registration failed';

      set({ error: errorMsg, isLoading: false, isAuthenticated: false });
      throw new Error(errorMsg);
    }
  },

  setSession: async (user: AuthUser, tokens: AuthTokens) => {
    await storage.setItem('ruralbus_user', JSON.stringify(user));
    await storage.setItem('ruralbus_access_token', tokens.accessToken);
    await storage.setItem('ruralbus_refresh_token', tokens.refreshToken);

    set({
      user,
      tokens,
      isAuthenticated: true,
      error: null,
    });
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
      // Ignore network errors on logout
    }

    await storage.removeItem('ruralbus_user');
    await storage.removeItem('ruralbus_access_token');
    await storage.removeItem('ruralbus_refresh_token');

    set({
      user: null,
      tokens: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));
