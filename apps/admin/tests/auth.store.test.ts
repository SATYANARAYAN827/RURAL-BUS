import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdminAuthStore } from '../src/stores/auth.store.js';
import { apiClient } from '../src/services/api.client.js';
import type { AuthUser, AuthTokens } from '@ruralbus/shared-types';

class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

// Setup global mock for node environment
const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = { localStorage: mockStorage };

describe('Admin Web Auth Store (useAdminAuthStore)', () => {
  const mockAdminUser: AuthUser = {
    id: 'admin-uuid-1',
    fullName: 'Depot Manager',
    phone: '9876543210',
    email: 'admin@ksrtc.gov.in',
    role: 'OPERATOR_ADMIN',
    tenantId: 'tenant-uuid-1',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTokens: AuthTokens = {
    accessToken: 'admin-access-token',
    refreshToken: 'admin-refresh-token',
    expiresIn: 900,
  };

  const mockTenant = {
    id: 'tenant-uuid-1',
    name: 'KSRTC Regional Transport',
    slug: 'tenant-ksrtc',
  };

  beforeEach(() => {
    useAdminAuthStore.setState({
      user: null,
      tokens: null,
      tenant: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    mockStorage.clear();
    vi.restoreAllMocks();
  });

  it('should have initial unauthenticated state', () => {
    const state = useAdminAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tenant).toBeNull();
    expect(state.tokens).toBeNull();
  });

  it('should successfully log in operator admin, fetch tenant context, and persist tokens', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      data: {
        success: true,
        data: {
          user: mockAdminUser,
          tokens: mockTokens,
        },
      },
    });

    vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          tenant: mockTenant,
        },
      },
    });

    await useAdminAuthStore.getState().login({
      identifier: 'admin@ksrtc.gov.in',
      password: 'Password123!',
    });

    const state = useAdminAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockAdminUser);
    expect(state.tenant).toEqual(mockTenant);
    expect(state.tokens).toEqual(mockTokens);

    expect(mockStorage.getItem('ruralbus_access_token')).toBe(mockTokens.accessToken);
    expect(mockStorage.getItem('ruralbus_refresh_token')).toBe(mockTokens.refreshToken);
  });

  it('should clear session and storage on logout', async () => {
    useAdminAuthStore.setState({
      user: mockAdminUser,
      tokens: mockTokens,
      tenant: mockTenant,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    });
    mockStorage.setItem('ruralbus_access_token', mockTokens.accessToken);
    mockStorage.setItem('ruralbus_refresh_token', mockTokens.refreshToken);

    vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true } });

    await useAdminAuthStore.getState().logout();

    const state = useAdminAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.tenant).toBeNull();
    expect(state.tokens).toBeNull();

    expect(mockStorage.getItem('ruralbus_access_token')).toBeNull();
    expect(mockStorage.getItem('ruralbus_refresh_token')).toBeNull();
  });

  it('should handle login error gracefully', async () => {
    vi.spyOn(apiClient, 'post').mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Invalid operator credentials',
          },
        },
      },
    });

    await expect(
      useAdminAuthStore.getState().login({
        identifier: 'wrong@ksrtc.gov.in',
        password: 'wrong',
      })
    ).rejects.toThrow('Invalid operator credentials');

    const state = useAdminAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.error).toBe('Invalid operator credentials');
  });
});
