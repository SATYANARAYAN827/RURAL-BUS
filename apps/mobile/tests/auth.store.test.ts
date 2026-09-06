import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../src/stores/auth.store.js';
import { storage } from '../src/stores/storage.js';
import { apiClient } from '../src/services/api.client.js';
import type { AuthUser, AuthTokens } from '@ruralbus/shared-types';

describe('Mobile App Auth Store (useAuthStore)', () => {
  const mockUser: AuthUser = {
    id: 'user-uuid-1',
    fullName: 'Test Driver',
    phone: '9876543210',
    email: 'driver@test.com',
    role: 'DRIVER',
    tenantId: 'tenant-uuid-1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTokens: AuthTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 900,
  };

  beforeEach(() => {
    // Reset store and storage state
    useAuthStore.setState({
      user: null,
      tokens: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    storage.removeItem('ruralbus_user');
    storage.removeItem('ruralbus_access_token');
    storage.removeItem('ruralbus_refresh_token');
    vi.restoreAllMocks();
  });

  it('should have initial unauthenticated state', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();
  });

  it('should successfully setSession and persist tokens to storage', async () => {
    await useAuthStore.getState().setSession(mockUser, mockTokens);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.tokens).toEqual(mockTokens);

    const storedUser = await storage.getItem('ruralbus_user');
    const storedAccess = await storage.getItem('ruralbus_access_token');
    const storedRefresh = await storage.getItem('ruralbus_refresh_token');

    expect(JSON.parse(storedUser!)).toEqual(mockUser);
    expect(storedAccess).toBe(mockTokens.accessToken);
    expect(storedRefresh).toBe(mockTokens.refreshToken);
  });

  it('should clear session and storage on logout', async () => {
    await useAuthStore.getState().setSession(mockUser, mockTokens);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tokens).toBeNull();

    expect(await storage.getItem('ruralbus_user')).toBeNull();
    expect(await storage.getItem('ruralbus_access_token')).toBeNull();
    expect(await storage.getItem('ruralbus_refresh_token')).toBeNull();
  });

  it('should authenticate user on successful login and set session', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      },
    });

    await useAuthStore.getState().login({
      identifier: 'driver@test.com',
      password: 'Password123!',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('DRIVER');
    expect(state.tokens?.accessToken).toBe(mockTokens.accessToken);
  });

  it('should set error state on login failure', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Invalid email/phone or password',
          },
        },
      },
    });

    await expect(
      useAuthStore.getState().login({
        identifier: 'invalid@test.com',
        password: 'wrong',
      })
    ).rejects.toThrow('Invalid email/phone or password');

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid email/phone or password');
  });

  it('should register passenger on successful register and set session', async () => {
    const passengerUser: AuthUser = {
      ...mockUser,
      role: 'PASSENGER',
      tenantId: null,
    };

    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          user: passengerUser,
          tokens: mockTokens,
        },
      },
    });

    await useAuthStore.getState().register({
      fullName: 'New Passenger',
      phone: '9988776655',
      password: 'Password123!',
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('PASSENGER');
  });
});
